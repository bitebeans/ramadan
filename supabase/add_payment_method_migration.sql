-- Migration: Add payment method and make screenshot optional
ALTER TABLE orders 
ADD COLUMN payment_method TEXT DEFAULT 'online' NOT NULL;

ALTER TABLE orders 
ALTER COLUMN payment_screenshot_url DROP NOT NULL;
