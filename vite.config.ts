import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  //  base: mode === 'production' ? '/CSE_FINAL_YEAR_PROJECT/' : '/',    //uncomment this line to set base path for production(github page deployment)
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@clerk/clerk-react', '@tanstack/react-query', 'lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'clerk': ['@clerk/clerk-react'],
          'query': ['@tanstack/react-query'],
          'supabase': ['@supabase/supabase-js'],
          'icons': ['lucide-react'],
        },
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
      },
    },
    chunkSizeWarningLimit: 600, // Reduced from 1000 to encourage smaller chunks
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Drop all console in production
        drop_debugger: true,
      },
      format: {
        comments: false, // Remove all comments to reduce bundle
      },
      mangle: {
        safari10: true,
      },
    },
    cssCodeSplit: true,
    sourcemap: mode !== 'production',
    reportCompressedSize: false, // Faster build, don't report size
  },
  server: {
    hmr: {
      overlay: false,
    },
  },
}));
