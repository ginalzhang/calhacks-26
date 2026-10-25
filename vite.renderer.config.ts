import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
export default defineConfig(({command})=>{
  const nonce=command==='serve'?randomBytes(18).toString('base64'):undefined;
  return { root: 'src/renderer', base: './', html:{cspNonce:nonce},server:{hmr:false}, build: { outDir: path.resolve('.vite/renderer/main_window'), emptyOutDir:true }, plugins: [react(), ...(nonce?[{name:'steady-dev-csp',transformIndexHtml:{order:'post' as const,handler:(html:string)=>html.replace("script-src 'self'",`script-src 'self' 'nonce-${nonce}'`).replace("style-src 'self'",`style-src 'self' 'nonce-${nonce}'`)}}]:[])], worker: { format: 'es' } };
});
