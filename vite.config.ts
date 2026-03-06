import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync, existsSync } from 'fs';

// On CI environments like Netlify, there is no .env file (it's gitignored).
// Netlify injects dashboard env vars into process.env.
// This script writes them into a physical .env file so Vite can read them natively.
if (!existsSync('.env')) {
  const envContent = Object.entries(process.env)
    .filter(([key]) => key.startsWith('VITE_'))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  if (envContent) {
    writeFileSync('.env', envContent);
    console.log('[vite.config] Created .env from process.env for CI build');
  }
}

export default defineConfig({
  plugins: [react()],
});
