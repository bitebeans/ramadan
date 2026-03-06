import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { getCafeOrderNotificationUrl, getCustomerOrderPlacedUrl } from '../../lib/whatsapp';

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

    const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
    const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [fetchingData, setFetchingData] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    const totalAmount = (quantity * thaliPrice) + deliveryCharge;

    useEffect(() => {
        if (!session) {
            navigate('/login');
            return;
        }
        loadCheckoutData();

        // Listen to settings for live delivery charge or QR updates
        const subscription = supabase.channel('checkout_settings')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings' }, (payload) => {
                const setting = payload.new as { key: string, value: any };
                if (setting.key === 'delivery_config') setDeliveryCharge(setting.value.charge || 20);
                if (setting.key === 'payment_config') setQrCodeUrl(setting.value.qr_code_url || null);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [session]);

    const loadCheckoutData = async () => {
        setFetchingData(true);

        // Fetch Settings
        const { data: settingsData } = await supabase.from('settings').select('*').in('key', ['delivery_config', 'payment_config']);
        if (settingsData) {
            settingsData.forEach(s => {
                if (s.key === 'delivery_config') setDeliveryCharge(s.value.charge || 20);
                if (s.key === 'payment_config') setQrCodeUrl(s.value.qr_code_url || null);
            });
        }

        // Fetch Addresses
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
            user_id: session!.user.id,
            label: newLabel,
            address_text: newAddressText,
            pincode: newPincode,
            landmark: newLandmark || null
        }).select().single();

        if (!error && data) {
            setAddresses([data, ...addresses]);
            setSelectedAddressId(data.id);
            setShowNewAddress(false);
            // Reset form
            setNewAddressText(''); setNewPincode(''); setNewLandmark('');
        } else {
            setErrorMsg(error?.message || 'Failed to save address');
        }
        setLoading(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                setErrorMsg("File is too large. Maximum size is 5MB.");
                return;
            }
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                setErrorMsg("Only JPG, PNG and WebP images are allowed.");
                return;
            }

            setScreenshotFile(file);
            setErrorMsg('');

            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => setScreenshotPreview(e.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const placeOrder = async () => {
        if (!selectedAddressId || !screenshotFile) {
            setErrorMsg("Please select an address and upload payment screenshot.");
            return;
        }

        setLoading(true);
        setErrorMsg('');

        try {
            // 1. Upload Image
            const fileExt = screenshotFile.name.split('.').pop();
            const fileName = `${session!.user.id}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('payment-screenshots')
                .upload(fileName, screenshotFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('payment-screenshots')
                .getPublicUrl(fileName);

            // 2. Create Order Record
            const { data: orderData, error: orderError } = await supabase.from('orders').insert({
                user_id: session!.user.id,
                address_id: selectedAddressId,
                quantity,
                thali_price: thaliPrice,
                delivery_charge: deliveryCharge,
                total_amount: totalAmount,
                payment_screenshot_url: publicUrl,
                status: 'Pending'
            }).select().single();

            if (orderError) throw orderError;

            // 3. Trigger WhatsApp Messages using wa.me links
            const addressText = addresses.find(a => a.id === selectedAddressId)?.address_text || '';
            const cafeMessageUrl = getCafeOrderNotificationUrl(orderData.id.split('-')[0], profile!.name, profile!.phone, quantity, totalAmount, addressText);
            const customerMessageUrl = getCustomerOrderPlacedUrl(profile!.phone, orderData.id.split('-')[0], quantity, totalAmount);

            // Open WhatsApp links
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

    if (fetchingData) return <div>Loading checkout...</div>;

    return (
        <div className="ramadan-pattern" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <main className="container" style={{ padding: '2rem 1rem', flex: 1 }}>
                <h1 className="mb-6">Checkout</h1>

                {errorMsg && (
                    <div style={{ backgroundColor: 'var(--color-status-error)', color: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
                        {errorMsg}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {/* Left Column - Address */}
                    <div>
                        <div className="card mb-6">
                            <h2 className="mb-4">Delivery Address</h2>

                            {addresses.length > 0 && !showNewAddress && (
                                <div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                                        {addresses.map(addr => (
                                            <label key={addr.id} style={{ display: 'flex', gap: '1rem', padding: '1rem', border: '1px solid rgba(0,0,0,0.1)', justifyItems: 'center', borderRadius: 'var(--radius-sm)', cursor: 'pointer', backgroundColor: selectedAddressId === addr.id ? 'var(--color-surface-hover)' : 'transparent' }}>
                                                <input
                                                    type="radio"
                                                    name="address"
                                                    checked={selectedAddressId === addr.id}
                                                    onChange={() => setSelectedAddressId(addr.id)}
                                                    style={{ marginTop: '0.25rem' }}
                                                />
                                                <div>
                                                    <strong>{addr.label}</strong>
                                                    <p style={{ margin: 0, fontSize: '0.9rem' }}>{addr.address_text}</p>
                                                    <p style={{ margin: 0, fontSize: '0.9rem' }}>{addr.landmark ? `Landmark: ${addr.landmark}, ` : ''}PIN: {addr.pincode}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    <button className="btn btn-outline" onClick={() => setShowNewAddress(true)}>+ Add New Address</button>
                                </div>
                            )}

                            {showNewAddress && (
                                <form onSubmit={handleSaveAddress}>
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
                                    <div className="flex gap-4">
                                        <button type="submit" className="btn btn-primary" disabled={loading}>Save Address</button>
                                        {addresses.length > 0 && <button type="button" className="btn btn-outline" onClick={() => setShowNewAddress(false)}>Cancel</button>}
                                    </div>
                                </form>
                            )}
                        </div>

                        <div className="card">
                            <h2 className="mb-4">Order Summary</h2>
                            <div className="flex justify-between mb-2">
                                <span>Ramadan Special Thali (x{quantity})</span>
                                <span>₹{quantity * thaliPrice}</span>
                            </div>
                            <div className="flex justify-between mb-4 pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                                <span>Delivery Charge</span>
                                <span>₹{deliveryCharge}</span>
                            </div>
                            <div className="flex justify-between font-bold" style={{ fontSize: '1.25rem' }}>
                                <span>Total Amount</span>
                                <span style={{ color: 'var(--color-primary)' }}>₹{totalAmount}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Payment */}
                    <div>
                        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <h2 className="mb-4">Payment</h2>
                            <p className="mb-6">Please scan the QR code to pay <strong>₹{totalAmount}</strong> and upload a screenshot of the successful transaction.</p>

                            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                                {qrCodeUrl ? (
                                    <img src={qrCodeUrl} alt="UPI Payment QR Code" style={{ maxWidth: 200, border: '1px solid rgba(0,0,0,0.1)', padding: '0.5rem', borderRadius: 'var(--radius-md)' }} />
                                ) : (
                                    <div style={{ padding: '2rem', backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)' }}>
                                        No QR Code Available. Our admin will update this shortly.
                                    </div>
                                )}
                            </div>

                            <div className="input-group mt-auto" style={{ border: '2px dashed rgba(15, 76, 92, 0.2)', padding: '1.5rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                <input
                                    type="file"
                                    accept="image/jpeg, image/png, image/webp"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />

                                {screenshotPreview ? (
                                    <div>
                                        <img src={screenshotPreview} alt="Payment Preview" style={{ maxHeight: 150, marginBottom: '1rem', borderRadius: 'var(--radius-sm)' }} />
                                        <div>
                                            <button type="button" className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>Change Screenshot</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="mb-4">Upload payment screenshot here</p>
                                        <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>Select Image</button>
                                    </div>
                                )}
                            </div>

                            <button
                                className="btn btn-primary btn-huge"
                                style={{ marginTop: '2rem' }}
                                disabled={!selectedAddressId || !screenshotFile || loading}
                                onClick={placeOrder}
                            >
                                {loading ? 'Processing Order...' : 'Place Order'}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Checkout;
