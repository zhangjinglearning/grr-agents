import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '')

  // Development server configuration
  const isDev = mode === 'development'
  const backendUrl = env.VITE_API_BASE_URL || 'http://localhost:3000'
  const devPort = parseInt(env.VITE_DEV_PORT) || 5173
  const devHost = env.VITE_DEV_HOST || 'localhost'
  const enableHttps = env.VITE_DEV_HTTPS === 'true'

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: devPort,
      host: devHost,
      https: enableHttps,
      open: isDev, // Auto-open browser in development
      cors: true,
      // Proxy configuration for backend API calls
      proxy: {
        // GraphQL endpoint proxy
        '/graphql': {
          target: backendUrl,
          changeOrigin: true,
          secure: !isDev,
          ws: true, // Enable WebSocket proxying
        },
        // REST API proxy
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: !isDev,
        },
        // WebSocket proxy for future real-time features
        '/ws': {
          target: backendUrl.replace('http', 'ws'),
          ws: true,
          changeOrigin: true,
        },
      },
      // Hot Module Replacement configuration
      hmr: {
        overlay: isDev, // Show error overlay in development
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: isDev || env.VITE_ENABLE_SOURCEMAPS === 'true',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['vue', 'vue-router', 'pinia'],
            apollo: ['@apollo/client', '@vue/apollo-composable'],
            utils: ['@vueuse/core', 'jwt-decode'],
            ui: ['vuedraggable'],
          },
          // Optimize chunk filenames for better caching
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
            return `js/${facadeModuleId}-[hash].js`;
          },
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name!.split('.');
            const ext = info[info.length - 1];
            if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name!)) {
              return `images/[name]-[hash].${ext}`;
            } else if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name!)) {
              return `fonts/[name]-[hash].${ext}`;
            }
            return `assets/[name]-[hash].${ext}`;
          },
        },
        // Tree shaking and optimization
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false,
        },
      },
      // Advanced build optimization
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: !isDev,
          drop_debugger: !isDev,
          pure_funcs: !isDev ? ['console.log', 'console.info', 'console.debug'] : [],
        },
        format: {
          comments: false,
        },
      },
      target: 'es2020',
      // Bundle size limits
      chunkSizeWarningLimit: 500,
      reportCompressedSize: !isDev,
      // CSS code splitting
      cssCodeSplit: true,
      // Asset inlining threshold
      assetsInlineLimit: 4096,
    },
    define: {
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: isDev || env.VITE_ENABLE_DEVTOOLS === 'true',
      // Make env variables available to the app
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(env.npm_package_version || '1.0.0'),
    },
    // Development optimizations
    optimizeDeps: {
      include: ['vue', 'vue-router', 'pinia', '@apollo/client/core', '@vue/apollo-composable'],
    },
    // Testing configuration
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'], // Will create this file
    },
    // CSS configuration
    css: {
      devSourcemap: isDev,
      postcss: {
        plugins: [],
      },
    },
  }
})
