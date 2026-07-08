import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@xyflow/react': path.resolve(__dirname, 'node_modules/@xyflow/react'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      '@uiw/react-codemirror': path.resolve(__dirname, 'node_modules/@uiw/react-codemirror'),
      '@codemirror/lang-python': path.resolve(__dirname, 'node_modules/@codemirror/lang-python'),
      '@uiw/codemirror-theme-vscode': path.resolve(__dirname, 'node_modules/@uiw/codemirror-theme-vscode'),
      'react-toastify': path.resolve(__dirname, 'node_modules/react-toastify'),
    }
  },
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
