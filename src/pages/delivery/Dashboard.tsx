import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Bike, MapPin, Phone, MessageCircle, Package, CheckCheck } from 'lucide-react';
import { audioNotifier } from '../../lib/audio';
import { getCustomerOrderOutForDeliveryUrl, getCustomerOrderDeliveredUrl } from '../../lib/whatsapp';

interface OrderWithDetails extends Order {
    profiles: { name: string; phone: string };
    addresses: { address_text: string; pincode: string; landmark: string | null };
}

const DeliveryDashboard: React.FC = () => {
    const { role, session, signOut } = useAuth();
    const navigate = useNavigate();

    const [activeOrders, setActiveOrders] = useState<OrderWithDetails[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (role && role !== 'delivery') {
            navigate('/staff/login');
            return;
        }

        const enableAudio = () => audioNotifier.initialize(true);
        document.addEventListener('click', enableAudio, { once: true });

        fetchOrders();

        const orderSub = supabase.channel('delivery_orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                if (payload.eventType === 'UPDATE' && payload.new.status === 'Ready') {
                    audioNotifier.playNotificationPattern();
                }
                fetchOrders();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(orderSub);
            document.removeEventListener('click', enableAudio);
        };
    }, [role]);

    const fetchOrders = async () => {
        // Delivery partners see Ready orders to pick up, or Out For Delivery orders assigned to them
        const { data } = await supabase
            .from('orders')
            .select(`
        *,
        profiles(name, phone),
        addresses(address_text, pincode, landmark)
      `)
            .in('status', ['Ready', 'Out for Delivery'])
            .order('updated_at', { ascending: false });

        if (data) {
            // Filter: If Out For Delivery, must be assigned to THIS partner
            const filtered = (data as OrderWithDetails[]).filter(o => {
                if (o.status === 'Ready') return true;
                if (o.status === 'Out for Delivery' && o.assigned_delivery_partner === session?.user.id) return true;
                return false;
            });
            setActiveOrders(filtered);
        }
        setLoading(false);
    };

    const markPickedUp = async (order: OrderWithDetails) => {
        const { error } = await supabase.from('orders').update({
            status: 'Out for Delivery',
            assigned_delivery_partner: session?.user.id
        }).eq('id', order.id);

        if (!error) {
            const waUrl = getCustomerOrderOutForDeliveryUrl(order.profiles.phone, order.id.split('-')[0]);
            window.open(waUrl, '_blank');
            fetchOrders();
        }
    };

    const markDelivered = async (order: OrderWithDetails) => {
        if (!window.confirm(`Confirm delivery to ${order.profiles.name}?`)) return;

        const { error } = await supabase.from('orders').update({ status: 'Delivered' }).eq('id', order.id);
        if (!error) {
            // Fire confetti / trigger whatsapp
            const waUrl = getCustomerOrderDeliveredUrl(order.profiles.phone, order.id.split('-')[0]);
            window.open(waUrl, '_blank');
            fetchOrders();
        }
    };

    if (loading) return <div>Loading Delivery Hub...</div>;

    return (
        <div style={{ backgroundColor: '#F9FAFB', color: '#111827', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <header style={{ backgroundColor: 'var(--color-primary)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', position: 'sticky', top: 0, zIndex: 10 }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Bike size={24} /> Delivery
                </h1>
                <button className="btn btn-outline" style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white' }} onClick={() => { signOut(); navigate('/staff'); }}>
                    <LogOut size={16} /> Logout
                </button>
            </header>

            <main style={{ padding: '1rem', flex: 1, maxWidth: 600, margin: '0 auto', width: '100%' }}>
                <h2 className="mb-4" style={{ color: 'var(--color-text-muted)' }}>Active Deliveries</h2>

                {activeOrders.length === 0 ? (
                    <div className="card text-center" style={{ padding: '3rem 1rem' }}>
                        <Package size={48} color="#9CA3AF" style={{ margin: '0 auto 1rem' }} />
                        <h3 style={{ color: '#6B7280' }}>No pending drops right now</h3>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {activeOrders.map(order => (
                            <div key={order.id} className="card" style={{ padding: '1.5rem', borderLeft: `8px solid ${order.status === 'Ready' ? '#F59E0B' : '#3B82F6'}` }}>
                                <div className="flex justify-between items-center mb-4">
                                    <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>#{order.id.split('-')[0].toUpperCase()}</span>
                                    <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{order.quantity}x Thali</span>
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h3 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem', lineHeight: 1.1 }}>{order.profiles.name}</h3>

                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                        <a href={`tel:${order.profiles.phone}`} className="btn" style={{ flex: 1, backgroundColor: '#E0F2FE', color: '#0288D1', height: '48px' }}>
                                            <Phone size={20} /> Call
                                        </a>
                                        <a href={`https://wa.me/${order.profiles.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="btn" style={{ flex: 1, backgroundColor: '#DCFCE7', color: '#16A34A', height: '48px' }}>
                                            <MessageCircle size={20} /> WhatsApp
                                        </a>
                                    </div>

                                    <div style={{ backgroundColor: '#F3F4F6', padding: '1rem', borderRadius: '8px', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                        <MapPin size={24} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                        <div>
                                            <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, lineHeight: 1.3 }}>{order.addresses.address_text}</p>
                                            <p style={{ margin: '0.25rem 0 0', color: '#6B7280' }}>PIN: {order.addresses.pincode}</p>
                                            {order.addresses.landmark && <p style={{ margin: '0.25rem 0 0', color: '#6B7280' }}>Landmark: {order.addresses.landmark}</p>}
                                        </div>
                                    </div>
                                </div>

                                {order.status === 'Ready' && (
                                    <button className="btn btn-huge" style={{ backgroundColor: 'var(--color-primary)', color: 'white', fontSize: '1.25rem' }} onClick={() => markPickedUp(order)}>
                                        <Package size={24} /> Pick Up Package
                                    </button>
                                )}

                                {order.status === 'Out for Delivery' && (
                                    <button className="btn btn-huge" style={{ backgroundColor: '#10B981', color: 'white', fontSize: '1.25rem' }} onClick={() => markDelivered(order)}>
                                        <CheckCheck size={24} /> Mark Delivered
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default DeliveryDashboard;
