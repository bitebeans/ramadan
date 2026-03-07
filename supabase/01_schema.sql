-- 01_schema.sql
-- Create Enum for Roles
CREATE TYPE user_role AS ENUM ('user', 'chef', 'delivery', 'admin');

-- Create Enum for Order Status
CREATE TYPE order_status AS ENUM ('Pending', 'Accepted', 'Rejected', 'Preparing', 'Ready', 'Out for Delivery', 'Delivered', 'Cancelled');

-- Profiles Table (Extends Supabase Auth Users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role user_role DEFAULT 'user'::user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Addresses Table
CREATE TABLE addresses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    label TEXT NOT NULL, -- e.g., 'Home', 'Work'
    address_text TEXT NOT NULL,
    pincode TEXT NOT NULL,
    landmark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Settings Table (Key-Value Store)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Orders Table
CREATE TABLE orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE RESTRICT NOT NULL,
    address_id UUID REFERENCES addresses(id) ON DELETE RESTRICT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 10),
    thali_price DECIMAL(10, 2) NOT NULL,
    delivery_charge DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status order_status DEFAULT 'Pending'::order_status NOT NULL,
    payment_method TEXT DEFAULT 'online' NOT NULL,
    payment_screenshot_url TEXT,
    is_payment_verified BOOLEAN DEFAULT FALSE NOT NULL,
    rejection_reason TEXT,
    assigned_delivery_partner UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Order Status History Table (Audit Trail)
CREATE TABLE order_status_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    status order_status NOT NULL,
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER addresses_updated_at
BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER settings_updated_at
BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER orders_updated_at
BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Trigger for Profile Creation on User Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, role)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'name', 
    new.raw_user_meta_data->>'phone',
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'user'::user_role)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql security definer;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger for Order Status History
CREATE OR REPLACE FUNCTION record_order_status_change()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' OR OLD.status <> NEW.status THEN
        INSERT INTO order_status_history (order_id, status, changed_by)
        VALUES (
            NEW.id, 
            NEW.status, 
            auth.uid() -- Automatically captures the user making the change
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql security definer;

CREATE TRIGGER on_order_status_change
    AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW EXECUTE PROCEDURE record_order_status_change();
