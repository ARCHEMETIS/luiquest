import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// SPA + PWA (installable บนมือถือ + iPad) — ดู deploy-plan.md sec.2-3
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'ลุยเควส (LuiQuest)',
        short_name: 'ลุยเควส',
        description: 'อยากเก่งอะไร ลุยเลย — วันละเควส',
        lang: 'th',
        // สีแบรนด์จริง (ชมพูอ่อนเหมือนพื้นแอพ) — ของเดิม #0f172a เป็นสีดำน้ำเงินที่ติดมาจาก scaffold
        // background_color = สีจอ splash ตอนเปิดแอพที่ติดตั้งไว้ ถ้าปล่อยเป็นดำจะแฟลชดำก่อนเข้าแอพชมพูทุกครั้ง
        theme_color: '#FDF2F8',
        background_color: '#FDF2F8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  // ── วิธีรันดูแอพในเครื่อง (ต้องสองคำสั่ง อ่านให้ครบก่อนรัน) ──
  //
  //   1) npx netlify functions:serve --port 9999
  //   2) npm run dev
  //
  // ทำไมไม่ใช้ `netlify dev` ที่คำสั่งเดียวจบ: netlify dev ยัด header จาก netlify.toml ลงหน้าเว็บด้วย
  // ซึ่งมี `script-src 'self'` (ไม่มี 'unsafe-inline') → CSP บล็อก inline preamble ของ @vitejs/plugin-react
  // ที่ vite แทรกใน index.html ตอน dev → ทุกคอมโพเนนต์โยน "can't detect preamble" → จอขาว (เจอจริง 9 ส.ค. 2026)
  // CSP ตัวนี้ถูกแล้วสำหรับ production (ไฟล์ build ไม่มี inline script เลย) จึงห้ามผ่อนเพื่อ dev
  //
  // ส่วน `npm run dev` เปล่า ๆ ก็ไม่พอ เพราะ vite ไม่รันฟังก์ชัน — /.netlify/functions/* 404 ทั้งหมด
  // แม้แต่ /me เลยโดนเด้งไป onboarding แล้วกดเริ่มก็ 404 ซ้ำ (เจอจริง 9 ส.ค. 2026 เหมือนกัน)
  // แยกสองตัวจึงได้ครบ: vite เสิร์ฟหน้าเว็บโดยไม่มี CSP มากวน + proxy ฟังก์ชันไป functions server
  //
  // 5173 คือพอร์ตเดียวที่ลงทะเบียนไว้ใน Supabase Redirect URLs — ล็อกอินได้เลย ไม่ต้องแก้ config
  // ⚠️ ฟังก์ชันอ่าน `.env` → ต่อ Supabase production จริง ใช้รีวิว อย่าใช้ทดลองข้อมูลมั่ว
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/.netlify/functions': { target: 'http://127.0.0.1:9999', changeOrigin: true },
    },
  },
});
