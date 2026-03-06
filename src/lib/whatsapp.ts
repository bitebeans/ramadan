// Utility to generate WhatsApp wa.me links

const CAFE_NUMBER = import.meta.env.VITE_CAFE_WHATSAPP_NUMBER || '';

/**
 * Creates a WhatsApp deep link
 * @param phone The target phone number WITH country code, no + or spaces
 * @param message The pre-filled text message
 * @returns wa.me URL
 */
export const createWhatsAppLink = (phone: string, message: string): string => {
    const cleanPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
};

/**
 * Common App Messaging Triggers
 */

export const getCafeOrderNotificationUrl = (
    orderId: string,
    customerName: string,
    customerPhone: string,
    qty: number,
    total: number,
    address: string
) => {
    const message = `🌙 *New Ramadan Thali Order!*\n\n*Order ID:* ${orderId}\n*Customer:* ${customerName}\n*Phone:* ${customerPhone}\n*Quantity:* ${qty}x Thali\n*Total:* ₹${total}\n*Delivery Address:* ${address}\n\n*Payment Screenhots:* Check Admin Portal.`;
    return createWhatsAppLink(CAFE_NUMBER, message);
};

export const getCustomerOrderPlacedUrl = (phone: string, orderId: string, qty: number, total: number) => {
    const message = `Salaam! 🌙 Thank you for your order at Bite & Beans Café.\n\n*Order ID:* ${orderId}\n*Items:* ${qty}x Ramadan Special Iftari Thali\n*Total Paid:* ₹${total}\n\nWe have received your payment proof and your order is currently Pending Approval. We will update you shortly!`;
    return createWhatsAppLink(phone, message);
};

export const getCustomerOrderAcceptedUrl = (phone: string, orderId: string) => {
    const message = `Great news! 🌙 Your Ramadan Thali order (${orderId}) has been *ACCEPTED* and is now being prepared. Our delivery partner will be dispatched when it's ready.`;
    return createWhatsAppLink(phone, message);
};

export const getCustomerOrderRejectedUrl = (phone: string, orderId: string, reason: string) => {
    const message = `We're sorry, 🌙 your Ramadan Thali order (${orderId}) was *REJECTED*.\n\n*Reason:* ${reason}\n\nPlease contact us at +${CAFE_NUMBER} if you need assistance or refund processing.`;
    return createWhatsAppLink(phone, message);
};

export const getCustomerOrderOutForDeliveryUrl = (phone: string, orderId: string) => {
    const message = `Your iftari is on the way! 🌙\nYour order (${orderId}) is now *OUT FOR DELIVERY*. Our delivery partner will reach your address soon.`;
    return createWhatsAppLink(phone, message);
};

export const getCustomerOrderDeliveredUrl = (phone: string, orderId: string) => {
    const message = `Jazakallah! 🌙 Your order (${orderId}) has been successfully *DELIVERED*.\nThank you for choosing Bite & Beans Café. Have a blessed iftar!`;
    return createWhatsAppLink(phone, message);
};
