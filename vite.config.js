import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: 'dist/ui', // Output directory for the UI bundle
    rollupOptions: {
      input: {
        main: 'src/main.jsx',
        options: 'src/optionsMain.jsx',
      }, // multiple entry points for panel and options
      output: {
        // Ensure assets are named predictably for extension use
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
}); 