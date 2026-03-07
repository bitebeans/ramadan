import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { getCafeOrderNotificationUrl, getCustomerOrderPlacedUrl } from '../../lib/whatsapp';
import { showToast } from '../../lib/toast';

interface Address {
    id: string;
    label: string;
    address_text: string;
    pincode: string;
    landmark: string | null;
}

const Checkout: React.FC = () => {
    const { session, profile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const quantity = location.state?.quantity || 1;
    const thaliPrice = location.state?.price || 119;

    const [deliveryCharge, setDeliveryCharge] = useState(20);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<string>('');

    // New address form
    const [showNewAddress, setShowNewAddress] = useState(false);
    const [newLabel, setNewLabel] = useState('Home');
    const [newAddressText, setNewAddressText] = useState('');
    const [newPincode, setNewPincode] = useState('');
    const [newLandmark, setNewLandmark] = useState('');

    // Payment Selection
    const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
    const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
    const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [fetchingData, setFetchingData] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    const totalAmount = (quantity * thaliPrice) + deliveryCharge;

    useEffect(() => {
        if (!session) { navigate('/login'); return; }
        loadCheckoutData();

        const subscription = supabase.channel('checkout_settings')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings' }, (payload) => {
                const setting = payload.new as { key: string, value: any };
                if (setting.key === 'delivery_config') setDeliveryCharge(setting.value.charge || 20);
                if (setting.key === 'payment_config') setQrCodeUrl(setting.value.qr_code_url || null);
            }).subscribe();

        return () => { supabase.removeChannel(subscription); };
    }, [session]);

    const loadCheckoutData = async () => {
        setFetchingData(true);
        const { data: settingsData } = await supabase.from('settings').select('*').in('key', ['delivery_config', 'payment_config']);
        if (settingsData) {
            settingsData.forEach(s => {
                if (s.key === 'delivery_config') setDeliveryCharge(s.value.charge || 20);
                if (s.key === 'payment_config') setQrCodeUrl(s.value.qr_code_url || null);
            });
        }
        const { data: addressData } = await supabase.from('addresses').select('*').order('created_at', { ascending: false });
        if (addressData && addressData.length > 0) {
            setAddresses(addressData);
            setSelectedAddressId(addressData[0].id);
        } else {
            setShowNewAddress(true);
        }
        setFetchingData(false);
    };

    const handleSaveAddress = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { data, error } = await supabase.from('addresses').insert({
            user_id: session!.user.id, label: newLabel, address_text: newAddressText, pincode: newPincode, landmark: newLandmark || null
        }).select().single();

        if (!error && data) {
            setAddresses([data, ...addresses]);
            setSelectedAddressId(data.id);
            setShowNewAddress(false);
            setNewAddressText(''); setNewPincode(''); setNewLandmark('');
        } else {
            setErrorMsg(error?.message || 'Failed to save address');
        }
        setLoading(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) return setErrorMsg("File too large (max 5MB).");
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setErrorMsg("Only JPG/PNG/WebP allowed.");
            setScreenshotFile(file);
            setErrorMsg('');
            const reader = new FileReader();
            reader.onload = (e) => setScreenshotPreview(e.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const placeOrder = async () => {
        if (!selectedAddressId) return setErrorMsg("Please select an address.");
        if (paymentMethod === 'online' && !screenshotFile) return setErrorMsg("Please upload payment screenshot.");

        setLoading(true);
        setErrorMsg('');

        try {
            let publicUrl = null;

            if (paymentMethod === 'online' && screenshotFile) {
                const fileExt = screenshotFile.name.split('.').pop();
                const fileName = `${session!.user.id}-${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('payment-screenshots').upload(fileName, screenshotFile);
                if (uploadError) throw uploadError;
                const { data } = supabase.storage.from('payment-screenshots').getPublicUrl(fileName);
                publicUrl = data.publicUrl;
            }

            const { data: orderData, error: orderError } = await supabase.from('orders').insert({
                user_id: session!.user.id,
                address_id: selectedAddressId,
                quantity,
                thali_price: thaliPrice,
                delivery_charge: deliveryCharge,
                total_amount: totalAmount,
                payment_screenshot_url: publicUrl,
                payment_method: paymentMethod, // new db field
                status: 'Pending'
            }).select().single();

            if (orderError) throw orderError;

            showToast('Order placed successfully!', { type: 'success' });

            const addressText = addresses.find(a => a.id === selectedAddressId)?.address_text || '';
            const cafeMessageUrl = getCafeOrderNotificationUrl(orderData.id.split('-')[0], profile!.name, profile!.phone, quantity, totalAmount, addressText);
            const customerMessageUrl = getCustomerOrderPlacedUrl(profile!.phone, orderData.id.split('-')[0], quantity, totalAmount);

            window.open(cafeMessageUrl, '_blank');
            setTimeout(() => {
                window.open(customerMessageUrl, '_blank');
                navigate('/orders');
            }, 500);

        } catch (error: any) {
            console.error(error);
            setErrorMsg(error.message || "An error occurred placing your order.");
            setLoading(false);
        }
    };

    if (fetchingData) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: '1.25rem', fontWeight: 600, color: '#374151' }}>Loading checkout…</p>
        </div>
    );

    return (
        <div className="ramadan-pattern" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <main className="container" style={{ padding: '2rem 1rem', flex: 1, maxWidth: 1000, margin: '0 auto' }}>
                <h1 className="mb-6">Checkout</h1>
                {errorMsg && <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #EF4444', color: '#B91C1C', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontWeight: 600 }}>{errorMsg}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem', alignItems: 'start' }}>
                    {/* Left Column - Address & Summary */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className="card">
                            <h2 className="mb-4">Delivery Address</h2>
                            {addresses.length > 0 && !showNewAddress && (
                                <div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                                        {addresses.map(addr => (
                                            <label key={addr.id} style={{ display: 'flex', gap: '1rem', padding: '1.25rem', border: '2px solid', borderColor: selectedAddressId === addr.id ? 'var(--color-primary)' : '#E5E7EB', borderRadius: 'var(--radius-md)', cursor: 'pointer', backgroundColor: selectedAddressId === addr.id ? '#F0F9FF' : 'white', transition: 'all 0.2s' }}>
                                                <input type="radio" name="address" checked={selectedAddressId === addr.id} onChange={() => setSelectedAddressId(addr.id)} style={{ marginTop: '0.25rem', transform: 'scale(1.2)' }} />
                                                <div>
                                                    <strong style={{ fontSize: '1.1rem', display: 'block', marginBottom: '0.25rem' }}>{addr.label}</strong>
                                                    <p style={{ margin: 0, fontSize: '0.95rem', color: '#4B5563', lineHeight: 1.4 }}>{addr.address_text}</p>
                                                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#6B7280' }}>{addr.landmark ? `Landmark: ${addr.landmark}, ` : ''}PIN: {addr.pincode}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => setShowNewAddress(true)}>+ Add New Address</button>
                                </div>
                            )}

                            {showNewAddress && (
                                <form onSubmit={handleSaveAddress} style={{ backgroundColor: '#F9FAFB', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid #E5E7EB' }}>
                                    <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>New Address</h3>
                                    <div className="input-group">
                                        <label className="input-label">Label (e.g. Home, Office)</label>
                                        <input type="text" className="input-field" required value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Complete Address</label>
                                        <textarea className="input-field" required rows={3} value={newAddressText} onChange={(e) => setNewAddressText(e.target.value)}></textarea>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <div className="input-group" style={{ flex: 1 }}>
                                            <label className="input-label">Pincode</label>
                                            <input type="text" className="input-field" required value={newPincode} onChange={(e) => setNewPincode(e.target.value)} />
                                        </div>
                                        <div className="input-group" style={{ flex: 1 }}>
                                            <label className="input-label">Landmark (Optional)</label>
                                            <input type="text" className="input-field" value={newLandmark} onChange={(e) => setNewLandmark(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="flex gap-4" style={{ marginTop: '1.5rem' }}>
                                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>Save</button>
                                        {addresses.length > 0 && <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowNewAddress(false)}>Cancel</button>}
                                    </div>
                                </form>
                            )}
                        </div>

                        <div className="card">
                            <h2 className="mb-4">Order Summary</h2>
                            <div className="flex justify-between mb-2">
                                <span style={{ color: '#374151', fontSize: '1.1rem' }}>Ramadan Special Thali (x{quantity})</span>
                                <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>₹{quantity * thaliPrice}</span>
                            </div>
                            <div className="flex justify-between mb-4 pb-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
                                <span style={{ color: '#6B7280' }}>Delivery Charge</span>
                                <span style={{ fontWeight: 600 }}>₹{deliveryCharge}</span>
                            </div>
                            <div className="flex justify-between font-bold" style={{ fontSize: '1.5rem' }}>
                                <span>Total Amount</span>
                                <span style={{ color: 'var(--color-primary)' }}>₹{totalAmount}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Payment Method */}
                    <div>
                        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                            <h2 className="mb-4">Payment Method</h2>

                            {/* Payment Selector */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', border: '2px solid', borderColor: paymentMethod === 'online' ? 'var(--color-primary)' : '#E5E7EB', borderRadius: 'var(--radius-md)', cursor: 'pointer', backgroundColor: paymentMethod === 'online' ? '#F0F9FF' : 'white', transition: 'all 0.2s' }}>
                                    <input type="radio" name="payment" checked={paymentMethod === 'online'} onChange={() => setPaymentMethod('online')} style={{ transform: 'scale(1.2)' }} />
                                    <div>
                                        <strong style={{ fontSize: '1.1rem', display: 'block', color: paymentMethod === 'online' ? 'var(--color-primary)' : '#374151' }}>Pay Online (UPI)</strong>
                                        <span style={{ fontSize: '0.85rem', color: '#6B7280' }}>Scan QR & upload screenshot</span>
                                    </div>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', border: '2px solid', borderColor: paymentMethod === 'cod' ? '#F59E0B' : '#E5E7EB', borderRadius: 'var(--radius-md)', cursor: 'pointer', backgroundColor: paymentMethod === 'cod' ? '#FFFBEB' : 'white', transition: 'all 0.2s' }}>
                                    <input type="radio" name="payment" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} style={{ transform: 'scale(1.2)' }} />
                                    <div>
                                        <strong style={{ fontSize: '1.1rem', display: 'block', color: paymentMethod === 'cod' ? '#B45309' : '#374151' }}>Cash on Delivery</strong>
                                        <span style={{ fontSize: '0.85rem', color: '#6B7280' }}>Pay when your food arrives</span>
                                    </div>
                                </label>
                            </div>

                            {/* Dynamic Content based on selection */}
                            <div style={{ backgroundColor: '#F9FAFB', borderRadius: 'var(--radius-md)', border: '1px solid #E5E7EB', padding: '1.5rem', marginBottom: '2rem', minHeight: '340px' }}>
                                {paymentMethod === 'online' ? (
                                    <>
                                        <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#374151' }}>Pay <strong>₹{totalAmount}</strong> via UPI</p>
                                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                            {qrCodeUrl ? (
                                                <img src={qrCodeUrl} alt="UPI Payment QR Code" style={{ width: '180px', height: '180px', objectFit: 'contain', border: '1px solid rgba(0,0,0,0.1)', padding: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'white' }} />
                                            ) : (
                                                <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5E7EB', borderRadius: 'var(--radius-md)', color: '#6B7280' }}>No QR Available</div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <input type="file" accept="image/jpeg, image/png, image/webp" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                                            {screenshotPreview ? (
                                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                                    <img src={screenshotPreview} alt="Preview" style={{ height: '80px', borderRadius: 'var(--radius-sm)', border: '2px solid var(--color-primary)' }} />
                                                    <button type="button" onClick={() => fileInputRef.current?.click()} style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', backgroundColor: 'white', border: '1px solid #E5E7EB', padding: '0.2rem 0.5rem', borderRadius: '100px', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Change Image</button>
                                                </div>
                                            ) : (
                                                <button type="button" className="btn btn-outline" style={{ width: '100%' }} onClick={() => fileInputRef.current?.click()}>Upload Payment Screenshot</button>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💵</div>
                                        <h3 style={{ color: '#92400E', margin: '0 0 0.5rem', fontSize: '1.4rem' }}>Cash on Delivery chosen</h3>
                                        <p style={{ color: '#6B7280', margin: 0, lineHeight: 1.5 }}>Our delivery partner will collect <strong>₹{totalAmount}</strong> from you upon arrival.</p>
                                    </div>
                                )}
                            </div>

                            <button className="btn btn-huge" style={{ width: '100%', backgroundColor: paymentMethod === 'cod' ? '#F59E0B' : 'var(--color-primary)', color: 'white', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }} disabled={!selectedAddressId || (paymentMethod === 'online' && !screenshotFile) || loading} onClick={placeOrder}>
                                {loading ? 'Processing...' : 'Place Order Now'}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Checkout;
