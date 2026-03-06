# Bite & Beans Café - Ramadan Special App

This repository contains the complete production-ready source code for the Bite & Beans Café Ramadan Thali web application. It includes four distinct portals: Customer, Admin, Chef, and Delivery Partner, all powered securely by Supabase.

## 10-Step Setup Guide

Follow these strictly to get the app running within 30 minutes!

### Prerequisites:
- A completely blank [Supabase](https://supabase.com/) project
- A free Vercel or Netlify account for hosting
- A cafe WhatsApp number to receive orders.

---

### Step 1: Create Supabase Project
1. Log in to your Supabase dashboard and click "New Project".
2. Enter a name and generate a secure database password. Wait a few minutes for the database to boot.

### Step 2: Configure Authentication Settings
1. Go to **Authentication > Providers** in your Supabase dashboard.
2. Ensure **Email** is enabled, but **TURN OFF "Confirm email"** (for ease of quick signup during Ramadan).

### Step 3: Run Database Scripts In Order
1. Go to the **SQL Editor** in your Supabase dashboard.
2. Click "New Query" and paste the contents of `supabase/01_schema.sql` from your code files. Click *Run*.
3. Repeat the process for:
   - `02_rls_policies.sql`
   - `03_realtime.sql`
   - `04_storage.sql`
   - `05_seed.sql`

### Step 4: Add Realtime Triggers 
The tables are activated in `03_realtime.sql` natively.

### Step 5: Create Staff Accounts
Open **Authentication > Users** and manually create the staff users (make note of their emails/passwords).
- `admin@biteandbeans.com`
- `chef1@biteandbeans.com` (and optionally chef2, chef3)
- `dp1@biteandbeans.com` (for delivery partners)

### Step 6: Assign Staff Roles
Go to the **Table Editor**, select your `profiles` table. Find the users you just created and modify their `role` dropdown to `admin`, `chef`, or `delivery` accordingly. By default, they will say `user`.

### Step 7: Get Supabase Keys
Go to **Project Settings > API**. 
Copy your:
- Project URL
- `anon` `public` API Key

### Step 8: Configure Environment Variables
In your code directory, rename `.env.example` to `.env.local` (or add them via Vercel).
1. Paste your VITE_SUPABASE_URL
2. Paste your VITE_SUPABASE_ANON_KEY
3. Define `VITE_CAFE_WHATSAPP_NUMBER` with your country code (e.g. `919876543210`) containing no special characters.

### Step 9: Deploy to Vercel/Netlify
1. Push this code to a GitHub repository.
2. Log in to Vercel.com, click "Add New Project", and import your repo.
3. In the setup, add the 3 Environment Variables from Step 8.
4. Click Deploy.

### Step 10: App Configuration
Log in to your newly deployed app using the `admin@biteandbeans.com` account. Upload your QR code in the settings, verify prices, and make the store "Available". Customers can now order!

Enjoy your fast, realtime, Ramadan Thali operations!
