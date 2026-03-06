import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { Plus, Minus, ShoppingBag } from 'lucide-react';

const Menu: React.FC = () => {
    const { session } = useAuth();
    const navigate = useNavigate();

    const [price, setPrice] = useState<number>(119);
    const [outOfStock, setOutOfStock] = useState<boolean>(false);
    const [isOpen, setIsOpen] = useState<boolean>(true);
    const [quantity, setQuantity] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        fetchSettings();

        // Subscribe to realtime changes on settings
        const subscription = supabase.channel('settings_changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings' }, (payload) => {
                applySetting(payload.new as { key: string, value: any });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    const applySetting = (setting: { key: string, value: any }) => {
        if (setting.key === 'app_config') setPrice(setting.value.item_price || 119);
        if (setting.key === 'store_status') {
            setOutOfStock(setting.value.out_of_stock || false);
            setIsOpen(setting.value.is_open !== false);
        }
    };

    const fetchSettings = async () => {
        setLoading(true);
        const { data } = await supabase.from('settings').select('*');
        if (data) {
            data.forEach(applySetting);
        }
        setLoading(false);
    };

    const handleIncrement = () => {
        if (quantity < 10) setQuantity(prev => prev + 1);
    };

    const handleDecrement = () => {
        if (quantity > 1) setQuantity(prev => prev - 1);
    };

    const handleCheckout = () => {
        if (!session) {
            navigate('/login');
            return;
        }
        // Navigate to checkout passing quantity
        navigate('/checkout', { state: { quantity, price } });
    };

    if (loading) {
        return (
            <div className="ramadan-pattern" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <Navbar />
                <main className="container flex items-center justify-center" style={{ flex: 1 }}>
                    <p>Loading Menu...</p>
                </main>
            </div>
        );
    }

    return (
        <div className="ramadan-pattern" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <main className="container" style={{ padding: '2rem 1rem', flex: 1 }}>
                <header className="text-center mb-8">
                    <h1 style={{ fontSize: '2.5rem' }}>Our Ramadan Special</h1>
                    <p style={{ fontSize: '1.2rem' }}>Authentic Iftari Thali prepared freshly every day.</p>
                </header>

                {(!isOpen || outOfStock) && (
                    <div style={{ backgroundColor: 'var(--color-status-error)', color: 'white', padding: '1.5rem', borderRadius: 'var(--radius-md)', textAlign: 'center', marginBottom: '2rem' }}>
                        <h3 style={{ color: 'white', margin: 0 }}>Temporarily Unavailable</h3>
                        <p style={{ color: 'rgba(255,255,255,0.9)', margin: 0 }}>{outOfStock ? 'We are sold out for today!' : 'The cafe is currently closed.'}</p>
                    </div>
                )}

                <div className="card" style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>

                    {/* Image/Visual Placeholder for Thali */}
                    <div style={{ flex: '1 1 300px', backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)', padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '250px' }}>
                        <div style={{ fontSize: '6rem' }}>🍽️</div>
                    </div>

                    <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column' }}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--color-text-main)' }}>Iftari Thali</h2>
                            <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>₹{price}</span>
                        </div>

                        <p className="mb-4">A complete traditional Iftari experience including:</p>

                        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '2rem' }}>
                            <li>🫘 Dates</li>
                            <li>🍌 Banana</li>
                            <li>🥭 Papaya</li>
                            <li>🍉 Watermelon</li>
                            <li>🥛 Milk</li>
                            <li>🥤 Mohobat Sharabat</li>
                            <li>🍟 Fries</li>
                            <li>🥙 Bhaji</li>
                            <li>🥚 Boiled Egg</li>
                        </ul>

                        <div style={{ marginTop: 'auto' }}>
                            <div className="flex items-center justify-between mb-4 p-4" style={{ backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)' }}>
                                <span style={{ fontWeight: 600 }}>Select Quantity (Max 10)</span>
                                <div className="flex items-center gap-4">
                                    <button className="btn" style={{ padding: '0.5rem', backgroundColor: 'var(--color-surface)', border: '1px solid rgba(0,0,0,0.1)' }} onClick={handleDecrement} disabled={!isOpen || outOfStock}>
                                        <Minus size={20} />
                                    </button>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 700, width: '2rem', textAlign: 'center' }}>{quantity}</span>
                                    <button className="btn" style={{ padding: '0.5rem', backgroundColor: 'var(--color-surface)', border: '1px solid rgba(0,0,0,0.1)' }} onClick={handleIncrement} disabled={!isOpen || outOfStock}>
                                        <Plus size={20} />
                                    </button>
                                </div>
                            </div>

                            <button
                                className="btn btn-primary btn-huge"
                                onClick={handleCheckout}
                                disabled={!isOpen || outOfStock}
                            >
                                <ShoppingBag size={24} />
                                Checkout • ₹{price * quantity}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Menu;
