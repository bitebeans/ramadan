import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

// Customer Portal
import Menu from './pages/customer/Menu';
import Login from './pages/customer/Login';
import Signup from './pages/customer/Signup';
import Checkout from './pages/customer/Checkout';
import Orders from './pages/customer/Orders';

// Staff Portals
import StaffLogin from './pages/auth/StaffLogin';
import AdminDashboard from './pages/admin/Dashboard';
import ChefDashboard from './pages/chef/Dashboard';
import DeliveryDashboard from './pages/delivery/Dashboard';

// Context
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Customer Routes */}
          <Route path="/" element={<Navigate to="/menu" replace />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />

          {/* Staff Auth (Shared) */}
          <Route path="/staff" element={<Navigate to="/staff/login" replace />} />
          <Route path="/staff/login" element={<StaffLogin />} />

          {/* Staff Portal Routes (role-based) */}
          <Route path="/staff/admin" element={<AdminDashboard />} />
          <Route path="/staff/chef" element={<ChefDashboard />} />
          <Route path="/staff/delivery" element={<DeliveryDashboard />} />

          {/* Legacy redirects — keep old links/bookmarks working */}
          <Route path="/admin" element={<Navigate to="/staff/admin" replace />} />
          <Route path="/chef" element={<Navigate to="/staff/chef" replace />} />
          <Route path="/delivery" element={<Navigate to="/staff/delivery" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
