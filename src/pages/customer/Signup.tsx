import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';

const Signup: React.FC = () => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        // Phone validation strictly requested for digits only to use with wa.me safely
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
            setErrorMsg('Please enter a valid phone number with country code (e.g. 919876543210).');
            setLoading(false);
            return;
        }

        const { error, data } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    phone: cleanPhone,
                    role: 'user'
                }
            }
        });

        if (error) {
            setErrorMsg(error.message);
        } else if (data.user) {
            navigate('/menu');
        }
        setLoading(false);
    };

    return (
        <div className="ramadan-pattern" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <main className="container flex-col items-center justify-center" style={{ flex: 1, padding: '2rem 1rem' }}>
                <div className="card" style={{ maxWidth: 450, width: '100%', margin: '0 auto' }}>
                    <h2 className="text-center mb-6" style={{ fontSize: '2rem' }}>Create Account</h2>
                    <p className="text-center mb-6 text-muted">Join Bite & Beans for quick iftar orders.</p>

                    {errorMsg && (
                        <div style={{ backgroundColor: 'var(--color-status-error)', color: 'white', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                            {errorMsg}
                        </div>
                    )}

                    <form onSubmit={handleSignup}>
                        <div className="input-group">
                            <label className="input-label">Full Name</label>
                            <input
                                type="text"
                                className="input-field"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Muhammad Ali"
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Phone Number (with Country Code)</label>
                            <input
                                type="tel"
                                className="input-field"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="919876543210"
                            />
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Required for WhatsApp updates. No + sign.</span>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Email Address</label>
                            <input
                                type="email"
                                className="input-field"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
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
                                placeholder="••••••••"
                                minLength={6}
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary btn-huge mb-4"
                            disabled={loading}
                            style={{ marginTop: '1rem' }}
                        >
                            {loading ? 'Creating Account...' : 'Sign Up'}
                        </button>
                    </form>

                    <p className="text-center" style={{ marginTop: '1rem', fontSize: '0.95rem' }}>
                        Already have an account? <Link to="/login" style={{ textDecoration: 'underline' }}>Login</Link>
                    </p>
                </div>
            </main>
        </div>
    );
};

export default Signup;
