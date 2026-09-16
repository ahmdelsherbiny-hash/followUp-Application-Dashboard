import fs from 'node:fs/promises';
import path from 'node:path';
import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { build } from 'vite';

const projectRoot = path.resolve(import.meta.dirname, '..');
const assetsDirectory = path.join(projectRoot, 'assets');
const cssInput = path.join(projectRoot, 'src', 'styles.css');
const cssOutput = path.join(assetsDirectory, 'app.css');

await fs.mkdir(assetsDirectory, { recursive: true });

const sourceCss = await fs.readFile(cssInput, 'utf8');
const compiledCss = await postcss([
  tailwindcss(path.join(projectRoot, 'tailwind.config.js')),
  autoprefixer,
]).process(sourceCss, {
  from: cssInput,
  to: cssOutput,
});
await fs.writeFile(cssOutput, compiledCss.css);

await build({
  configFile: false,
  root: projectRoot,
  logLevel: 'warn',
  build: {
    outDir: assetsDirectory,
    emptyOutDir: false,
    minify: 'oxc',
    lib: {
      entry: path.join(projectRoot, 'src', 'app.js'),
      name: 'RssTickerApp',
      formats: ['iife'],
      fileName: () => 'app.js',
    },
  },
});

console.log('Standalone index assets refreshed.');
