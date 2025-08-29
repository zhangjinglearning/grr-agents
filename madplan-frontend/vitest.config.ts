import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.git', '.cache'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/main.ts',
        '**/*.d.ts',
        'src/test/**',
        'src/**/__tests__/**',
        'src/**/*.{test,spec}.{js,ts}',
        'dist/**',
        'coverage/**',
        '*.config.{js,ts}',
        '.eslintrc.cjs'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Per-file thresholds for critical files
        'src/stores/auth.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/services/auth.service.ts': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
    // Test timeout configuration
    testTimeout: 10000,
    hookTimeout: 10000,
    // Reporter configuration
    reporter: ['verbose', 'html', 'json'],
    outputFile: {
      json: './coverage/test-results.json',
      html: './coverage/test-report.html'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
