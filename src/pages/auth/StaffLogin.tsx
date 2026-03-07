import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';

const StaffLogin: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        // Super Admin Bypass — skip Supabase Auth entirely
        const superPwd = import.meta.env.VITE_SUPERADMIN_PASSWORD;
        if ((email === 'admin' || email === 'admin@biteandbeans.com') && superPwd) {
            if (password !== superPwd) {
                setErrorMsg('Invalid Super Admin credentials');
                setLoading(false);
                return;
            }
            // Credentials matched — go straight to admin dashboard
            setLoading(false);
            navigate('/staff/admin');
            return;
        }

        // Regular staff login via Supabase Auth
        const { error, data } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setErrorMsg(error.message);
            setLoading(false);
            return;
        }

        if (data.user) {
            // Fetch role to redirect to correct dashboard
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            if (profile) {
                if (profile.role === 'admin') navigate('/staff/admin');
                else if (profile.role === 'chef') navigate('/staff/chef');
                else if (profile.role === 'delivery') navigate('/staff/delivery');
                else {
                    await supabase.auth.signOut();
                    setErrorMsg('Unauthorized access. Customers must login via Customer Portal.');
                }
            }
        }
        setLoading(false);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-primary)' }}>
            <main className="container flex-col items-center justify-center p-4" style={{ flex: 1 }}>
                <div className="card" style={{ maxWidth: 400, width: '100%', margin: '0 auto' }}>
                    <div className="flex justify-center mb-4">
                        <div style={{ backgroundColor: 'var(--color-primary-light)', padding: '1rem', borderRadius: '50%' }}>
                            <Shield size={32} color="white" />
                        </div>
                    </div>
                    <h2 className="text-center mb-2" style={{ fontSize: '2rem' }}>Staff Portal</h2>
                    <p className="text-center mb-6 text-muted">Bite & Beans Authorised Personnel Only</p>

                    {errorMsg && (
                        <div style={{ backgroundColor: 'var(--color-status-error)', color: 'white', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                            {errorMsg}
                        </div>
                    )}

                    <form onSubmit={handleLogin}>
                        <div className="input-group">
                            <label className="input-label">Staff Email</label>
                            <input
                                type="email"
                                className="input-field"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Password</label>
                            <input
                                type="password"
                                className="input-field"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                            />
                        </div>

                        {/* Extremely large button for staff requirement */}
                        <button
                            type="submit"
                            className="btn btn-primary btn-huge mb-4"
                            disabled={loading}
                            style={{ marginTop: '1rem' }}
                        >
                            {loading ? 'Authenticating...' : 'Secure Login'}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default StaffLogin;
