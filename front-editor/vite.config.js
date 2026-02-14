import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          flow: ['@xyflow/react'],
          codemirror: ['@uiw/react-codemirror', '@codemirror/lang-python'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
