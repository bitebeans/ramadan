import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        const { error, data } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setErrorMsg(error.message);
        } else if (data.user) {
            // Validate role - ensure staff don't log in here accidentally? Actually Supabase handles roles post login. We just redirect.
            navigate('/menu');
        }
        setLoading(false);
    };

    return (
        <div className="ramadan-pattern" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <main className="container flex-col items-center justify-center" style={{ flex: 1, padding: '2rem 1rem' }}>
                <div className="card" style={{ maxWidth: 400, width: '100%', margin: '0 auto' }}>
                    <h2 className="text-center mb-6" style={{ fontSize: '2rem' }}>Welcome Back</h2>
                    <p className="text-center mb-6 text-muted">Sign in to order your Ramadan Special Thali.</p>

                    {errorMsg && (
                        <div style={{ backgroundColor: 'var(--color-status-error)', color: 'white', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                            {errorMsg}
                        </div>
                    )}

                    <form onSubmit={handleLogin}>
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
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary btn-huge mb-4"
                            disabled={loading}
                            style={{ marginTop: '1rem' }}
                        >
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>

                    <p className="text-center" style={{ marginTop: '1rem', fontSize: '0.95rem' }}>
                        Don't have an account? <Link to="/signup" style={{ textDecoration: 'underline' }}>Sign up</Link>
                    </p>
                </div>
            </main>
        </div>
    );
};

export default Login;
