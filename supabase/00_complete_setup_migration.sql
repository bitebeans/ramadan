-- Add payment_method column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'online';

-- Adding trigger for order status history
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.order_status_history (order_id, status)
        VALUES (NEW.id, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_status_audit ON public.orders;
CREATE TRIGGER order_status_audit
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION log_order_status_change();
