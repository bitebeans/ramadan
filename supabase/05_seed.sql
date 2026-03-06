-- 05_seed.sql
-- Insert default configurations into settings

INSERT INTO settings (key, value, description)
VALUES 
    ('app_config', '{"name": "Bite & Beans Café", "item_price": 119}', 'App general configuration like café name and fundamental prices.'),
    ('store_status', '{"is_open": true, "out_of_stock": false}', 'Master switches for ordering availability.'),
    ('delivery_config', '{"charge": 20}', 'Dynamic delivery charges added to orders.'),
    ('payment_config', '{"qr_code_url": null}', 'Public URL of the UPI QR Code for payments.')
ON CONFLICT (key) DO NOTHING;
