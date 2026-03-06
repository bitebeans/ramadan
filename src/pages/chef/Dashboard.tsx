import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Flame, PackageCheck, UtensilsCrossed, CheckCircle2 } from 'lucide-react';
import { audioNotifier } from '../../lib/audio';

interface OrderWithDetails extends Order {
    profiles: { name: string; phone: string };
    addresses: { address_text: string };
}

const ChefDashboard: React.FC = () => {
    const { role, signOut } = useAuth();
    const navigate = useNavigate();

    const [orders, setOrders] = useState<OrderWithDetails[]>([]);
    const [activeTab, setActiveTab] = useState<'Accepted' | 'Preparing' | 'Ready' | 'All'>('Accepted');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ pending: 0, preparing: 0, ready: 0, delivered: 0 });

    useEffect(() => {
        if (role && role !== 'chef') {
            navigate('/staff/login');
            return;
        }

        const enableAudio = () => audioNotifier.initialize(true);
        document.addEventListener('click', enableAudio, { once: true });

        fetchOrders();

        const orderSub = supabase.channel('chef_orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                if (payload.eventType === 'UPDATE' && payload.new.status === 'Accepted') {
                    // Admin just accepted an order, notify chef
                    audioNotifier.playNotificationPattern();
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
            .select(`
        *,
        profiles(name, phone),
        addresses(address_text)
      `)
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
    };

    const filteredOrders = orders.filter(o => activeTab === 'All' ? true : o.status === activeTab);

    if (loading) return <div>Loading Kitchen Panel...</div>;

    return (
        <div style={{ backgroundColor: '#111827', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <header style={{ backgroundColor: '#1F2937', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #374151' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-secondary)' }}>
                    <UtensilsCrossed size={24} /> Kitchen Portal
                </h1>
                <button className="btn btn-outline" style={{ borderColor: '#4B5563', color: '#D1D5DB' }} onClick={() => { signOut(); navigate('/staff'); }}>
                    <LogOut size={16} /> Logout
                </button>
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

                {/* Filter Tabs - Built for thick fingers */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    {['Accepted', 'Preparing', 'Ready', 'All'].map(tab => (
                        <button
                            key={tab}
                            style={{
                                flex: 1,
                                minWidth: '120px',
                                padding: '1.25rem',
                                fontSize: '1.1rem',
                                fontWeight: 700,
                                backgroundColor: activeTab === tab ? 'var(--color-primary)' : '#1F2937',
                                color: activeTab === tab ? 'white' : '#9CA3AF',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer'
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
                        filteredOrders.map(order => (
                            <div key={order.id} style={{ backgroundColor: '#1F2937', borderRadius: '12px', padding: '1.5rem', border: '2px solid #374151' }}>
                                <div className="flex justify-between items-center mb-4">
                                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#FCD34D' }}>#{order.id.split('-')[0].toUpperCase()}</span>
                                    <span style={{ fontSize: '1.1rem', backgroundColor: '#374151', padding: '0.25rem 0.75rem', borderRadius: '100px' }}>
                                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>

                                <div style={{ fontSize: '2.5rem', fontWeight: 800, textAlign: 'center', margin: '1rem 0', color: 'white' }}>
                                    {order.quantity}x Thali
                                </div>

                                <div style={{ color: '#9CA3AF', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
                                    <strong>{order.profiles.name}</strong><br />
                                    <span style={{ fontSize: '0.9rem' }}>{order.addresses.address_text}</span>
                                </div>

                                {order.status === 'Accepted' && (
                                    <button className="btn btn-huge" style={{ backgroundColor: '#3B82F6', color: 'white' }} onClick={() => updateStatus(order.id, 'Preparing')}>
                                        <Flame size={24} /> Start Cooking
                                    </button>
                                )}

                                {order.status === 'Preparing' && (
                                    <button className="btn btn-huge" style={{ backgroundColor: '#10B981', color: 'white' }} onClick={() => updateStatus(order.id, 'Ready')}>
                                        <PackageCheck size={24} /> Mark Ready
                                    </button>
                                )}

                                {order.status === 'Ready' && (
                                    <div style={{ padding: '1.25rem', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10B981', textAlign: 'center', borderRadius: '8px', fontWeight: 700, fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                        <CheckCircle2 size={24} /> Waiting for Pickup
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
};

export default ChefDashboard;
