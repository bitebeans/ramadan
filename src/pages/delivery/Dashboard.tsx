import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Bike, MapPin, Phone, MessageCircle, Package, CheckCheck, History, Bell } from 'lucide-react';
import { audioNotifier } from '../../lib/audio';
import { getCustomerOrderOutForDeliveryUrl, getCustomerOrderDeliveredUrl } from '../../lib/whatsapp';
import { showToast } from '../../lib/toast';
import { fireConfetti } from '../../lib/confetti';

interface OrderWithDetails extends Order {
    profiles: { name: string; phone: string };
    addresses: { address_text: string; pincode: string; landmark: string | null };
}

interface DeliveryHistoryItem {
    id: string;
    quantity: number;
    total_amount: number;
    profiles: { name: string };
    addresses: { address_text: string };
    updated_at: string;
}

const DeliveryDashboard: React.FC = () => {
    const { role, session, signOut } = useAuth();
    const navigate = useNavigate();

    const [activeOrders, setActiveOrders] = useState<OrderWithDetails[]>([]);
    const [history, setHistory] = useState<DeliveryHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'Active' | 'History'>('Active');
    const [bellCount, setBellCount] = useState(0);

    useEffect(() => {
        if (role && role !== 'delivery') { navigate('/staff/login'); return; }

        const enableAudio = () => audioNotifier.initialize(true);
        document.addEventListener('click', enableAudio, { once: true });

        fetchOrders();
        fetchHistory();

        const orderSub = supabase.channel('delivery_orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                if (payload.eventType === 'UPDATE' && payload.new.status === 'Ready') {
                    audioNotifier.playNotificationPattern();
                    setBellCount(c => c + 1);
                    showToast('🛎️ Order is ready for pickup!', { type: 'info', duration: 6000 });
                }
                fetchOrders();
                fetchHistory(); // in case one was just marked delivered
            })
            .subscribe();

        return () => {
            supabase.removeChannel(orderSub);
            document.removeEventListener('click', enableAudio);
        };
    }, [role]);

    const fetchOrders = async () => {
        const { data } = await supabase
            .from('orders')
            .select(`*, profiles!orders_user_id_fkey(name, phone), addresses(address_text, pincode, landmark)`)
            .in('status', ['Ready', 'Out for Delivery'])
            .order('updated_at', { ascending: false });

        if (data) {
            const filtered = (data as OrderWithDetails[]).filter(o => {
                if (o.status === 'Ready') return true;
                if (o.status === 'Out for Delivery' && o.assigned_delivery_partner === session?.user.id) return true;
                return false;
            });
            setActiveOrders(filtered);
        }
        setLoading(false);
    };

    const fetchHistory = async () => {
        if (!session?.user.id) return;
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const { data } = await supabase
            .from('orders')
            .select(`id, quantity, total_amount, updated_at, profiles!orders_user_id_fkey(name), addresses(address_text)`)
            .eq('assigned_delivery_partner', session.user.id)
            .eq('status', 'Delivered')
            .gte('updated_at', startOfToday.toISOString())
            .order('updated_at', { ascending: false });

        if (data) setHistory(data as unknown as DeliveryHistoryItem[]);
    };

    const markPickedUp = async (order: OrderWithDetails) => {
        const { error } = await supabase.from('orders').update({
            status: 'Out for Delivery',
            assigned_delivery_partner: session?.user.id
        }).eq('id', order.id);

        if (!error) {
            const waUrl = getCustomerOrderOutForDeliveryUrl(order.profiles.phone, order.id.split('-')[0]);
            window.open(waUrl, '_blank');
            showToast('Order Picked Up!', { type: 'success' });
            fetchOrders();
        } else {
            showToast('Failed to pick up: ' + error.message, { type: 'error' });
        }
    };

    const markDelivered = async (order: OrderWithDetails) => {
        if (!window.confirm(`Confirm delivery to ${order.profiles.name}?`)) return;

        const { error } = await supabase.from('orders').update({ status: 'Delivered' }).eq('id', order.id);
        if (!error) {
            fireConfetti();
            showToast('🎉 Delivery completed!', { type: 'success' });
            const waUrl = getCustomerOrderDeliveredUrl(order.profiles.phone, order.id.split('-')[0]);
            window.open(waUrl, '_blank');
            fetchOrders();
            fetchHistory();
        } else {
            showToast('Failed to mark delivered: ' + error.message, { type: 'error' });
        }
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' }}>
            <div style={{ textAlign: 'center' }}>
                <Bike size={48} color="var(--color-primary)" style={{ margin: '0 auto 1rem' }} />
                <p style={{ fontSize: '1.25rem', fontWeight: 600, color: '#374151' }}>Loading Delivery Hub…</p>
            </div>
        </div>
    );

    const historyStats = history.reduce((acc, curr) => ({
        count: acc.count + 1,
        thalis: acc.thalis + curr.quantity,
        value: acc.value + curr.total_amount
    }), { count: 0, thalis: 0, value: 0 });

    return (
        <div style={{ backgroundColor: '#F9FAFB', color: '#111827', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <header style={{ backgroundColor: 'var(--color-primary)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', position: 'sticky', top: 0, zIndex: 10 }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Bike size={24} /> Delivery
                </h1>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {bellCount > 0 && (
                        <button onClick={() => setBellCount(0)} style={{ backgroundColor: 'var(--color-status-error)', border: 'none', color: 'white', padding: '0.35rem 0.6rem', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                            <Bell size={16} /> {bellCount}
                        </button>
                    )}
                    <button className="btn btn-outline" style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white', padding: '0.4rem 0.8rem' }} onClick={() => { signOut(); navigate('/staff'); }}>
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </header>

            {/* Bottom Navigation (Mobile friendly tabs) */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', backgroundColor: 'white' }}>
                <button
                    style={{ flex: 1, padding: '1rem', fontSize: '1rem', fontWeight: 700, backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'Active' ? '3px solid var(--color-primary)' : '3px solid transparent', color: activeTab === 'Active' ? 'var(--color-primary)' : '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
                    onClick={() => setActiveTab('Active')}
                >
                    <Package size={20} /> Active Drops
                    <span style={{ backgroundColor: activeTab === 'Active' ? '#E0F2FE' : '#F3F4F6', color: activeTab === 'Active' ? '#0369A1' : '#6B7280', padding: '0.1rem 0.5rem', borderRadius: '100px', fontSize: '0.8rem' }}>{activeOrders.length}</span>
                </button>
                <button
                    style={{ flex: 1, padding: '1rem', fontSize: '1rem', fontWeight: 700, backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'History' ? '3px solid var(--color-primary)' : '3px solid transparent', color: activeTab === 'History' ? 'var(--color-primary)' : '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
                    onClick={() => setActiveTab('History')}
                >
                    <History size={20} /> History
                </button>
            </div>

            <main style={{ padding: '1.5rem 1rem', flex: 1, maxWidth: 600, margin: '0 auto', width: '100%' }}>
                {activeTab === 'Active' ? (
                    <>
                        {activeOrders.length === 0 ? (
                            <div className="card text-center" style={{ padding: '4rem 1rem', marginTop: '2rem' }}>
                                <Package size={48} color="#9CA3AF" style={{ margin: '0 auto 1rem' }} />
                                <h3 style={{ color: '#4B5563', margin: 0 }}>No pending drops right now</h3>
                                <p style={{ color: '#6B7280', marginTop: '0.5rem' }}>Wait for the chef to mark orders as Ready.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {activeOrders.map(order => (
                                    <div key={order.id} className="card" style={{ padding: '1.5rem', borderLeft: `8px solid ${order.status === 'Ready' ? '#F59E0B' : '#3B82F6'}`, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                                        <div className="flex justify-between items-center mb-4">
                                            <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>#{order.id.split('-')[0].toUpperCase()}</span>
                                            <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '1.2rem', backgroundColor: '#E0F2FE', padding: '0.25rem 0.75rem', borderRadius: '8px' }}>{order.quantity}x Thali</span>
                                        </div>

                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <h3 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem', lineHeight: 1.1, color: '#111827' }}>{order.profiles.name}</h3>

                                            {/* Action Bar */}
                                            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                                <a href={`tel:${order.profiles.phone}`} className="btn" style={{ flex: 1, backgroundColor: '#EFF6FF', color: '#1D4ED8', height: '52px', border: '1px solid #BFDBFE' }}>
                                                    <Phone size={20} /> Call
                                                </a>
                                                <a href={`https://wa.me/${order.profiles.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="btn" style={{ flex: 1, backgroundColor: '#F0FDF4', color: '#15803D', height: '52px', border: '1px solid #BBF7D0' }}>
                                                    <MessageCircle size={20} /> WhatsApp
                                                </a>
                                            </div>

                                            <div style={{ backgroundColor: '#F3F4F6', padding: '1rem', borderRadius: '12px', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', border: '1px solid #E5E7EB' }}>
                                                <MapPin size={24} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                                <div>
                                                    <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, lineHeight: 1.3, color: '#111827' }}>{order.addresses.address_text}</p>
                                                    <p style={{ margin: '0.35rem 0 0', color: '#4B5563', fontWeight: 500 }}>PIN: {order.addresses.pincode}</p>
                                                    {order.addresses.landmark && <p style={{ margin: '0.25rem 0 0', color: '#4B5563', fontWeight: 500 }}>Landmark: {order.addresses.landmark}</p>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Payment Info */}
                                        <div style={{ padding: '0.75rem', backgroundColor: (order as any).payment_method === 'cod' ? '#FFFBEB' : '#F0FDF4', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', border: `1px dashed ${(order as any).payment_method === 'cod' ? '#F59E0B' : '#22C55E'}` }}>
                                            {(order as any).payment_method === 'cod' ? (
                                                <span style={{ fontWeight: 800, color: '#B45309', fontSize: '1.1rem' }}>💵 Collect ₹{order.total_amount} Cash from Customer</span>
                                            ) : (
                                                <span style={{ fontWeight: 700, color: '#166534' }}>✅ Online Payment (Pre-paid)</span>
                                            )}
                                        </div>

                                        {order.status === 'Ready' && (
                                            <button className="btn btn-huge" style={{ backgroundColor: 'var(--color-primary)', color: 'white', fontSize: '1.25rem', width: '100%', borderRadius: '12px', boxShadow: '0 4px 14px rgba(15, 76, 92, 0.3)' }} onClick={() => markPickedUp(order)}>
                                                <Package size={24} /> Pick Up Package
                                            </button>
                                        )}

                                        {order.status === 'Out for Delivery' && (
                                            <button className="btn btn-huge" style={{ backgroundColor: '#10B981', color: 'white', fontSize: '1.25rem', width: '100%', borderRadius: '12px', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' }} onClick={() => markDelivered(order)}>
                                                <CheckCheck size={24} /> Mark Delivered
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {/* History Tab */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '2rem' }}>
                            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Deliveries</p>
                                <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#111827' }}>{historyStats.count}</p>
                            </div>
                            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Thalis</p>
                                <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#111827' }}>{historyStats.thalis}</p>
                            </div>
                            <div className="card" style={{ padding: '1rem', textAlign: 'center', backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Value</p>
                                <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#15803D' }}>₹{historyStats.value}</p>
                            </div>
                        </div>

                        {history.length === 0 ? (
                            <div className="card text-center" style={{ padding: '3rem 1rem' }}>
                                <History size={32} color="#9CA3AF" style={{ margin: '0 auto 1rem' }} />
                                <p style={{ color: '#6B7280', margin: 0 }}>No deliveries completed today.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {history.map(item => (
                                    <div key={item.id} className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>{item.profiles?.name}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#6B7280' }}>
                                                {new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {item.quantity}x • #{item.id.split('-')[0].toUpperCase()}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 800, color: '#15803D' }}>₹{item.total_amount}</div>
                                            <span style={{ fontSize: '0.75rem', backgroundColor: '#DCFCE7', color: '#166534', padding: '0.15rem 0.5rem', borderRadius: '100px', fontWeight: 700 }}>Delivered</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default DeliveryDashboard;
