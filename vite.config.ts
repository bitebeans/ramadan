import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          // Just in case we need envs in the index.html later
          return html.replace(/%VITE_SUPABASE_URL%/g, env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '');
        }
      }
    ],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
      'import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY': JSON.stringify(env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY),
      'import.meta.env.VITE_SUPERADMIN_PASSWORD': JSON.stringify(env.VITE_SUPERADMIN_PASSWORD || process.env.VITE_SUPERADMIN_PASSWORD),
      'import.meta.env.VITE_CAFE_WHATSAPP_NUMBER': JSON.stringify(env.VITE_CAFE_WHATSAPP_NUMBER || process.env.VITE_CAFE_WHATSAPP_NUMBER),
      'import.meta.env.VITE_WA_COUNTRY_CODE': JSON.stringify(env.VITE_WA_COUNTRY_CODE || process.env.VITE_WA_COUNTRY_CODE),
      'import.meta.env.VITE_APP_URL': JSON.stringify(env.VITE_APP_URL || process.env.VITE_APP_URL),
      'import.meta.env.VITE_APP_NAME': JSON.stringify(env.VITE_APP_NAME || process.env.VITE_APP_NAME),
      'import.meta.env.VITE_ITEM_NAME': JSON.stringify(env.VITE_ITEM_NAME || process.env.VITE_ITEM_NAME),
      'import.meta.env.VITE_ITEM_PRICE': JSON.stringify(env.VITE_ITEM_PRICE || process.env.VITE_ITEM_PRICE),
      'import.meta.env.VITE_DEFAULT_DELIVERY_CHARGE': JSON.stringify(env.VITE_DEFAULT_DELIVERY_CHARGE || process.env.VITE_DEFAULT_DELIVERY_CHARGE),
    }
  };
});
