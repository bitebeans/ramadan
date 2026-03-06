import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LogIn } from 'lucide-react';

export const Navbar: React.FC = () => {
    const { session, profile, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const isStaff = profile?.role && ['admin', 'chef', 'delivery'].includes(profile.role);
    return (
        <header className="navbar" style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-light)',
            padding: '1rem',
            boxShadow: 'var(--shadow-sm)',
            position: 'sticky',
            top: 0,
            zIndex: 100
        }}>
            <div className="container flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2" style={{ color: 'var(--color-secondary)' }}>
                    <h2 style={{ color: 'var(--color-secondary)', margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🌙 <span style={{ fontFamily: 'var(--font-heading)' }}>Bite & Beans</span>
                    </h2>
                </Link>

                {session ? (
                    <div className="flex items-center gap-4">
                        <span style={{ fontSize: '0.9rem', opacity: 0.9 }} className="hidden md:inline">
                            Salaam, {profile?.name || 'User'}
                        </span>

                        {/* Show specific navigation based on role */}
                        {!isStaff && (
                            <>
                                <Link to="/menu" style={{ color: location.pathname === '/menu' ? 'var(--color-secondary)' : 'white' }}>Menu</Link>
                                <Link to="/orders" style={{ color: location.pathname === '/orders' ? 'var(--color-secondary)' : 'white' }}>My Orders</Link>
                            </>
                        )}

                        <button onClick={handleSignOut} className="btn" style={{ padding: '0.5rem', color: 'white' }} title="Logout">
                            <LogOut size={20} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <Link to="/login" className="flex items-center gap-2" style={{ color: 'white' }}>
                            <LogIn size={20} /> Login
                        </Link>
                    </div>
                )}
            </div>
        </header>
    );
};
