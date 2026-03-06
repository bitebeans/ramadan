-- 03_realtime.sql
-- Enable Realtime for relevant tables

-- Start by dropping existing publications for safety if re-running
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create publication
CREATE PUBLICATION supabase_realtime;

-- Add tables to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE order_status_history;
ALTER PUBLICATION supabase_realtime ADD TABLE addresses;
