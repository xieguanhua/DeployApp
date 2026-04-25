import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function start() {
  const app = express();
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true },
    appType: 'custom'
  });

  app.use(vite.middlewares);

  app.use('*', async (req, res) => {
    try {
      const url = req.originalUrl;
      const templatePath = path.resolve(root, 'index.html');
      let template = await fs.readFile(templatePath, 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      const { render } = await vite.ssrLoadModule('/src/entry-server.ts');
      const { appHtml } = await render(url);
      const html = template.replace('<div id="app"></div>', `<div id="app">${appHtml}</div>`);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (error) {
      vite.ssrFixStacktrace(error);
      res.status(500).end(error?.stack || String(error));
    }
  });

  app.listen(4173, () => {
    console.log('SSR dev server running at http://localhost:4173');
  });
}

start();
