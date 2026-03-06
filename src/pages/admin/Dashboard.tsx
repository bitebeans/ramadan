import React, { useEffect, useState } from 'react';
import { supabase, getSupabaseAdmin } from '../../lib/supabase';
import type { Order } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Check, X, Bell, Settings, TrendingUp, Users, Shield } from 'lucide-react';
import { audioNotifier } from '../../lib/audio';
import { getCustomerOrderAcceptedUrl, getCustomerOrderRejectedUrl } from '../../lib/whatsapp';

interface OrderWithDetails extends Order {
    profiles: { name: string; phone: string };
    addresses: { address_text: string; pincode: string };
}

const AdminDashboard: React.FC = () => {
    const { role, signOut } = useAuth();
    const navigate = useNavigate();

    const [pendingOrders, setPendingOrders] = useState<OrderWithDetails[]>([]);
    const [stats, setStats] = useState({ revenue: 0, totalOrders: 0, pendingApprove: 0, activePipeline: 0 });
    const [loading, setLoading] = useState(true);
    const [staffUsers, setStaffUsers] = useState<any[]>([]);

    // Quick settings toggle state
    const [itemPrice, setItemPrice] = useState(119);
    const [deliveryCharge, setDeliveryCharge] = useState(20);
    const [outOfStock, setOutOfStock] = useState(false);

    useEffect(() => {
        // Basic verification of role (auth guard)
        if (role && role !== 'admin') {
            navigate('/staff/login');
            return;
        }

        // Must click anywhere on page to enable Audio API safely
        const enableAudio = () => audioNotifier.initialize(true);
        document.addEventListener('click', enableAudio, { once: true });

        fetchData();
        fetchStaff();

        // Subscribe to realtime orders
        const orderSub = supabase.channel('admin_orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    audioNotifier.playNotificationPattern();
                }
                fetchData(); // Simplest way to keep stats true is to refetch
            })
            .subscribe();

        return () => {
            supabase.removeChannel(orderSub);
            document.removeEventListener('click', enableAudio);
        };
    }, [role]);

    const fetchData = async () => {
        // 1. Fetch live stats for today
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const { data: allToday } = await supabase
            .from('orders')
            .select('status, total_amount')
            .gte('created_at', startOfToday.toISOString());

        if (allToday) {
            let r = 0, p = 0, a = 0;
            allToday.forEach(o => {
                if (o.status !== 'Cancelled' && o.status !== 'Rejected') {
                    r += Number(o.total_amount);
                }
                if (o.status === 'Pending') p++;
                if (['Accepted', 'Preparing', 'Ready', 'Out for Delivery'].includes(o.status)) a++;
            });
            setStats({ revenue: r, totalOrders: allToday.length, pendingApprove: p, activePipeline: a });
        }

        // 2. Fetch pending orders with details
        const { data: pending } = await supabase
            .from('orders')
            .select(`
        *,
        profiles (name, phone),
        addresses (address_text, pincode)
      `)
            .eq('status', 'Pending')
            .order('created_at', { ascending: true }); // Oldest first

        if (pending) {
            setPendingOrders(pending as OrderWithDetails[]);
        }

        // 3. Fetch current settings for quick edit
        const { data: settings } = await supabase.from('settings').select('*');
        if (settings) {
            settings.forEach(s => {
                if (s.key === 'app_config') setItemPrice(s.value.item_price);
                if (s.key === 'store_status') setOutOfStock(s.value.out_of_stock);
                if (s.key === 'delivery_config') setDeliveryCharge(s.value.charge);
            });
        }

        setLoading(false);
    };

    const fetchStaff = async () => {
        const { data } = await supabase.from('profiles').select('*').in('role', ['chef', 'delivery']);
        if (data) setStaffUsers(data);
    };

    const updateSetting = async (key: string, value: any) => {
        await supabase.from('settings').update({ value }).eq('key', key);
    };

    // Actions
    const handleAccept = async (order: OrderWithDetails) => {
        // Find default charge set right now to propose as baseline
        const suggestedCharge = deliveryCharge || 30;

        const customChargeInput = window.prompt(`Distance based delivery charge for PIN ${order.addresses.pincode} (${order.addresses.address_text}):`, suggestedCharge.toString());
        if (customChargeInput === null) return; // Cancelled

        const customDeliveryCharge = Number(customChargeInput) || 0;

        // Assume price per quantity hasn't shifted dramatically during transit. We calculate backwards.
        // Or cleaner: Fetch itemPrice again to be safe. We'll use the state itemPrice.
        const thaliTotal = order.quantity * itemPrice;
        const newTotalAmount = thaliTotal + customDeliveryCharge;

        const { error } = await supabase.from('orders').update({
            status: 'Accepted',
            total_amount: newTotalAmount
            // Note: If we had a schema field for final_delivery_charge we would set it here.
            // Since we don't, we just bundle it into total_amount to fulfill the requirement without breaking other queries.
        }).eq('id', order.id);

        if (!error) {
            const waUrl = getCustomerOrderAcceptedUrl(order.profiles.phone, order.id.split('-')[0]);
            window.open(waUrl, '_blank');
            setPendingOrders(prev => prev.filter(o => o.id !== order.id)); // optimistic UI
        } else {
            alert('Failed to accept order: ' + error.message);
        }
    };

    const handleReject = async (order: OrderWithDetails) => {
        const reason = window.prompt(`Reason for rejecting order ${order.id.split('-')[0]}:`, 'Items sold out');
        if (reason === null) return; // cancelled

        const { error } = await supabase.from('orders').update({ status: 'Rejected', rejection_reason: reason }).eq('id', order.id);
        if (!error) {
            const waUrl = getCustomerOrderRejectedUrl(order.profiles.phone, order.id.split('-')[0], reason);
            window.open(waUrl, '_blank');
            setPendingOrders(prev => prev.filter(o => o.id !== order.id));
        }
    };

    const handleUpdatePassword = async (id: string, name: string) => {
        const newPwd = window.prompt(`Enter new password for ${name}:`);
        if (!newPwd) return;
        if (newPwd.length < 6) return alert("Password must be at least 6 characters.");
        try {
            const adminClient = getSupabaseAdmin();
            const { error } = await adminClient.auth.admin.updateUserById(id, { password: newPwd });
            if (error) alert("Error modifying password: " + error.message);
            else alert("Password successfully updated. Staff can login instantly.");
        } catch (e: any) {
            alert("Ensure VITE_SUPABASE_SERVICE_ROLE_KEY is in .env! " + e.message);
        }
    };

    if (loading) return <div>Loading Admin Panel...</div>;

    return (
        <div style={{ backgroundColor: '#F3F4F6', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Admin Navbar */}
            <header style={{ backgroundColor: '#111827', color: 'white', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Shield size={24} /> Super Admin Portal
                </h1>
                <div className="flex gap-4 items-center">
                    {stats.pendingApprove > 0 && (
                        <div style={{ backgroundColor: 'var(--color-status-error)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                            <Bell size={16} /> {stats.pendingApprove} Pending
                        </div>
                    )}
                    <button className="btn btn-outline" style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={() => { signOut(); navigate('/staff'); }}>
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </header>

            <main style={{ padding: '2rem', flex: 1, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
                {/* Live Stats Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div className="card">
                        <h3 className="text-muted"><TrendingUp size={18} style={{ verticalAlign: 'middle' }} /> Today's Revenue</h3>
                        <p style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0, color: 'var(--color-primary)' }}>₹{stats.revenue}</p>
                    </div>
                    <div className="card">
                        <h3 className="text-muted"><Users size={18} style={{ verticalAlign: 'middle' }} /> Total Orders</h3>
                        <p style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0 }}>{stats.totalOrders}</p>
                    </div>
                    <div className="card">
                        <h3 className="text-muted">Active Pipeline</h3>
                        <p style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0, color: '#F59E0B' }}>{stats.activePipeline}</p>
                    </div>
                    <div className="card" style={{ border: stats.pendingApprove > 0 ? '2px solid var(--color-status-error)' : 'none' }}>
                        <h3 className="text-muted">Pending Approval</h3>
                        <p style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0, color: stats.pendingApprove > 0 ? 'var(--color-status-error)' : 'inherit' }}>{stats.pendingApprove}</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
                    {/* Main Queue: Order Approvals */}
                    <div>
                        <h2 className="mb-4">Live Order Queue</h2>
                        {pendingOrders.length === 0 ? (
                            <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                No pending orders right now.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {pendingOrders.map(order => (
                                    <div key={order.id} className="card" style={{ borderLeft: '6px solid var(--color-status-warning)' }}>
                                        <div className="justify-between flex gap-4">
                                            <div style={{ flex: 1 }}>
                                                <div className="flex justify-between items-center mb-4 pb-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                                                    <h3>#{order.id.split('-')[0].toUpperCase()}</h3>
                                                    <span style={{ fontWeight: 600 }}>{new Date(order.created_at).toLocaleTimeString()}</span>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                                    <div>
                                                        <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{order.profiles.name}</div>
                                                        <a href={`tel:${order.profiles.phone}`} style={{ fontSize: '1.25rem', color: '#0288D1' }}>{order.profiles.phone}</a>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{order.quantity}x Thali</div>
                                                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>₹{order.total_amount}</div>
                                                    </div>
                                                </div>

                                                <div style={{ backgroundColor: '#F9FAFB', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                                                    <strong>Delivery to:</strong>
                                                    <p style={{ fontSize: '1.1rem', margin: 0 }}>{order.addresses.address_text}</p>
                                                    <p style={{ margin: 0 }}>PIN: {order.addresses.pincode}</p>
                                                </div>
                                            </div>

                                            {/* Screenshot area */}
                                            <div style={{ width: '250px' }}>
                                                <p style={{ fontWeight: 600, margin: '0 0 0.5rem 0', textAlign: 'center' }}>Payment Screenshot</p>
                                                <a href={order.payment_screenshot_url} target="_blank" rel="noreferrer">
                                                    <img src={order.payment_screenshot_url} alt="Payment" style={{ width: '100%', height: '250px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid #E5E7EB' }} />
                                                </a>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                                            <button className="btn btn-huge" style={{ flex: 1, backgroundColor: 'var(--color-status-success)', color: 'white' }} onClick={() => handleAccept(order)}>
                                                <Check size={24} /> Accept & Notify
                                            </button>
                                            <button className="btn btn-huge" style={{ flex: 1, backgroundColor: 'white', border: '2px solid var(--color-status-error)', color: 'var(--color-status-error)' }} onClick={() => handleReject(order)}>
                                                <X size={24} /> Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick Settings Sidebar */}
                    <div>
                        <div className="card" style={{ position: 'sticky', top: '2rem' }}>
                            <h3 className="mb-4 flex items-center gap-2"><Settings size={20} /> Quick Settings</h3>

                            <div style={{ padding: '1rem', backgroundColor: outOfStock ? 'rgba(211, 47, 47, 0.1)' : 'rgba(46, 125, 50, 0.1)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: `2px solid ${outOfStock ? 'var(--color-status-error)' : 'var(--color-status-success)'}` }}>
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontWeight: 700, fontSize: '1.25rem' }}>
                                    <span>{outOfStock ? 'STORE UNAVAILABLE' : 'STORE OPEN'}</span>
                                    <input
                                        type="checkbox"
                                        checked={outOfStock}
                                        onChange={(e) => {
                                            setOutOfStock(e.target.checked);
                                            updateSetting('store_status', { is_open: true, out_of_stock: e.target.checked });
                                        }}
                                        style={{ transform: 'scale(1.5)' }}
                                    />
                                </label>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Thali Price (₹)</label>
                                <input type="number" className="input-field" value={itemPrice} onChange={(e) => setItemPrice(Number(e.target.value))}
                                    onBlur={() => updateSetting('app_config', { name: "Bite & Beans Café", item_price: itemPrice })} />
                            </div>

                            <div className="input-group">
                                <label className="input-label">Delivery Charge (₹)</label>
                                <input type="number" className="input-field" value={deliveryCharge} onChange={(e) => setDeliveryCharge(Number(e.target.value))}
                                    onBlur={() => updateSetting('delivery_config', { charge: deliveryCharge })} />
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Changes sync instantly to all customer phones.</p>

                            <button className="btn btn-outline" style={{ width: '100%', marginTop: '1rem' }} onClick={() => alert("Upload QR functionality handled in specific Settings page to be implemented shortly, keeping scope contained.")}>
                                Manage QR Code
                            </button>
                        </div>

                        <div className="card" style={{ marginTop: '2rem' }}>
                            <h3 className="mb-4 flex items-center gap-2"><Shield size={20} /> Staff Passwords</h3>
                            {staffUsers.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>No portal staff found.</p> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {staffUsers.map(staff => (
                                        <div key={staff.id} style={{ padding: '1rem', backgroundColor: '#F9FAFB', borderRadius: 'var(--radius-sm)' }}>
                                            <div style={{ fontWeight: 600 }}>{staff.name}</div>
                                            <div style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.5rem' }}>Role: {staff.role.toUpperCase()}</div>
                                            <button className="btn btn-outline" style={{ width: '100%', fontSize: '0.9rem' }} onClick={() => handleUpdatePassword(staff.id, staff.name)}>
                                                Change Password
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
