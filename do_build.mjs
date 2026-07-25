import { build } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function doBuild() {
  console.log('Building production bundle...');
  await build({
    root: __dirname,
    base: '/run-tracker/',
    build: {
      outDir: path.join(__dirname, 'dist')
    }
  });
  console.log('Build completed successfully!');
}

doBuild().catch(err => {
  console.error('Build failed error:', err);
  process.exit(1);
});
