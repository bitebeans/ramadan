/// <reference types="node" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Ensure your .env file is configured correctly.');
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
);

export type UserRole = 'user' | 'chef' | 'delivery' | 'admin';

export type Profile = {
    id: string;
    name: string;
    phone: string;
    role: UserRole;
    created_at: string;
};

export type OrderStatus = 'Pending' | 'Accepted' | 'Rejected' | 'Preparing' | 'Ready' | 'Out for Delivery' | 'Delivered' | 'Cancelled';

export type Order = {
    id: string;
    user_id: string;
    address_id: string;
    quantity: number;
    thali_price: number;
    delivery_charge: number;
    total_amount: number;
    status: OrderStatus;
    payment_screenshot_url: string;
    is_payment_verified: boolean;
    rejection_reason: string | null;
    assigned_delivery_partner: string | null;
    created_at: string;
    updated_at: string;
};

// Admin Client (Only use in Admin Dashboard context)
export const getSupabaseAdmin = () => {
    const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
        throw new Error('VITE_SUPABASE_SERVICE_ROLE_KEY missing - Admin operations require this.');
    }
    return createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
};
