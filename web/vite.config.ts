import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    // Em desenvolvimento a API corre em `php artisan serve`.
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
