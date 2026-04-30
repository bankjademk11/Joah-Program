// vite.config.js
import { defineConfig } from "file:///C:/Users/ideapad%20sl%203i/OneDrive/Desktop/JoahToolsHelp/warehouse-validator/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/ideapad%20sl%203i/OneDrive/Desktop/JoahToolsHelp/warehouse-validator/node_modules/@vitejs/plugin-react/dist/index.js";
import legacy from "file:///C:/Users/ideapad%20sl%203i/OneDrive/Desktop/JoahToolsHelp/warehouse-validator/node_modules/@vitejs/plugin-legacy/dist/index.js";
import { VitePWA } from "file:///C:/Users/ideapad%20sl%203i/OneDrive/Desktop/JoahToolsHelp/warehouse-validator/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ["defaults", "not IE 11", "ios >= 12", "safari >= 12"],
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"]
    }),
    VitePWA({
      registerType: "prompt",
      // ไม่บังคับ reload อัตโนมัติ แค่แจ้งเตือนพนักงาน
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "JOAH Warehouse System",
        short_name: "JOAH",
        description: "Warehouse Inventory Validation System",
        theme_color: "#f97316",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      },
      workbox: {
        // เพิ่ม limit เป็น 5MB เพราะไฟล์ JS app เราใหญ่กว่า default 2MB
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Cache ไฟล์ static (ยกเว้น legacy polyfill ที่ใหญ่มากและใช้แค่เบราว์เซอร์เก่า)
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        globIgnores: ["**/index-legacy-*.js", "**/polyfills-legacy-*.js"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Supabase API — ไม่ cache (ต้องดึงข้อมูลสดเสมอ)
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkOnly"
          }
        ]
      }
    })
  ],
  build: {
    target: "es2015"
  },
  assetsInclude: ["**/*.xlsx"]
  // บอก Vite ວ່າ .xlsx ແມ່ນ Asset file
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxpZGVhcGFkIHNsIDNpXFxcXE9uZURyaXZlXFxcXERlc2t0b3BcXFxcSm9haFRvb2xzSGVscFxcXFx3YXJlaG91c2UtdmFsaWRhdG9yXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxpZGVhcGFkIHNsIDNpXFxcXE9uZURyaXZlXFxcXERlc2t0b3BcXFxcSm9haFRvb2xzSGVscFxcXFx3YXJlaG91c2UtdmFsaWRhdG9yXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9pZGVhcGFkJTIwc2wlMjAzaS9PbmVEcml2ZS9EZXNrdG9wL0pvYWhUb29sc0hlbHAvd2FyZWhvdXNlLXZhbGlkYXRvci92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnXG5pbXBvcnQgbGVnYWN5IGZyb20gJ0B2aXRlanMvcGx1Z2luLWxlZ2FjeSdcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnXG5cbi8vIGh0dHBzOi8vdml0ZS5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgbGVnYWN5KHtcbiAgICAgIHRhcmdldHM6IFsnZGVmYXVsdHMnLCAnbm90IElFIDExJywgJ2lvcyA+PSAxMicsICdzYWZhcmkgPj0gMTInXSxcbiAgICAgIGFkZGl0aW9uYWxMZWdhY3lQb2x5ZmlsbHM6IFsncmVnZW5lcmF0b3ItcnVudGltZS9ydW50aW1lJ11cbiAgICB9KSxcbiAgICBWaXRlUFdBKHtcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ3Byb21wdCcsIC8vIFx1MEU0NFx1MEUyMVx1MEU0OFx1MEUxQVx1MEUzMVx1MEUwN1x1MEUwNFx1MEUzMVx1MEUxQSByZWxvYWQgXHUwRTJEXHUwRTMxXHUwRTE1XHUwRTQyXHUwRTE5XHUwRTIxXHUwRTMxXHUwRTE1XHUwRTM0IFx1MEU0MVx1MEUwNFx1MEU0OFx1MEU0MVx1MEUwOFx1MEU0OVx1MEUwN1x1MEU0MFx1MEUxNVx1MEUzN1x1MEUyRFx1MEUxOVx1MEUxRVx1MEUxOVx1MEUzMVx1MEUwMVx1MEUwN1x1MEUzMlx1MEUxOVxuICAgICAgaW5qZWN0UmVnaXN0ZXI6ICdhdXRvJyxcbiAgICAgIGluY2x1ZGVBc3NldHM6IFsnZmF2aWNvbi5pY28nLCAnYXBwbGUtdG91Y2gtaWNvbi5wbmcnLCAnbWFza2VkLWljb24uc3ZnJ10sXG4gICAgICBtYW5pZmVzdDoge1xuICAgICAgICBuYW1lOiAnSk9BSCBXYXJlaG91c2UgU3lzdGVtJyxcbiAgICAgICAgc2hvcnRfbmFtZTogJ0pPQUgnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1dhcmVob3VzZSBJbnZlbnRvcnkgVmFsaWRhdGlvbiBTeXN0ZW0nLFxuICAgICAgICB0aGVtZV9jb2xvcjogJyNmOTczMTYnLFxuICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiAnI2ZmZmZmZicsXG4gICAgICAgIGRpc3BsYXk6ICdzdGFuZGFsb25lJyxcbiAgICAgICAgaWNvbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzcmM6ICdwd2EtMTkyeDE5Mi5wbmcnLFxuICAgICAgICAgICAgc2l6ZXM6ICcxOTJ4MTkyJyxcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzcmM6ICdwd2EtNTEyeDUxMi5wbmcnLFxuICAgICAgICAgICAgc2l6ZXM6ICc1MTJ4NTEyJyxcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnXG4gICAgICAgICAgfVxuICAgICAgICBdXG4gICAgICB9LFxuICAgICAgd29ya2JveDoge1xuICAgICAgICAvLyBcdTBFNDBcdTBFMUVcdTBFMzRcdTBFNDhcdTBFMjEgbGltaXQgXHUwRTQwXHUwRTFCXHUwRTQ3XHUwRTE5IDVNQiBcdTBFNDBcdTBFMUVcdTBFMjNcdTBFMzJcdTBFMzBcdTBFNDRcdTBFMUZcdTBFMjVcdTBFNEMgSlMgYXBwIFx1MEU0MFx1MEUyM1x1MEUzMlx1MEU0M1x1MEUyQlx1MEUwRFx1MEU0OFx1MEUwMVx1MEUyN1x1MEU0OFx1MEUzMiBkZWZhdWx0IDJNQlxuICAgICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogNSAqIDEwMjQgKiAxMDI0LFxuICAgICAgICAvLyBDYWNoZSBcdTBFNDRcdTBFMUZcdTBFMjVcdTBFNEMgc3RhdGljIChcdTBFMjJcdTBFMDFcdTBFNDBcdTBFMjdcdTBFNDlcdTBFMTkgbGVnYWN5IHBvbHlmaWxsIFx1MEUxN1x1MEUzNVx1MEU0OFx1MEU0M1x1MEUyQlx1MEUwRFx1MEU0OFx1MEUyMVx1MEUzMlx1MEUwMVx1MEU0MVx1MEUyNVx1MEUzMFx1MEU0M1x1MEUwQVx1MEU0OVx1MEU0MVx1MEUwNFx1MEU0OFx1MEU0MFx1MEUxQVx1MEUyM1x1MEUzMlx1MEUyN1x1MEU0Q1x1MEU0MFx1MEUwQlx1MEUyRFx1MEUyM1x1MEU0Q1x1MEU0MFx1MEUwMVx1MEU0OFx1MEUzMilcbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbJyoqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnLHdvZmYyfSddLFxuICAgICAgICBnbG9iSWdub3JlczogWycqKi9pbmRleC1sZWdhY3ktKi5qcycsICcqKi9wb2x5ZmlsbHMtbGVnYWN5LSouanMnXSxcbiAgICAgICAgbmF2aWdhdGVGYWxsYmFjazogJy9pbmRleC5odG1sJyxcbiAgICAgICAgY2xlYW51cE91dGRhdGVkQ2FjaGVzOiB0cnVlLFxuICAgICAgICBydW50aW1lQ2FjaGluZzogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIFN1cGFiYXNlIEFQSSBcdTIwMTQgXHUwRTQ0XHUwRTIxXHUwRTQ4IGNhY2hlIChcdTBFMTVcdTBFNDlcdTBFMkRcdTBFMDdcdTBFMTRcdTBFMzZcdTBFMDdcdTBFMDJcdTBFNDlcdTBFMkRcdTBFMjFcdTBFMzlcdTBFMjVcdTBFMkFcdTBFMTRcdTBFNDBcdTBFMkFcdTBFMjFcdTBFMkQpXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcLy4qXFwuc3VwYWJhc2VcXC5jb1xcLy4qL2ksXG4gICAgICAgICAgICBoYW5kbGVyOiAnTmV0d29ya09ubHknLFxuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfVxuICAgIH0pXG4gIF0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXMyMDE1JyxcbiAgfSxcbiAgYXNzZXRzSW5jbHVkZTogWycqKi8qLnhsc3gnXSwgLy8gXHUwRTFBXHUwRTJEXHUwRTAxIFZpdGUgXHUwRUE3XHUwRUM4XHUwRUIyIC54bHN4IFx1MEVDMVx1MEVBMVx1MEVDOFx1MEU5OSBBc3NldCBmaWxlXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUErWixTQUFTLG9CQUFvQjtBQUM1YixPQUFPLFdBQVc7QUFDbEIsT0FBTyxZQUFZO0FBQ25CLFNBQVMsZUFBZTtBQUd4QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxTQUFTLENBQUMsWUFBWSxhQUFhLGFBQWEsY0FBYztBQUFBLE1BQzlELDJCQUEyQixDQUFDLDZCQUE2QjtBQUFBLElBQzNELENBQUM7QUFBQSxJQUNELFFBQVE7QUFBQSxNQUNOLGNBQWM7QUFBQTtBQUFBLE1BQ2QsZ0JBQWdCO0FBQUEsTUFDaEIsZUFBZSxDQUFDLGVBQWUsd0JBQXdCLGlCQUFpQjtBQUFBLE1BQ3hFLFVBQVU7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQWE7QUFBQSxRQUNiLGFBQWE7QUFBQSxRQUNiLGtCQUFrQjtBQUFBLFFBQ2xCLFNBQVM7QUFBQSxRQUNULE9BQU87QUFBQSxVQUNMO0FBQUEsWUFDRSxLQUFLO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsVUFDUjtBQUFBLFVBQ0E7QUFBQSxZQUNFLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxVQUNSO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLFNBQVM7QUFBQTtBQUFBLFFBRVAsK0JBQStCLElBQUksT0FBTztBQUFBO0FBQUEsUUFFMUMsY0FBYyxDQUFDLHNDQUFzQztBQUFBLFFBQ3JELGFBQWEsQ0FBQyx3QkFBd0IsMEJBQTBCO0FBQUEsUUFDaEUsa0JBQWtCO0FBQUEsUUFDbEIsdUJBQXVCO0FBQUEsUUFDdkIsZ0JBQWdCO0FBQUEsVUFDZDtBQUFBO0FBQUEsWUFFRSxZQUFZO0FBQUEsWUFDWixTQUFTO0FBQUEsVUFDWDtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLEVBQ1Y7QUFBQSxFQUNBLGVBQWUsQ0FBQyxXQUFXO0FBQUE7QUFDN0IsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
