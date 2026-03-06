import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/Navbar';
import { Clock, CheckCircle2, XCircle, Truck, Package, RotateCcw } from 'lucide-react';

interface OrderWithDetails extends Order {
    addresses: { address_text: string };
    order_status_history: { status: string; created_at: string }[];
}

const Orders: React.FC = () => {
    const { session } = useAuth();
    const [orders, setOrders] = useState<OrderWithDetails[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (session) {
            fetchOrders();
            // Setup Realtime Subscription
            const channel = supabase.channel('user_orders')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `user_id=eq.${session.user.id}`
                }, () => {
                    // When an order changes, just refetch to get updated status and history
                    fetchOrders();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [session]);

    const fetchOrders = async () => {
        // Nested select to pull address text and status history
        const { data, error } = await supabase
            .from('orders')
            .select(`
        *,
        addresses(address_text),
        order_status_history(status, created_at)
      `)
            .eq('user_id', session!.user.id)
            .order('created_at', { ascending: false });

        if (!error && data) {
            // Sort history descending manually just in case
            const parsedOrders = data.map((o: any) => {
                o.order_status_history.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                return o;
            });
            setOrders(parsedOrders as OrderWithDetails[]);
        }
        setLoading(false);
    };

    const handleCancelOrder = async (orderId: string) => {
        const confirmCancel = window.confirm("Are you sure you want to cancel this order?");
        if (!confirmCancel) return;

        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: 'Cancelled' })
                .eq('id', orderId)
                .eq('status', 'Pending'); // Ensure they only cancel pending orders per requirements

            if (error) {
                if (error.message.includes('row-level security policy')) {
                    alert('Cannot cancel order after it has been accepted.');
                } else {
                    alert(error.message);
                }
            }
        } catch (err: any) {
            console.error(err);
            alert('Failed to cancel order.');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Pending': return <span className="badge badge-pending"><Clock size={14} /> Pending</span>;
            case 'Accepted': return <span className="badge badge-preparing"><CheckCircle2 size={14} /> Accepted</span>;
            case 'Rejected': return <span className="badge badge-cancelled"><XCircle size={14} /> Rejected</span>;
            case 'Preparing': return <span className="badge badge-preparing"><Clock size={14} /> Preparing</span>;
            case 'Ready': return <span className="badge badge-ready"><Package size={14} /> Ready</span>;
            case 'Out for Delivery': return <span className="badge badge-delivering"><Truck size={14} /> Out for Delivery</span>;
            case 'Delivered': return <span className="badge badge-delivered"><CheckCircle2 size={14} /> Delivered</span>;
            case 'Cancelled': return <span className="badge badge-cancelled"><RotateCcw size={14} /> Cancelled</span>;
            default: return <span className="badge">{status}</span>;
        }
    };

    const formatTime = (ts: string) => {
        return new Date(ts).toLocaleString('en-IN', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="ramadan-pattern" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <main className="container" style={{ padding: '2rem 1rem', flex: 1 }}>
                <h1 className="mb-6">My Orders</h1>

                {loading ? (
                    <p>Loading your orders...</p>
                ) : orders.length === 0 ? (
                    <div className="card text-center" style={{ padding: '4rem 2rem' }}>
                        <h3 className="mb-4">No orders yet</h3>
                        <p className="mb-6">Place an order for our Ramadan Special Thali</p>
                        <button className="btn btn-primary" onClick={() => window.location.href = '/menu'}>Order Now</button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '2rem' }}>
                        {orders.map(order => (
                            <div key={order.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="flex justify-between items-center pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                                    <div>
                                        <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Order #{order.id.split('-')[0].toUpperCase()}</span>
                                        <p style={{ margin: 0, fontSize: '0.9rem' }}>Placed {formatTime(order.created_at)}</p>
                                    </div>
                                    <div>
                                        {getStatusBadge(order.status)}
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                                    <div>
                                        <span style={{ fontWeight: 600 }}>{order.quantity}x Ramadan Thali</span>
                                        <p style={{ fontSize: '0.9rem', margin: 0, maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.addresses?.address_text}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--color-primary)' }}>₹{order.total_amount}</span>
                                        {order.status === 'Pending' && (
                                            <div style={{ marginTop: '0.5rem' }}>
                                                <button onClick={() => handleCancelOrder(order.id)} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>Cancel</button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Timeline */}
                                <div style={{ padding: '1rem', backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)' }}>
                                    <h4 className="mb-4">Live Timeline</h4>
                                    <div style={{ position: 'relative', left: '10px' }}>
                                        {/* Draw line */}
                                        <div style={{ position: 'absolute', left: '3px', top: '10px', bottom: '10px', width: '2px', backgroundColor: 'var(--color-primary-light)', opacity: 0.3 }}></div>

                                        {order.order_status_history.map((hist, idx) => (
                                            <div key={idx} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', position: 'relative' }}>
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    backgroundColor: 'var(--color-primary)',
                                                    marginTop: '6px',
                                                    zIndex: 2,
                                                    marginLeft: '1px'
                                                }}></div>
                                                <div>
                                                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-main)' }}>{hist.status}</p>
                                                    <p style={{ margin: 0, fontSize: '0.8rem' }}>{formatTime(hist.created_at)}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {/* Append initial placement if no history present */}
                                        {order.order_status_history.length === 0 && (
                                            <div style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', marginTop: '6px', zIndex: 2, marginLeft: '1px' }}></div>
                                                <div>
                                                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-main)' }}>Order Placed</p>
                                                    <p style={{ margin: 0, fontSize: '0.8rem' }}>{formatTime(order.created_at)}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Orders;
