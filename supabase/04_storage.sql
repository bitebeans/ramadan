-- 04_storage.sql

-- Create Buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-screenshots', 'payment-screenshots', true);

INSERT INTO storage.buckets (id, name, public) 
VALUES ('qr-codes', 'qr-codes', true);

-- Enable RLS on objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- PAYMENT-SCREENSHOTS BUCKET POLICIES
-- --------------------------------------------------------
-- Anyone can view screenshots (Public)
CREATE POLICY "Screenshots are public" ON storage.objects
FOR SELECT USING ( bucket_id = 'payment-screenshots' );

-- Authenticated Users can upload screenshots
CREATE POLICY "Users can upload screenshots" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'payment-screenshots'
);

-- Note: In a real environment, you'd add check conditions to ensure they only upload to their folder (using user_id). 
-- This example allows general authenticated insert, but the app code should enforce naming conventions.

-- --------------------------------------------------------
-- QR-CODES BUCKET POLICIES
-- --------------------------------------------------------
-- Anyone can view the QR code (Public)
CREATE POLICY "QR Codes are public" ON storage.objects
FOR SELECT USING ( bucket_id = 'qr-codes' );

-- Only Admins can upload QR Codes
CREATE POLICY "Admins can upload QR codes" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'qr-codes' AND
    EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Admins can update QR codes" ON storage.objects
FOR UPDATE TO authenticated USING (
    bucket_id = 'qr-codes' AND
    EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Admins can delete QR codes" ON storage.objects
FOR DELETE TO authenticated USING (
    bucket_id = 'qr-codes' AND
    EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
);
