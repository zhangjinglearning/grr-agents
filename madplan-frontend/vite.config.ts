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
          },
        },
      },
      // Build optimization
      minify: !isDev,
      target: 'esnext',
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
