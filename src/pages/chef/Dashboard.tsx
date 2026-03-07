import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Flame, PackageCheck, UtensilsCrossed, CheckCircle2, Phone, Search, Bell, X } from 'lucide-react';
import { audioNotifier } from '../../lib/audio';
import { showToast } from '../../lib/toast';

interface OrderWithDetails extends Order {
    profiles: { name: string; phone: string };
    addresses: { address_text: string; pincode?: string; landmark?: string };
}

// Fullscreen Image Lightbox
const Lightbox: React.FC<{ src: string; onClose: () => void }> = ({ src, onClose }) => {
    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }} onClick={onClose}>
            <button style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={onClose}>
                <X size={24} />
            </button>
            <img src={src} alt="Payment Fullscreen" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
        </div>
    );
};

const ChefDashboard: React.FC = () => {
    const { role, signOut } = useAuth();
    const navigate = useNavigate();

    const [orders, setOrders] = useState<OrderWithDetails[]>([]);
    const [activeTab, setActiveTab] = useState<'Accepted' | 'Preparing' | 'Ready' | 'All'>('Accepted');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ pending: 0, preparing: 0, ready: 0, delivered: 0 });
    const [bellCount, setBellCount] = useState(0);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    useEffect(() => {
        if (role && role !== 'chef') { navigate('/staff/login'); return; }

        const enableAudio = () => audioNotifier.initialize(true);
        document.addEventListener('click', enableAudio, { once: true });

        fetchOrders();

        const orderSub = supabase.channel('chef_orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                if (payload.eventType === 'UPDATE' && payload.new.status === 'Accepted') {
                    // Admin just accepted a generic order, notify chef
                    audioNotifier.playNotificationPattern();
                    setBellCount(c => c + 1);
                    showToast('🛎️ New Order to prepare!', { type: 'info', duration: 6000 });
                }
                fetchOrders(); // Refetch
            })
            .subscribe();

        return () => {
            supabase.removeChannel(orderSub);
            document.removeEventListener('click', enableAudio);
        };
    }, [role]);

    const fetchOrders = async () => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const { data } = await supabase
            .from('orders')
            .select(`*, profiles!orders_user_id_fkey(name, phone), addresses(address_text)`)
            .gte('created_at', startOfToday.toISOString())
            .in('status', ['Accepted', 'Preparing', 'Ready', 'Out for Delivery', 'Delivered'])
            .order('updated_at', { ascending: true }); // Oldest first inside queue

        if (data) {
            setOrders(data as OrderWithDetails[]);
            let p = 0, pr = 0, r = 0, d = 0;
            data.forEach(o => {
                if (o.status === 'Accepted') p++;
                if (o.status === 'Preparing') pr++;
                if (o.status === 'Ready') r++;
                if (o.status === 'Delivered') d += o.quantity;
            });
            setStats({ pending: p, preparing: pr, ready: r, delivered: d });
        }
        setLoading(false);
    };

    const updateStatus = async (orderId: string, status: string) => {
        await supabase.from('orders').update({ status }).eq('id', orderId);
        showToast(`Order marked as ${status}`, { type: 'success' });
    };

    const verifyPayment = async (orderId: string) => {
        await supabase.from('orders').update({ is_payment_verified: true }).eq('id', orderId);
        showToast(`Payment verified! You can start cooking now.`, { type: 'success' });
        fetchOrders();
    };

    const filteredOrders = orders.filter(o => activeTab === 'All' ? true : o.status === activeTab);

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', color: 'white' }}>
            <div style={{ textAlign: 'center' }}>
                <UtensilsCrossed size={48} color="var(--color-primary)" style={{ margin: '0 auto 1rem' }} />
                <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>Loading Kitchen….</p>
            </div>
        </div>
    );

    return (
        <div style={{ backgroundColor: '#111827', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {lightboxImage && <Lightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />}

            <header style={{ backgroundColor: '#1F2937', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #374151', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-secondary)' }}>
                    <UtensilsCrossed size={24} /> Kitchen Portal
                </h1>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {bellCount > 0 && (
                        <button onClick={() => setBellCount(0)} style={{ backgroundColor: 'var(--color-status-error)', border: 'none', color: 'white', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                            <Bell size={16} /> {bellCount}
                        </button>
                    )}
                    <button className="btn btn-outline" style={{ borderColor: '#4B5563', color: '#D1D5DB' }} onClick={() => { signOut(); navigate('/staff'); }}>
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </header>

            <main style={{ padding: '1rem', flex: 1, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
                {/* Live Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ backgroundColor: '#374151', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                        <p style={{ margin: 0, color: '#9CA3AF', fontSize: '1rem' }}>To Cook</p>
                        <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, color: '#FCD34D' }}>{stats.pending}</p>
                    </div>
                    <div style={{ backgroundColor: '#374151', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                        <p style={{ margin: 0, color: '#9CA3AF', fontSize: '1rem' }}>Cooking</p>
                        <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, color: '#60A5FA' }}>{stats.preparing}</p>
                    </div>
                    <div style={{ backgroundColor: '#374151', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                        <p style={{ margin: 0, color: '#9CA3AF', fontSize: '1rem' }}>Ready to Go</p>
                        <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, color: '#34D399' }}>{stats.ready}</p>
                    </div>
                    <div style={{ backgroundColor: '#374151', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                        <p style={{ margin: 0, color: '#9CA3AF', fontSize: '1rem' }}>Thalis Sent</p>
                        <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, color: 'white' }}>{stats.delivered}</p>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    {['Accepted', 'Preparing', 'Ready', 'All'].map(tab => (
                        <button
                            key={tab}
                            style={{
                                flex: 1, minWidth: '120px', padding: '1.25rem', fontSize: '1.1rem', fontWeight: 700,
                                backgroundColor: activeTab === tab ? 'var(--color-primary)' : '#1F2937',
                                color: activeTab === tab ? 'white' : '#9CA3AF', border: 'none', borderRadius: '8px', cursor: 'pointer'
                            }}
                            onClick={() => setActiveTab(tab as any)}
                        >
                            {tab === 'Accepted' ? 'To Cook' : tab}
                        </button>
                    ))}
                </div>

                {/* Order List */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                    {filteredOrders.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: '#6B7280', fontSize: '1.25rem' }}>
                            No orders in this queue.
                        </div>
                    ) : (
                        filteredOrders.map(order => {
                            const isOnline = (order as any).payment_method !== 'cod';
                            // A COD order doesn't need verification, or it's an online order that is verified
                            const canCook = order.status === 'Accepted' && (!isOnline || order.is_payment_verified);

                            return (
                                <div key={order.id} style={{ backgroundColor: '#1F2937', borderRadius: '12px', padding: '1.5rem', border: '2px solid #374151', display: 'flex', flexDirection: 'column' }}>
                                    <div className="flex justify-between items-center mb-4">
                                        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#FCD34D' }}>#{order.id.split('-')[0].toUpperCase()}</span>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            {!isOnline ? (
                                                <span style={{ fontSize: '0.875rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '100px', backgroundColor: '#FEF3C7', color: '#92400E' }}>COD</span>
                                            ) : (
                                                <span style={{ fontSize: '0.875rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '100px', backgroundColor: '#DCFCE7', color: '#166534' }}>Online</span>
                                            )}
                                            <span style={{ fontSize: '1.1rem', backgroundColor: '#374151', padding: '0.25rem 0.75rem', borderRadius: '100px' }}>
                                                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', margin: '1rem 0 1.5rem', justifyContent: 'center' }}>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'white' }}>{order.quantity}x Thali</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10B981' }}>₹{order.total_amount}</div>
                                    </div>

                                    <div style={{ color: '#9CA3AF', marginBottom: '1.5rem', fontSize: '1.1rem', backgroundColor: '#111827', padding: '1rem', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <strong style={{ color: 'white' }}>{order.profiles.name}</strong>
                                            <a href={`tel:${order.profiles.phone}`} style={{ color: '#60A5FA', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Phone size={14} /> {order.profiles.phone}</a>
                                        </div>
                                        <span style={{ fontSize: '0.9rem' }}>{order.addresses.address_text}</span>
                                    </div>

                                    {/* Payment Section (only if Accepted stage) */}
                                    {order.status === 'Accepted' && (
                                        <div style={{ marginTop: 'auto', marginBottom: '1rem', padding: '1rem', backgroundColor: '#111827', borderRadius: '8px', border: '1px solid #374151' }}>
                                            {isOnline ? (
                                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                    {order.payment_screenshot_url ? (
                                                        <div style={{ width: '80px', height: '80px', borderRadius: '4px', overflow: 'hidden', cursor: 'zoom-in', border: '1px solid #4B5563', flexShrink: 0 }} onClick={() => setLightboxImage(order.payment_screenshot_url!)}>
                                                            <img src={order.payment_screenshot_url} alt="Pay" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            <div style={{ position: 'absolute', transform: 'translateY(-20px)', backgroundColor: 'rgba(0,0,0,0.6)', width: '80px', textAlign: 'center', fontSize: '0.7rem' }}><Search size={10} /> Zoom</div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ width: '80px', height: '80px', backgroundColor: '#374151', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', textAlign: 'center', padding: '0.5rem' }}>No Image</div>
                                                    )}
                                                    <div style={{ flex: 1 }}>
                                                        {order.is_payment_verified ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10B981', fontWeight: 700 }}>
                                                                <CheckCircle2 size={18} /> Payment Verified
                                                            </div>
                                                        ) : (
                                                            <button className="btn btn-outline" style={{ width: '100%', padding: '0.75rem', color: 'white', borderColor: '#60A5FA' }} onClick={() => verifyPayment(order.id)}>
                                                                <CheckCircle2 size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                                                                Verify Payment
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ textAlign: 'center', padding: '0.5rem 0', color: '#FCD34D', fontWeight: 700 }}>
                                                    💵 Collect ₹{order.total_amount} Cash on Delivery
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    {order.status === 'Accepted' && (
                                        <button className="btn btn-huge" style={{ backgroundColor: canCook ? '#3B82F6' : '#374151', color: canCook ? 'white' : '#9CA3AF', cursor: canCook ? 'pointer' : 'not-allowed' }} onClick={() => canCook && updateStatus(order.id, 'Preparing')}>
                                            <Flame size={24} /> {canCook ? 'Start Cooking' : 'Verify Payment First'}
                                        </button>
                                    )}

                                    {order.status === 'Preparing' && (
                                        <button className="btn btn-huge" style={{ backgroundColor: '#10B981', color: 'white', marginTop: 'auto' }} onClick={() => updateStatus(order.id, 'Ready')}>
                                            <PackageCheck size={24} /> Mark Ready
                                        </button>
                                    )}

                                    {order.status === 'Ready' && (
                                        <div style={{ marginTop: 'auto', padding: '1.25rem', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10B981', textAlign: 'center', borderRadius: '8px', fontWeight: 700, fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                            <CheckCircle2 size={24} /> Waiting for Pickup
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </main>
        </div>
    );
};

export default ChefDashboard;
