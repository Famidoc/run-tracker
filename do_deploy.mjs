import ghpages from 'file:///C:/Users/USER/node_modules/gh-pages/lib/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Publishing dist to GitHub Pages gh-pages branch...');
ghpages.publish(path.join(__dirname, 'dist'), {
  repo: 'https://github.com/Famidoc/run-tracker.git',
  branch: 'gh-pages'
}, (err) => {
  if (err) {
    console.error('Publish error:', err);
    process.exit(1);
  } else {
    console.log('✅ Successfully published goal completion settings feature to GitHub Pages!');
  }
});
