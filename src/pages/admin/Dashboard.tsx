import React, { useEffect, useState, useRef } from 'react';
import { supabase, getSupabaseAdmin } from '../../lib/supabase';
import type { Order } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    LogOut, Check, X, Bell, Settings, TrendingUp, Users,
    Shield, QrCode, Search, ChevronDown, Upload, Package, History,
    UserPlus, Trash2, Briefcase
} from 'lucide-react';
import { audioNotifier } from '../../lib/audio';

import { showToast } from '../../lib/toast';

interface OrderWithDetails extends Order {
    profiles: { name: string; phone: string };
    addresses: { address_text: string; pincode: string };
}

interface AllOrder extends Order {
    profiles: { name: string; phone: string };
    addresses: { address_text: string; pincode: string };
}

interface CustomerProfile {
    id: string;
    name: string;
    phone: string;
    email: string;
    role: string;
    created_at: string;
    order_count?: number;
    total_spent?: number;
}

// ─── Shared Components ───────────────────────────────────────────────────────

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

// ─── Views ───────────────────────────────────────────────────────────────────

// 1. DASHBOARD VIEW (Live Stats & Pending Orders)
const DashboardView: React.FC<{
    stats: { revenue: number, totalOrders: number, pendingApprove: number, activePipeline: number };
    pendingOrders: OrderWithDetails[];
    itemPrice: number;
    deliveryCharge: number;
    onAccept: (order: OrderWithDetails) => void;
    onReject: (order: OrderWithDetails) => void;
}> = ({ stats, pendingOrders, onAccept, onReject }) => {
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {lightboxImage && <Lightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />}

            {/* Live Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card">
                    <h3 className="text-muted"><TrendingUp size={18} style={{ verticalAlign: 'middle' }} /> Today's Revenue</h3>
                    <p style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0, color: 'var(--color-primary)' }}>₹{stats.revenue}</p>
                </div>
                <div className="card">
                    <h3 className="text-muted"><Package size={18} style={{ verticalAlign: 'middle' }} /> Total Orders</h3>
                    <p style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0 }}>{stats.totalOrders}</p>
                </div>
                <div className="card">
                    <h3 className="text-muted">Active Pipeline</h3>
                    <p style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0, color: '#F59E0B' }}>{stats.activePipeline}</p>
                </div>
                <div className="card" style={{ border: stats.pendingApprove > 0 ? '2px solid var(--color-status-error)' : 'none', animation: stats.pendingApprove > 0 ? 'pulse 2s infinite' : 'none' }}>
                    <h3 className="text-muted" style={{ color: stats.pendingApprove > 0 ? 'var(--color-status-error)' : 'inherit' }}>Pending Approval</h3>
                    <p style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0, color: stats.pendingApprove > 0 ? 'var(--color-status-error)' : 'inherit' }}>{stats.pendingApprove}</p>
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }
            `}</style>

            <h2 className="mb-4">Pending Approvals Queue (FIFO)</h2>
            {pendingOrders.length === 0 ? (
                <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <Package size={48} color="#D1D5DB" style={{ margin: '0 auto 1rem' }} />
                    No pending orders right now.
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
                    {pendingOrders.map((order) => (
                        <div key={order.id} className="card" style={{ borderLeft: '6px solid var(--color-status-error)', display: 'flex', flexDirection: 'column' }}>
                            <div className="flex justify-between items-center mb-4 pb-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                                <h3>#{order.id.split('-')[0].toUpperCase()} <span style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 'normal' }}>(in queue for {Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)}m)</span></h3>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {(order as any).payment_method === 'cod' && (
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '100px', backgroundColor: '#FEF3C7', color: '#92400E' }}>COD</span>
                                    )}
                                    <span style={{ fontWeight: 600 }}>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{order.profiles.name}</div>
                                    <a href={`tel:${order.profiles.phone}`} style={{ fontSize: '1.15rem', color: '#0288D1' }}>{order.profiles.phone}</a>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{order.quantity}x Thali</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>₹{order.total_amount}</div>
                                </div>
                            </div>
                            <div style={{ backgroundColor: '#F9FAFB', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                                <strong>Delivery to:</strong>
                                <p style={{ fontSize: '1.1rem', margin: 0 }}>{order.addresses.address_text}</p>
                                <p style={{ margin: 0 }}>PIN: {order.addresses.pincode}</p>
                            </div>

                            {/* Payment Section */}
                            <div style={{ marginBottom: '1rem', flex: 1 }}>
                                {(order as any).payment_method !== 'cod' && order.payment_screenshot_url ? (
                                    <div
                                        style={{ height: '140px', borderRadius: 'var(--radius-md)', backgroundImage: `url(${order.payment_screenshot_url})`, backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'zoom-in', display: 'flex', alignItems: 'flex-end', padding: '0.5rem' }}
                                        onClick={() => setLightboxImage(order.payment_screenshot_url!)}
                                    >
                                        <span style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Search size={12} /> Tap to zoom</span>
                                    </div>
                                ) : (order as any).payment_method === 'cod' ? (
                                    <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFBEB', borderRadius: 'var(--radius-md)', border: '2px dashed #F59E0B' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '2rem' }}>💵</div>
                                            <p style={{ margin: '0.5rem 0 0', fontWeight: 700, color: '#92400E' }}>Cash on Delivery</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderRadius: 'var(--radius-md)', color: '#9CA3AF' }}>No Screenshot</div>
                                )}
                            </div>

                            <div className="flex gap-4 mt-auto pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                                <button className="btn btn-huge" style={{ flex: 1, backgroundColor: 'var(--color-status-success)', color: 'white' }} onClick={() => onAccept(order)}>
                                    <Check size={24} /> Accept & Notify
                                </button>
                                <button className="btn btn-huge" style={{ flex: 1, backgroundColor: 'white', border: '2px solid var(--color-status-error)', color: 'var(--color-status-error)' }} onClick={() => onReject(order)}>
                                    <X size={24} /> Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// 2. ALL ORDERS VIEW
const AllOrdersView: React.FC = () => {
    const [orders, setOrders] = useState<AllOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('All');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 50;

    const STATUSES = ['All', 'Pending', 'Active', 'Delivered', 'Cancelled'];

    useEffect(() => { fetchOrders(); }, [statusFilter, page]);

    const fetchOrders = async () => {
        setLoading(true);
        let query = getSupabaseAdmin().from('orders')
            .select(`*, profiles!orders_user_id_fkey(name, phone), addresses(address_text, pincode)`)
            .order('created_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (statusFilter === 'Pending') query = query.eq('status', 'Pending');
        if (statusFilter === 'Delivered') query = query.eq('status', 'Delivered');
        if (statusFilter === 'Cancelled') query = query.in('status', ['Cancelled', 'Rejected']);
        if (statusFilter === 'Active') query = query.in('status', ['Accepted', 'Preparing', 'Ready', 'Out for Delivery']);

        const { data } = await query;
        if (data) setOrders(page === 0 ? data as AllOrder[] : prev => [...prev, ...data as AllOrder[]]);
        setLoading(false);
    };

    const filtered = search.trim()
        ? orders.filter(o =>
            o.id.toLowerCase().includes(search.toLowerCase()) ||
            o.profiles?.name.toLowerCase().includes(search.toLowerCase())
        )
        : orders;

    const statusColor: Record<string, string> = {
        Pending: '#EF4444', Accepted: '#3B82F6', Preparing: '#8B5CF6',
        Ready: '#10B981', 'Out for Delivery': '#06B6D4', Delivered: '#059669',
        Rejected: '#9CA3AF', Cancelled: '#9CA3AF',
    };

    return (
        <div className="card" style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 className="mb-4">Order History</h2>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {STATUSES.map(s => (
                    <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
                        style={{ padding: '0.5rem 1rem', borderRadius: '100px', fontSize: '0.9rem', fontWeight: 700, border: '1.5px solid', cursor: 'pointer', borderColor: statusFilter === s ? (statusColor[s] || '#111827') : '#E5E7EB', backgroundColor: statusFilter === s ? (statusColor[s] || '#111827') : 'white', color: statusFilter === s ? 'white' : '#374151', transition: 'all 0.15s' }}>
                        {s}
                    </button>
                ))}
            </div>
            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                <input className="input-field" placeholder="Search by order ID or customer name…" style={{ paddingLeft: '2.5rem', margin: 0, height: '48px', fontSize: '1rem' }} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                            {['Order ID', 'Customer', 'Qty', 'Total', 'Payment', 'Status', 'Time', 'Screenshot'].map(h => (
                                <th key={h} style={{ padding: '0.85rem 0.75rem', textAlign: 'left', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && !loading && (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#9CA3AF', fontSize: '1rem' }}>No orders found matching filters.</td></tr>
                        )}
                        {filtered.map(o => (
                            <tr key={o.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'monospace' }}>#{o.id.split('-')[0].toUpperCase()}</td>
                                <td style={{ padding: '0.65rem 0.75rem' }}>
                                    <div style={{ fontWeight: 600 }}>{o.profiles?.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{o.profiles?.phone}</div>
                                </td>
                                <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>{o.quantity}x</td>
                                <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700 }}>₹{o.total_amount}</td>
                                <td style={{ padding: '0.65rem 0.75rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '100px', backgroundColor: (o as any).payment_method === 'cod' ? '#FEF3C7' : '#DCFCE7', color: (o as any).payment_method === 'cod' ? '#92400E' : '#166534' }}>
                                        {(o as any).payment_method === 'cod' ? 'COD' : 'Online'}
                                    </span>
                                </td>
                                <td style={{ padding: '0.65rem 0.75rem' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '100px', backgroundColor: statusColor[o.status] + '22', color: statusColor[o.status] || '#374151' }}>{o.status}</span>
                                </td>
                                <td style={{ padding: '0.65rem 0.75rem', color: '#6B7280', whiteSpace: 'nowrap' }}>
                                    {new Date(o.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td style={{ padding: '0.65rem 0.75rem' }}>
                                    {o.payment_screenshot_url ? (
                                        <a href={o.payment_screenshot_url} target="_blank" rel="noreferrer" style={{ color: '#3B82F6', fontWeight: 600, fontSize: '0.8rem' }}>View</a>
                                    ) : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {filtered.length >= PAGE_SIZE && (
                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                    <button className="btn btn-outline" onClick={() => setPage(p => p + 1)} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <ChevronDown size={16} /> {loading ? 'Loading…' : 'Load More'}
                    </button>
                </div>
            )}
        </div>
    );
};

// 3. SETTINGS VIEW
const SettingsView: React.FC<{ outOfStock: boolean, setOutOfStock: (v: boolean) => void, itemPrice: number, setItemPrice: (v: number) => void, deliveryCharge: number, setDeliveryCharge: (v: number) => void, qrCodeUrl: string | null, setQrCodeUrl: (v: string) => void, updateSetting: (k: string, v: any) => void }> = ({ outOfStock, setOutOfStock, itemPrice, setItemPrice, deliveryCharge, setDeliveryCharge, qrCodeUrl, setQrCodeUrl, updateSetting }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const ext = file.name.split('.').pop();
            const fileName = `qr-${Date.now()}.${ext}`;
            const adminClient = getSupabaseAdmin();
            const { error: upErr } = await adminClient.storage.from('qr-codes').upload(fileName, file, { upsert: true });
            if (upErr) throw upErr;
            const { data: { publicUrl } } = adminClient.storage.from('qr-codes').getPublicUrl(fileName);
            await adminClient.from('settings').upsert({ key: 'payment_config', value: { qr_code_url: publicUrl } }, { onConflict: 'key' });
            setQrCodeUrl(publicUrl);
            showToast('QR code updated — customers see it instantly!', { type: 'success' });
        } catch (err: any) {
            showToast('Upload failed: ' + err.message, { type: 'error' });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem', animation: 'fadeIn 0.3s ease' }}>
            <div className="card">
                <h2 className="mb-4">Store Configuration</h2>

                <div style={{ padding: '1.5rem', backgroundColor: outOfStock ? 'rgba(211, 47, 47, 0.1)' : 'rgba(46, 125, 50, 0.1)', borderRadius: 'var(--radius-md)', marginBottom: '2rem', border: `2px solid ${outOfStock ? 'var(--color-status-error)' : 'var(--color-status-success)'}`, transition: 'all 0.3s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.5rem', color: outOfStock ? 'var(--color-status-error)' : 'var(--color-status-success)' }}>{outOfStock ? 'STORE UNAVAILABLE' : 'STORE OPEN'}</h3>
                            <p style={{ margin: '0.25rem 0 0', color: '#6B7280', fontSize: '0.9rem' }}>Toggle affects all customer sessions globally in ~1 second.</p>
                        </div>
                        <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <input type="checkbox" checked={outOfStock} onChange={(e) => { setOutOfStock(e.target.checked); updateSetting('store_status', { is_open: true, out_of_stock: e.target.checked }); }} style={{ transform: 'scale(2)' }} />
                        </label>
                    </div>
                </div>

                <div className="input-group">
                    <label className="input-label" style={{ fontSize: '1.1rem' }}>Thali Price (₹)</label>
                    <input type="number" className="input-field" style={{ fontSize: '1.25rem' }} value={itemPrice} onChange={(e) => setItemPrice(Number(e.target.value))} onBlur={() => updateSetting('app_config', { name: 'Bite & Beans Café', item_price: itemPrice })} />
                </div>
                <div className="input-group" style={{ marginBottom: '0' }}>
                    <label className="input-label" style={{ fontSize: '1.1rem' }}>Delivery Charge (₹)</label>
                    <input type="number" className="input-field" style={{ fontSize: '1.25rem' }} value={deliveryCharge} onChange={(e) => setDeliveryCharge(Number(e.target.value))} onBlur={() => updateSetting('delivery_config', { charge: deliveryCharge })} />
                </div>
                <p style={{ margin: '0.5rem 0 0', color: '#6B7280', fontSize: '0.85rem' }}>Prices update live across all active customer checkout flows.</p>
            </div>

            <div className="card">
                <h2 className="mb-4">Payment & Café Info</h2>

                <div style={{ marginBottom: '2rem' }}>
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}><QrCode size={18} /> UPI Payment QR Code</label>
                    <p style={{ color: '#6B7280', fontSize: '0.9rem', marginBottom: '1rem' }}>Shown to customers choosing "Pay Online". Requires restart if deleted.</p>

                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', backgroundColor: '#F9FAFB', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid #E5E7EB' }}>
                        {qrCodeUrl ? (
                            <img src={qrCodeUrl} alt="Current QR" style={{ width: '120px', height: '120px', objectFit: 'contain', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', padding: '4px', backgroundColor: 'white' }} />
                        ) : (
                            <div style={{ width: '120px', height: '120px', backgroundColor: '#E5E7EB', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>No QR</div>
                        )}
                        <div style={{ flex: 1 }}>
                            <input type="file" ref={fileInputRef} accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFile} />
                            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                <Upload size={18} /> {uploading ? 'Uploading...' : qrCodeUrl ? 'Replace QR Code' : 'Upload QR Code'}
                            </button>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid #E5E7EB', paddingBottom: '0.5rem' }}>Café Information</h3>
                    <div style={{ backgroundColor: '#F9FAFB', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                        <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>Bite & Beans Café</p>
                        <p style={{ margin: '0 0 0.5rem', color: '#4B5563', fontSize: '0.95rem' }}>26, Madhavpura Mahadev Rd, Giridhar Nagar, Shahibag, Ahmedabad, Gujarat 380004</p>
                        <p style={{ margin: 0, color: '#4B5563', fontSize: '0.95rem' }}>Phone: 8128362706</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 4. CUSTOMERS VIEW
const CustomersView: React.FC = () => {
    const [customers, setCustomers] = useState<CustomerProfile[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { fetchCustomers(); }, []);

    const fetchCustomers = async () => {
        setLoading(true);
        const { data: profiles } = await getSupabaseAdmin().from('profiles').select('*').eq('role', 'user').order('created_at', { ascending: false });
        if (profiles) {
            const profileMap = new Map((profiles as CustomerProfile[]).map(p => [p.id, { ...p, order_count: 0, total_spent: 0 }]));

            const { data: orders } = await getSupabaseAdmin().from('orders').select('user_id, total_amount, status').neq('status', 'Cancelled').neq('status', 'Rejected');
            if (orders) {
                orders.forEach(o => {
                    const p = profileMap.get(o.user_id);
                    if (p) {
                        p.order_count! += 1;
                        p.total_spent! += Number(o.total_amount);
                    }
                });
            }
            setCustomers(Array.from(profileMap.values()));
        }
        setLoading(false);
    };

    const filtered = search.trim()
        ? customers.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase()))
        : customers;

    return (
        <div className="card" style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="flex justify-between items-center mb-4">
                <h2>Customer Base <span style={{ fontSize: '1rem', color: '#6B7280', fontWeight: 'normal', marginLeft: '0.5rem' }}>({customers.length} total)</span></h2>
            </div>

            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                <input className="input-field" placeholder="Search by customer name or phone…" style={{ paddingLeft: '2.5rem', margin: 0, height: '48px', fontSize: '1rem' }} value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {loading ? <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>Loading extensive customer data…</div> : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                                {['Name', 'Contact', 'Orders', 'Total Spent', 'Joined'].map(h => (
                                    <th key={h} style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#9CA3AF' }}>No customers found matching "{search}".</td></tr>}
                            {filtered.map(u => (
                                <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                    <td style={{ padding: '0.8rem 0.75rem', fontWeight: 600, color: '#111827' }}>{u.name || '—'}</td>
                                    <td style={{ padding: '0.8rem 0.75rem' }}>
                                        <a href={`tel:${u.phone}`} style={{ color: '#0288D1', fontWeight: 500, display: 'block' }}>{u.phone || '—'}</a>
                                    </td>
                                    <td style={{ padding: '0.8rem 0.75rem', fontWeight: 700 }}>{u.order_count || 0}</td>
                                    <td style={{ padding: '0.8rem 0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>₹{u.total_spent || 0}</td>
                                    <td style={{ padding: '0.8rem 0.75rem', color: '#6B7280', whiteSpace: 'nowrap' }}>
                                        {new Date(u.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// 4.5 STAFF VIEW
interface StaffProfile extends Omit<CustomerProfile, 'email'> { email: string; }
const StaffView: React.FC = () => {
    const [staff, setStaff] = useState<StaffProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', password: '', role: 'chef' });
    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchStaff(); }, []);

    const fetchStaff = async () => {
        setLoading(true);
        const adminAuth = getSupabaseAdmin().auth.admin;
        const { data: profiles } = await getSupabaseAdmin().from('profiles').select('*').neq('role', 'user').order('created_at', { ascending: false });
        // Getting actual emails securely from Auth table
        const { data: usersData } = await adminAuth.listUsers();

        if (profiles && usersData.users) {
            const userMap = new Map(usersData.users.map(u => [u.id, u.email]));
            const staffWithEmails = profiles.map(p => ({ ...p, email: userMap.get(p.id) || 'Unknown (Auth record missing)' }));
            setStaff(staffWithEmails as StaffProfile[]);
        }
        setLoading(false);
    };

    const handleCreateStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const adminAuth = getSupabaseAdmin().auth.admin;
            const { error } = await adminAuth.createUser({
                email: formData.email,
                password: formData.password,
                email_confirm: true,
                user_metadata: { name: formData.name, phone: formData.phone, role: formData.role }
            });
            if (error) throw error;
            showToast('Staff member created perfectly!', { type: 'success' });
            setShowModal(false);
            setFormData({ name: '', phone: '', email: '', password: '', role: 'chef' });
            fetchStaff();
        } catch (err: any) {
            showToast('Error creating staff: ' + err.message, { type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleRevoke = async (id: string, name: string) => {
        if (!window.confirm(`Revoke access for ${name}?\n\nThis permanently deletes their login credentials and completely removes them from the system.`)) return;
        await getSupabaseAdmin().from('profiles').delete().eq('id', id);
        const { error } = await getSupabaseAdmin().auth.admin.deleteUser(id);
        if (error) showToast('Error deleting user: ' + error.message, { type: 'error' });
        else {
            showToast(`${name}'s access has been perfectly revoked.`, { type: 'success' });
            fetchStaff();
        }
    };

    const roleColor: Record<string, { bg: string; text: string }> = {
        chef: { bg: '#FEF3C7', text: '#92400E' },
        delivery: { bg: '#DCFCE7', text: '#166534' },
        admin: { bg: '#F3E8FF', text: '#7E22CE' },
    };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="flex justify-between items-center mb-4 card" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex' }}>
                <div>
                    <h2 style={{ margin: 0 }}>Staff Management</h2>
                    <p style={{ margin: '0.25rem 0 0', color: '#6B7280', fontSize: '0.9rem' }}>Securely provision and revoke access to staff-only portals.</p>
                </div>
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setShowModal(true)}>
                    <UserPlus size={18} /> Add New Staff
                </button>
            </div>

            <div className="card">
                {loading ? <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>Loading staff deployment records...</div> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                                    {['Name', 'Role', 'Secure Login Email', 'Phone', 'Actions'].map(h => (
                                        <th key={h} style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {staff.map(u => {
                                    const rc = roleColor[u.role] || { bg: '#F3F4F6', text: '#374151' };
                                    return (
                                        <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                            <td style={{ padding: '0.8rem 0.75rem', fontWeight: 600, color: '#111827' }}>{u.name || '—'}</td>
                                            <td style={{ padding: '0.8rem 0.75rem' }}>
                                                <span style={{ backgroundColor: rc.bg, color: rc.text, padding: '0.25rem 0.6rem', borderRadius: '100px', fontWeight: 700, fontSize: '0.8rem', textTransform: 'capitalize' }}>{u.role}</span>
                                            </td>
                                            <td style={{ padding: '0.8rem 0.75rem', color: '#4B5563', fontFamily: 'monospace' }}>{u.email || '—'}</td>
                                            <td style={{ padding: '0.8rem 0.75rem', color: '#4B5563' }}>{u.phone || '—'}</td>
                                            <td style={{ padding: '0.8rem 0.75rem' }}>
                                                <button onClick={() => handleRevoke(u.id, u.name)} style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                                                    <Trash2 size={14} /> Revoke Access
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', animation: 'fadeIn 0.2s ease-out' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0 }}>Add New Staff</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="input-group">
                                <label className="input-label">Full Name</label>
                                <input required className="input-field" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label className="input-label">Login Email ID</label>
                                    <input required type="email" className="input-field" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                </div>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label className="input-label">Phone</label>
                                    <input required className="input-field" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Temporary Password</label>
                                <input required type="password" minLength={6} className="input-field" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Portal Role</label>
                                <select className="input-field" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                    <option value="chef">Chef Portal Access</option>
                                    <option value="delivery">Delivery Portal Access</option>
                                    <option value="admin">Super Admin Access</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Provisioning...' : 'Provision Access'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── MAIN APP CONTAINER ──────────────────────────────────────────────────────

const AdminDashboard: React.FC = () => {
    const { role, signOut } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'customers' | 'staff' | 'settings'>('dashboard');
    const [pendingOrders, setPendingOrders] = useState<OrderWithDetails[]>([]);
    const [stats, setStats] = useState({ revenue: 0, totalOrders: 0, pendingApprove: 0, activePipeline: 0 });
    const [loading, setLoading] = useState(true);
    const [bellCount, setBellCount] = useState(0);

    const [itemPrice, setItemPrice] = useState(119);
    const [deliveryCharge, setDeliveryCharge] = useState(20);
    const [outOfStock, setOutOfStock] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

    useEffect(() => {
        if (role && role !== 'admin') { navigate('/staff/login'); return; }
        const enableAudio = () => audioNotifier.initialize(true);
        document.addEventListener('click', enableAudio, { once: true });
        fetchData();

        const orderSub = supabase.channel('admin_orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    audioNotifier.playNotificationPattern();
                    setBellCount(c => c + 1);
                    showToast(`🛎️ New order placed!`, { type: 'info', duration: 6000 });
                }
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(orderSub);
            document.removeEventListener('click', enableAudio);
        };
    }, [role]);

    const fetchData = async () => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const { data: allToday } = await getSupabaseAdmin().from('orders').select('status, total_amount').gte('created_at', startOfToday.toISOString());
        if (allToday) {
            let r = 0, p = 0, a = 0;
            allToday.forEach(o => {
                if (o.status !== 'Cancelled' && o.status !== 'Rejected') r += Number(o.total_amount);
                if (o.status === 'Pending') p++;
                if (['Accepted', 'Preparing', 'Ready', 'Out for Delivery'].includes(o.status)) a++;
            });
            setStats({ revenue: r, totalOrders: allToday.length, pendingApprove: p, activePipeline: a });
        }

        const { data: pending } = await getSupabaseAdmin().from('orders')
            .select(`*, profiles!orders_user_id_fkey(name, phone), addresses(address_text, pincode)`)
            .eq('status', 'Pending').order('created_at', { ascending: true });
        if (pending) setPendingOrders(pending as OrderWithDetails[]);

        const { data: settings } = await getSupabaseAdmin().from('settings').select('*');
        if (settings) {
            settings.forEach(s => {
                if (s.key === 'app_config') setItemPrice(s.value.item_price);
                if (s.key === 'store_status') setOutOfStock(s.value.out_of_stock);
                if (s.key === 'delivery_config') setDeliveryCharge(s.value.charge);
                if (s.key === 'payment_config') setQrCodeUrl(s.value.qr_code_url || null);
            });
        }
        setLoading(false);
    };

    const updateSetting = async (key: string, value: any) => {
        await getSupabaseAdmin().from('settings').update({ value }).eq('key', key);
    };

    const handleAccept = async (order: OrderWithDetails) => {
        const suggestedCharge = deliveryCharge || 30;
        const customChargeInput = window.prompt(
            `Delivery charge for PIN ${order.addresses.pincode} (${order.addresses.address_text}):`,
            suggestedCharge.toString()
        );
        if (customChargeInput === null) return;
        const customDeliveryCharge = Number(customChargeInput) || 0;
        const thaliTotal = order.quantity * itemPrice;
        const newTotalAmount = thaliTotal + customDeliveryCharge;

        const { error } = await getSupabaseAdmin().from('orders').update({ status: 'Accepted', total_amount: newTotalAmount }).eq('id', order.id);
        if (!error) {
            setPendingOrders(prev => prev.filter(o => o.id !== order.id));
            fetchData(); // refresh stats immediately
            showToast('Order accepted successfully', { type: 'success' });
        } else {
            showToast('Failed to accept order: ' + error.message, { type: 'error' });
        }
    };

    const handleReject = async (order: OrderWithDetails) => {
        const reason = window.prompt(`Reason for rejecting order #${order.id.split('-')[0]}:`, 'Items sold out');
        if (reason === null) return;
        const { error } = await getSupabaseAdmin().from('orders').update({ status: 'Rejected', rejection_reason: reason }).eq('id', order.id);
        if (!error) {
            setPendingOrders(prev => prev.filter(o => o.id !== order.id));
            fetchData();
            showToast('Order rejected', { type: 'warning' });
        }
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' }}>
            <div style={{ textAlign: 'center' }}>
                <Shield size={48} color="var(--color-primary)" style={{ margin: '0 auto 1rem' }} />
                <p style={{ fontSize: '1.25rem', fontWeight: 600, color: '#374151' }}>Loading Super Admin Portal…</p>
            </div>
        </div>
    );

    const navBtnStyle = (tab: string): React.CSSProperties => ({
        padding: '0.75rem 1.25rem', fontWeight: 700, fontSize: '0.95rem', border: 'none', borderRadius: 'var(--radius-sm)',
        cursor: 'pointer', backgroundColor: activeTab === tab ? 'white' : 'transparent',
        color: activeTab === tab ? '#111827' : '#9CA3AF', display: 'flex', alignItems: 'center', gap: '0.5rem',
        transition: 'all 0.2s', whiteSpace: 'nowrap'
    });

    return (
        <div style={{ backgroundColor: '#F3F4F6', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Top Navigation Bar */}
            <header style={{ backgroundColor: '#111827', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                <div style={{ padding: '0 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '70px', maxWidth: 1600, margin: '0 auto', width: '100%' }}>
                    <h1 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'white', flexShrink: 0 }}>
                        <Shield size={24} color="var(--color-primary)" /> Super Admin
                    </h1>

                    <div style={{ display: 'flex', gap: '0.5rem', padding: '0 1rem', overflowX: 'auto' }}>
                        <button style={navBtnStyle('dashboard')} onClick={() => setActiveTab('dashboard')}>
                            <TrendingUp size={18} /> Dashboard
                        </button>
                        <button style={navBtnStyle('orders')} onClick={() => setActiveTab('orders')}>
                            <History size={18} /> All Orders
                        </button>
                        <button style={navBtnStyle('customers')} onClick={() => setActiveTab('customers')}>
                            <Users size={18} /> Customers
                        </button>
                        <button style={navBtnStyle('staff')} onClick={() => setActiveTab('staff')}>
                            <Briefcase size={18} /> Staff
                        </button>
                        <button style={navBtnStyle('settings')} onClick={() => setActiveTab('settings')}>
                            <Settings size={18} /> Settings
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexShrink: 0 }}>
                        <button onClick={() => setBellCount(0)} style={{ backgroundColor: bellCount > 0 ? 'var(--color-status-error)' : '#374151', border: 'none', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', transition: 'background-color 0.2s' }}>
                            <Bell size={18} /> {bellCount > 0 && bellCount}
                        </button>
                        <button className="btn btn-outline" style={{ borderColor: '#4B5563', color: '#D1D5DB' }} onClick={() => { signOut(); navigate('/staff'); }}>
                            <LogOut size={16} /> Logout
                        </button>
                    </div>
                </div>
            </header>

            <main style={{ padding: '2rem', flex: 1, maxWidth: 1600, margin: '0 auto', width: '100%' }}>
                {activeTab === 'dashboard' && <DashboardView stats={stats} pendingOrders={pendingOrders} itemPrice={itemPrice} deliveryCharge={deliveryCharge} onAccept={handleAccept} onReject={handleReject} />}
                {activeTab === 'orders' && <AllOrdersView />}
                {activeTab === 'customers' && <CustomersView />}
                {activeTab === 'staff' && <StaffView />}
                {activeTab === 'settings' && <SettingsView outOfStock={outOfStock} setOutOfStock={setOutOfStock} itemPrice={itemPrice} setItemPrice={setItemPrice} deliveryCharge={deliveryCharge} setDeliveryCharge={setDeliveryCharge} qrCodeUrl={qrCodeUrl} setQrCodeUrl={setQrCodeUrl} updateSetting={updateSetting} />}
            </main>
        </div>
    );
};

export default AdminDashboard;
