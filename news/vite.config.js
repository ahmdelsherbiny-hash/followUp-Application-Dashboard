import { defineConfig } from 'vite';

const standaloneStyles = '<link data-standalone-asset="style" href="./assets/app.css" rel="stylesheet">';
const sourceStyles = '<link href="/src/styles.css" rel="stylesheet">';
const standaloneScript = '<script data-standalone-asset="script" src="./assets/app.js" defer></script>';
const sourceScript = '<script type="module" src="/src/app.js"></script>';

export default defineConfig({
  plugins: [{
    name: 'use-source-assets-in-vite',
    enforce: 'pre',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replace(standaloneStyles, sourceStyles)
          .replace(standaloneScript, sourceScript);
      },
    },
  }],
});
