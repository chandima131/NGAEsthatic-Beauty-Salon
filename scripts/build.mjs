import { build } from 'vite';
import { copyFile, writeFile, unlink } from 'node:fs/promises';

await build();
await build({
  publicDir: false,
  ssr: { target: 'webworker', noExternal: true },
  build: {
    ssr: 'server/worker.ts',
    outDir: 'dist/server',
    copyPublicDir: false,
    rolldownOptions: { output: { entryFileNames: 'index.js' } },
  },
});
// Keep the SSR template outside public assets so hosts cannot serve placeholders.
await copyFile('dist/client/index.html', 'dist/template.html');
await unlink('dist/client/index.html');
await copyFile('server/node.mjs', 'dist/node.mjs');
await copyFile('server/node-database.mjs', 'dist/node-database.mjs');
await writeFile('dist/package.json', JSON.stringify({ type: 'module' }));
console.log('Built React browser assets, standalone Node.js server, and Sites adapter.');
