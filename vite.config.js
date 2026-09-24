import {defineConfig} from 'vite';
export default defineConfig({
  base:'./',
  server:{host:'127.0.0.1',port:5173,strictPort:true,watch:{usePolling:true,interval:500,ignored:['**/references/**','**/.cache/**']}},
  build:{rollupOptions:{output:{manualChunks:{three:['three','three/addons/controls/OrbitControls.js']}}}}
});
