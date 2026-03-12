import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11', 'ios >= 12', 'safari >= 12'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    }),
    VitePWA({
      registerType: 'prompt', // ไม่บังคับ reload อัตโนมัติ แค่แจ้งเตือนพนักงาน
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'JOAH Warehouse System',
        short_name: 'JOAH',
        description: 'Warehouse Inventory Validation System',
        theme_color: '#f97316',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // เพิ่ม limit เป็น 5MB เพราะไฟล์ JS app เราใหญ่กว่า default 2MB
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Cache ไฟล์ static (ยกเว้น legacy polyfill ที่ใหญ่มากและใช้แค่เบราว์เซอร์เก่า)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/index-legacy-*.js', '**/polyfills-legacy-*.js'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Supabase API — ไม่ cache (ต้องดึงข้อมูลสดเสมอ)
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2015',
  },
  assetsInclude: ['**/*.xlsx'], // บอก Vite ວ່າ .xlsx ແມ່ນ Asset file
})
