// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [
    react()
    // PWA functionality temporarily removed to resolve build errors
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   workbox: {
    //     globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    //     runtimeCaching: [
    //       {
    //         urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
    //         handler: 'CacheFirst',
    //         options: {
    //           cacheName: 'google-fonts-cache',
    //           expiration: {
    //             maxEntries: 10,
    //             maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
    //           },
    //           cacheKeyWillBeUsed: async ({ request }) => {
    //             return `${request.url}?version=1`;
    //           }
    //         }
    //       },
    //       {
    //         urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
    //         handler: 'CacheFirst',
    //         options: {
    //           cacheName: 'gstatic-fonts-cache',
    //           expiration: {
    //             maxEntries: 10,
    //             maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
    //           }
    //         }
    //       }
    //     ]
    //   },
    //   includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
    //   manifest: {
    //     name: 'ふせん君 - 音声入力忘備録アプリ',
    //     short_name: 'ふせん君',
    //     description: 'Android最適化された音声入力・文字起こしアプリ',
    //     theme_color: '#007bff',
    //     background_color: '#ffffff',
    //     display: 'standalone',
    //     orientation: 'portrait',
    //     scope: '/',
    //     start_url: '/',
    //     icons: [
    //       {
    //         src: 'icon-192.png',
    //         sizes: '192x192',
    //         type: 'image/png',
    //         purpose: 'any maskable'
    //       },
    //       {
    //         src: 'icon-512.png',
    //         sizes: '512x512',
    //         type: 'image/png',
    //         purpose: 'any maskable'
    //       }
    //     ],
    //     categories: ['productivity', 'utilities'],
    //     lang: 'ja',
    //     dir: 'ltr'
    //   }
    // })
  ],
  optimizeDeps: {
    exclude: ["lucide-react"]
  },
  build: {
    target: "es2015",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          icons: ["lucide-react"]
        }
      }
    },
    sourcemap: false,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5500,
    // port 5500用の追加コード
    strictPort: true,
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin"
    }
  },
  preview: {
    port: 4173,
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin"
    }
  },
  base: "/"
  // Netlifyデプロイ用にベースパスを修正
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICAvLyBQV0EgZnVuY3Rpb25hbGl0eSB0ZW1wb3JhcmlseSByZW1vdmVkIHRvIHJlc29sdmUgYnVpbGQgZXJyb3JzXG4gICAgLy8gVml0ZVBXQSh7XG4gICAgLy8gICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJyxcbiAgICAvLyAgIHdvcmtib3g6IHtcbiAgICAvLyAgICAgZ2xvYlBhdHRlcm5zOiBbJyoqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnLHdvZmYyfSddLFxuICAgIC8vICAgICBydW50aW1lQ2FjaGluZzogW1xuICAgIC8vICAgICAgIHtcbiAgICAvLyAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvZm9udHNcXC5nb29nbGVhcGlzXFwuY29tXFwvLiovaSxcbiAgICAvLyAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcbiAgICAvLyAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAvLyAgICAgICAgICAgY2FjaGVOYW1lOiAnZ29vZ2xlLWZvbnRzLWNhY2hlJyxcbiAgICAvLyAgICAgICAgICAgZXhwaXJhdGlvbjoge1xuICAgIC8vICAgICAgICAgICAgIG1heEVudHJpZXM6IDEwLFxuICAgIC8vICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDM2NSAvLyAxIHllYXJcbiAgICAvLyAgICAgICAgICAgfSxcbiAgICAvLyAgICAgICAgICAgY2FjaGVLZXlXaWxsQmVVc2VkOiBhc3luYyAoeyByZXF1ZXN0IH0pID0+IHtcbiAgICAvLyAgICAgICAgICAgICByZXR1cm4gYCR7cmVxdWVzdC51cmx9P3ZlcnNpb249MWA7XG4gICAgLy8gICAgICAgICAgIH1cbiAgICAvLyAgICAgICAgIH1cbiAgICAvLyAgICAgICB9LFxuICAgIC8vICAgICAgIHtcbiAgICAvLyAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvZm9udHNcXC5nc3RhdGljXFwuY29tXFwvLiovaSxcbiAgICAvLyAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcbiAgICAvLyAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAvLyAgICAgICAgICAgY2FjaGVOYW1lOiAnZ3N0YXRpYy1mb250cy1jYWNoZScsXG4gICAgLy8gICAgICAgICAgIGV4cGlyYXRpb246IHtcbiAgICAvLyAgICAgICAgICAgICBtYXhFbnRyaWVzOiAxMCxcbiAgICAvLyAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzNjUgLy8gMSB5ZWFyXG4gICAgLy8gICAgICAgICAgIH1cbiAgICAvLyAgICAgICAgIH1cbiAgICAvLyAgICAgICB9XG4gICAgLy8gICAgIF1cbiAgICAvLyAgIH0sXG4gICAgLy8gICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uaWNvJywgJ2FwcGxlLXRvdWNoLWljb24ucG5nJywgJ21hc2tlZC1pY29uLnN2ZyddLFxuICAgIC8vICAgbWFuaWZlc3Q6IHtcbiAgICAvLyAgICAgbmFtZTogJ1x1MzA3NVx1MzA1Qlx1MzA5M1x1NTQxQiAtIFx1OTdGM1x1NThGMFx1NTE2NVx1NTI5Qlx1NUZEOFx1NTA5OVx1OTMzMlx1MzBBMlx1MzBEN1x1MzBFQScsXG4gICAgLy8gICAgIHNob3J0X25hbWU6ICdcdTMwNzVcdTMwNUJcdTMwOTNcdTU0MUInLFxuICAgIC8vICAgICBkZXNjcmlwdGlvbjogJ0FuZHJvaWRcdTY3MDBcdTkwNjlcdTUzMTZcdTMwNTVcdTMwOENcdTMwNUZcdTk3RjNcdTU4RjBcdTUxNjVcdTUyOUJcdTMwRkJcdTY1ODdcdTVCNTdcdThENzdcdTMwNTNcdTMwNTdcdTMwQTJcdTMwRDdcdTMwRUEnLFxuICAgIC8vICAgICB0aGVtZV9jb2xvcjogJyMwMDdiZmYnLFxuICAgIC8vICAgICBiYWNrZ3JvdW5kX2NvbG9yOiAnI2ZmZmZmZicsXG4gICAgLy8gICAgIGRpc3BsYXk6ICdzdGFuZGFsb25lJyxcbiAgICAvLyAgICAgb3JpZW50YXRpb246ICdwb3J0cmFpdCcsXG4gICAgLy8gICAgIHNjb3BlOiAnLycsXG4gICAgLy8gICAgIHN0YXJ0X3VybDogJy8nLFxuICAgIC8vICAgICBpY29uczogW1xuICAgIC8vICAgICAgIHtcbiAgICAvLyAgICAgICAgIHNyYzogJ2ljb24tMTkyLnBuZycsXG4gICAgLy8gICAgICAgICBzaXplczogJzE5MngxOTInLFxuICAgIC8vICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgLy8gICAgICAgICBwdXJwb3NlOiAnYW55IG1hc2thYmxlJ1xuICAgIC8vICAgICAgIH0sXG4gICAgLy8gICAgICAge1xuICAgIC8vICAgICAgICAgc3JjOiAnaWNvbi01MTIucG5nJyxcbiAgICAvLyAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXG4gICAgLy8gICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcbiAgICAvLyAgICAgICAgIHB1cnBvc2U6ICdhbnkgbWFza2FibGUnXG4gICAgLy8gICAgICAgfVxuICAgIC8vICAgICBdLFxuICAgIC8vICAgICBjYXRlZ29yaWVzOiBbJ3Byb2R1Y3Rpdml0eScsICd1dGlsaXRpZXMnXSxcbiAgICAvLyAgICAgbGFuZzogJ2phJyxcbiAgICAvLyAgICAgZGlyOiAnbHRyJ1xuICAgIC8vICAgfVxuICAgIC8vIH0pXG4gIF0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0J10sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXMyMDE1JyxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgdmVuZG9yOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbSddLFxuICAgICAgICAgIGljb25zOiBbJ2x1Y2lkZS1yZWFjdCddXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIHNvdXJjZW1hcDogZmFsc2UsXG4gICAgbWluaWZ5OiAndGVyc2VyJyxcbiAgICB0ZXJzZXJPcHRpb25zOiB7XG4gICAgICBjb21wcmVzczoge1xuICAgICAgICBkcm9wX2NvbnNvbGU6IHRydWUsXG4gICAgICAgIGRyb3BfZGVidWdnZXI6IHRydWVcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6ICcwLjAuMC4wJyxcbiAgICBwb3J0OiA1NTAwLCAvLyBwb3J0IDU1MDBcdTc1MjhcdTMwNkVcdThGRkRcdTUyQTBcdTMwQjNcdTMwRkNcdTMwQzlcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDcm9zcy1PcmlnaW4tRW1iZWRkZXItUG9saWN5JzogJ2NyZWRlbnRpYWxsZXNzJyxcbiAgICAgICdDcm9zcy1PcmlnaW4tT3BlbmVyLVBvbGljeSc6ICdzYW1lLW9yaWdpbidcbiAgICB9XG4gIH0sXG4gIHByZXZpZXc6IHtcbiAgICBwb3J0OiA0MTczLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgICdDcm9zcy1PcmlnaW4tRW1iZWRkZXItUG9saWN5JzogJ3JlcXVpcmUtY29ycCcsXG4gICAgICAnQ3Jvc3MtT3JpZ2luLU9wZW5lci1Qb2xpY3knOiAnc2FtZS1vcmlnaW4nXG4gICAgfVxuICB9LFxuICBiYXNlOiAnLycsIC8vIE5ldGxpZnlcdTMwQzdcdTMwRDdcdTMwRURcdTMwQTRcdTc1MjhcdTMwNkJcdTMwRDlcdTMwRkNcdTMwQjlcdTMwRDFcdTMwQjlcdTMwOTJcdTRGRUVcdTZCNjNcbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBeU4sU0FBUyxvQkFBb0I7QUFDdFAsT0FBTyxXQUFXO0FBR2xCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQWdFUjtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLGNBQWM7QUFBQSxFQUMxQjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sY0FBYztBQUFBLFVBQ1osUUFBUSxDQUFDLFNBQVMsV0FBVztBQUFBLFVBQzdCLE9BQU8sQ0FBQyxjQUFjO0FBQUEsUUFDeEI7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLElBQ0EsV0FBVztBQUFBLElBQ1gsUUFBUTtBQUFBLElBQ1IsZUFBZTtBQUFBLE1BQ2IsVUFBVTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsZUFBZTtBQUFBLE1BQ2pCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQTtBQUFBLElBQ04sWUFBWTtBQUFBLElBQ1osU0FBUztBQUFBLE1BQ1AsZ0NBQWdDO0FBQUEsTUFDaEMsOEJBQThCO0FBQUEsSUFDaEM7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixTQUFTO0FBQUEsTUFDUCxnQ0FBZ0M7QUFBQSxNQUNoQyw4QkFBOEI7QUFBQSxJQUNoQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLE1BQU07QUFBQTtBQUNSLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
