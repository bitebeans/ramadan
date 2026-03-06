-- 02_rls_policies.sql

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- PROFILES POLICIES
-- --------------------------------------------------------
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Staff can read all profiles
CREATE POLICY "Staff can read all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('chef', 'delivery', 'admin')
        )
    );

-- Admin can update roles
CREATE POLICY "Admin can update profiles" ON profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
       )
   );

-- --------------------------------------------------------
-- ADDRESSES POLICIES
-- --------------------------------------------------------
-- Users can read, insert, update, and delete their own addresses
CREATE POLICY "Users can manage own addresses" ON addresses
    FOR ALL USING (auth.uid() = user_id);

-- Staff can read all addresses (needed for deliveries)
CREATE POLICY "Staff can read all addresses" ON addresses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('chef', 'delivery', 'admin')
        )
    );

-- --------------------------------------------------------
-- SETTINGS POLICIES
-- --------------------------------------------------------
-- Anyone (including public) can read settings
CREATE POLICY "Anyone can read settings" ON settings
    FOR SELECT USING (true); -- Requires anon key or authenticated access

-- Only Admin can update settings
CREATE POLICY "Admin can update settings" ON settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
       )
    );

-- Only Admin can insert settings
CREATE POLICY "Admin can insert settings" ON settings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
       )
    );

-- --------------------------------------------------------
-- ORDERS POLICIES
-- --------------------------------------------------------
-- Users can read their own orders
CREATE POLICY "Users can read own orders" ON orders
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own orders
CREATE POLICY "Users can insert own orders" ON orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update (cancel) their own orders if status is Pending
CREATE POLICY "Users can cancel pending orders" ON orders
    FOR UPDATE USING (
        auth.uid() = user_id AND status = 'Pending'
    ) WITH CHECK (
        status = 'Cancelled'
    );

-- Staff can read all orders
CREATE POLICY "Staff can read all orders" ON orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('chef', 'delivery', 'admin')
        )
    );

-- Chef can update status
CREATE POLICY "Chef can update orders" ON orders
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'chef'
        )
    );

-- Delivery can update status
CREATE POLICY "Delivery can update orders" ON orders
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'delivery'
        )
    );

-- Admin can manage all aspects of orders
CREATE POLICY "Admin can manage all orders" ON orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- --------------------------------------------------------
-- ORDER_STATUS_HISTORY POLICIES
-- --------------------------------------------------------
-- Users can read History of their orders
CREATE POLICY "Users can read own order history" ON order_status_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders WHERE id = order_id AND user_id = auth.uid()
        )
    );

-- Staff can read all history
CREATE POLICY "Staff can read all order history" ON order_status_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('chef', 'delivery', 'admin')
        )
    );

-- (Insert is handled completely via Trigger with security definer, so no insert policy needed for general users)
