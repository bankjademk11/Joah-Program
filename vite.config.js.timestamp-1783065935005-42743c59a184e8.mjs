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
      registerType: "autoUpdate",
      // บังคับอัปเดต SW อัตโนมัติ ไม่ต้องให้ users ล้าง cache
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
  assetsInclude: ["**/*.xlsx"],
  // บอก Vite ວ່າ .xlsx ແມ່ນ Asset file
  server: {
    proxy: {
      "/api": {
        target: "https://lod.kokkokm.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        cookieDomainRewrite: { "*": "localhost" },
        cookiePathRewrite: { "*": "/" }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxpZGVhcGFkIHNsIDNpXFxcXE9uZURyaXZlXFxcXERlc2t0b3BcXFxcSm9haFRvb2xzSGVscFxcXFx3YXJlaG91c2UtdmFsaWRhdG9yXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxpZGVhcGFkIHNsIDNpXFxcXE9uZURyaXZlXFxcXERlc2t0b3BcXFxcSm9haFRvb2xzSGVscFxcXFx3YXJlaG91c2UtdmFsaWRhdG9yXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9pZGVhcGFkJTIwc2wlMjAzaS9PbmVEcml2ZS9EZXNrdG9wL0pvYWhUb29sc0hlbHAvd2FyZWhvdXNlLXZhbGlkYXRvci92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnXG5pbXBvcnQgbGVnYWN5IGZyb20gJ0B2aXRlanMvcGx1Z2luLWxlZ2FjeSdcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnXG5cbi8vIGh0dHBzOi8vdml0ZS5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgbGVnYWN5KHtcbiAgICAgIHRhcmdldHM6IFsnZGVmYXVsdHMnLCAnbm90IElFIDExJywgJ2lvcyA+PSAxMicsICdzYWZhcmkgPj0gMTInXSxcbiAgICAgIGFkZGl0aW9uYWxMZWdhY3lQb2x5ZmlsbHM6IFsncmVnZW5lcmF0b3ItcnVudGltZS9ydW50aW1lJ11cbiAgICB9KSxcbiAgICBWaXRlUFdBKHtcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLCAvLyBcdTBFMUFcdTBFMzFcdTBFMDdcdTBFMDRcdTBFMzFcdTBFMUFcdTBFMkRcdTBFMzFcdTBFMUJcdTBFNDBcdTBFMTRcdTBFMTUgU1cgXHUwRTJEXHUwRTMxXHUwRTE1XHUwRTQyXHUwRTE5XHUwRTIxXHUwRTMxXHUwRTE1XHUwRTM0IFx1MEU0NFx1MEUyMVx1MEU0OFx1MEUxNVx1MEU0OVx1MEUyRFx1MEUwN1x1MEU0M1x1MEUyQlx1MEU0OSB1c2VycyBcdTBFMjVcdTBFNDlcdTBFMzJcdTBFMDcgY2FjaGVcbiAgICAgIGluamVjdFJlZ2lzdGVyOiAnYXV0bycsXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uaWNvJywgJ2FwcGxlLXRvdWNoLWljb24ucG5nJywgJ21hc2tlZC1pY29uLnN2ZyddLFxuICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgbmFtZTogJ0pPQUggV2FyZWhvdXNlIFN5c3RlbScsXG4gICAgICAgIHNob3J0X25hbWU6ICdKT0FIJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdXYXJlaG91c2UgSW52ZW50b3J5IFZhbGlkYXRpb24gU3lzdGVtJyxcbiAgICAgICAgdGhlbWVfY29sb3I6ICcjZjk3MzE2JyxcbiAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogJyNmZmZmZmYnLFxuICAgICAgICBkaXNwbGF5OiAnc3RhbmRhbG9uZScsXG4gICAgICAgIGljb25zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiAncHdhLTE5MngxOTIucG5nJyxcbiAgICAgICAgICAgIHNpemVzOiAnMTkyeDE5MicsXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiAncHdhLTUxMng1MTIucG5nJyxcbiAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJ1xuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfSxcbiAgICAgIHdvcmtib3g6IHtcbiAgICAgICAgLy8gXHUwRTQwXHUwRTFFXHUwRTM0XHUwRTQ4XHUwRTIxIGxpbWl0IFx1MEU0MFx1MEUxQlx1MEU0N1x1MEUxOSA1TUIgXHUwRTQwXHUwRTFFXHUwRTIzXHUwRTMyXHUwRTMwXHUwRTQ0XHUwRTFGXHUwRTI1XHUwRTRDIEpTIGFwcCBcdTBFNDBcdTBFMjNcdTBFMzJcdTBFNDNcdTBFMkJcdTBFMERcdTBFNDhcdTBFMDFcdTBFMjdcdTBFNDhcdTBFMzIgZGVmYXVsdCAyTUJcbiAgICAgICAgbWF4aW11bUZpbGVTaXplVG9DYWNoZUluQnl0ZXM6IDUgKiAxMDI0ICogMTAyNCxcbiAgICAgICAgLy8gQ2FjaGUgXHUwRTQ0XHUwRTFGXHUwRTI1XHUwRTRDIHN0YXRpYyAoXHUwRTIyXHUwRTAxXHUwRTQwXHUwRTI3XHUwRTQ5XHUwRTE5IGxlZ2FjeSBwb2x5ZmlsbCBcdTBFMTdcdTBFMzVcdTBFNDhcdTBFNDNcdTBFMkJcdTBFMERcdTBFNDhcdTBFMjFcdTBFMzJcdTBFMDFcdTBFNDFcdTBFMjVcdTBFMzBcdTBFNDNcdTBFMEFcdTBFNDlcdTBFNDFcdTBFMDRcdTBFNDhcdTBFNDBcdTBFMUFcdTBFMjNcdTBFMzJcdTBFMjdcdTBFNENcdTBFNDBcdTBFMEJcdTBFMkRcdTBFMjNcdTBFNENcdTBFNDBcdTBFMDFcdTBFNDhcdTBFMzIpXG4gICAgICAgIGdsb2JQYXR0ZXJuczogWycqKi8qLntqcyxjc3MsaHRtbCxpY28scG5nLHN2Zyx3b2ZmMn0nXSxcbiAgICAgICAgZ2xvYklnbm9yZXM6IFsnKiovaW5kZXgtbGVnYWN5LSouanMnLCAnKiovcG9seWZpbGxzLWxlZ2FjeS0qLmpzJ10sXG4gICAgICAgIG5hdmlnYXRlRmFsbGJhY2s6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgIGNsZWFudXBPdXRkYXRlZENhY2hlczogdHJ1ZSxcbiAgICAgICAgcnVudGltZUNhY2hpbmc6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBTdXBhYmFzZSBBUEkgXHUyMDE0IFx1MEU0NFx1MEUyMVx1MEU0OCBjYWNoZSAoXHUwRTE1XHUwRTQ5XHUwRTJEXHUwRTA3XHUwRTE0XHUwRTM2XHUwRTA3XHUwRTAyXHUwRTQ5XHUwRTJEXHUwRTIxXHUwRTM5XHUwRTI1XHUwRTJBXHUwRTE0XHUwRTQwXHUwRTJBXHUwRTIxXHUwRTJEKVxuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC8uKlxcLnN1cGFiYXNlXFwuY29cXC8uKi9pLFxuICAgICAgICAgICAgaGFuZGxlcjogJ05ldHdvcmtPbmx5JyxcbiAgICAgICAgICB9XG4gICAgICAgIF1cbiAgICAgIH1cbiAgICB9KVxuICBdLFxuICBidWlsZDoge1xuICAgIHRhcmdldDogJ2VzMjAxNScsXG4gIH0sXG4gIGFzc2V0c0luY2x1ZGU6IFsnKiovKi54bHN4J10sIC8vIFx1MEUxQVx1MEUyRFx1MEUwMSBWaXRlIFx1MEVBN1x1MEVDOFx1MEVCMiAueGxzeCBcdTBFQzFcdTBFQTFcdTBFQzhcdTBFOTkgQXNzZXQgZmlsZVxuICBzZXJ2ZXI6IHtcbiAgICBwcm94eToge1xuICAgICAgJy9hcGknOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHBzOi8vbG9kLmtva2tva20uY29tJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IHRydWUsXG4gICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hcGkvLCAnJyksXG4gICAgICAgIGNvb2tpZURvbWFpblJld3JpdGU6IHsgJyonOiAnbG9jYWxob3N0JyB9LFxuICAgICAgICBjb29raWVQYXRoUmV3cml0ZTogeyAnKic6ICcvJyB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBK1osU0FBUyxvQkFBb0I7QUFDNWIsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sWUFBWTtBQUNuQixTQUFTLGVBQWU7QUFHeEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsU0FBUyxDQUFDLFlBQVksYUFBYSxhQUFhLGNBQWM7QUFBQSxNQUM5RCwyQkFBMkIsQ0FBQyw2QkFBNkI7QUFBQSxJQUMzRCxDQUFDO0FBQUEsSUFDRCxRQUFRO0FBQUEsTUFDTixjQUFjO0FBQUE7QUFBQSxNQUNkLGdCQUFnQjtBQUFBLE1BQ2hCLGVBQWUsQ0FBQyxlQUFlLHdCQUF3QixpQkFBaUI7QUFBQSxNQUN4RSxVQUFVO0FBQUEsUUFDUixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsUUFDWixhQUFhO0FBQUEsUUFDYixhQUFhO0FBQUEsUUFDYixrQkFBa0I7QUFBQSxRQUNsQixTQUFTO0FBQUEsUUFDVCxPQUFPO0FBQUEsVUFDTDtBQUFBLFlBQ0UsS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFVBQ1I7QUFBQSxVQUNBO0FBQUEsWUFDRSxLQUFLO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsVUFDUjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsTUFDQSxTQUFTO0FBQUE7QUFBQSxRQUVQLCtCQUErQixJQUFJLE9BQU87QUFBQTtBQUFBLFFBRTFDLGNBQWMsQ0FBQyxzQ0FBc0M7QUFBQSxRQUNyRCxhQUFhLENBQUMsd0JBQXdCLDBCQUEwQjtBQUFBLFFBQ2hFLGtCQUFrQjtBQUFBLFFBQ2xCLHVCQUF1QjtBQUFBLFFBQ3ZCLGdCQUFnQjtBQUFBLFVBQ2Q7QUFBQTtBQUFBLFlBRUUsWUFBWTtBQUFBLFlBQ1osU0FBUztBQUFBLFVBQ1g7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxFQUNWO0FBQUEsRUFDQSxlQUFlLENBQUMsV0FBVztBQUFBO0FBQUEsRUFDM0IsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLFFBQ1IsU0FBUyxDQUFDLFNBQVMsS0FBSyxRQUFRLFVBQVUsRUFBRTtBQUFBLFFBQzVDLHFCQUFxQixFQUFFLEtBQUssWUFBWTtBQUFBLFFBQ3hDLG1CQUFtQixFQUFFLEtBQUssSUFBSTtBQUFBLE1BQ2hDO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
