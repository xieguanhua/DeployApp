import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function start() {
  const app = express();
  const template = await fs.readFile(path.resolve(root, 'dist/client/index.html'), 'utf-8');
  const { render } = await import(path.resolve(root, 'dist/server/entry-server.js'));

  app.use('/assets', express.static(path.resolve(root, 'dist/client/assets')));
  app.use(express.static(path.resolve(root, 'dist/client')));

  app.use('*', async (req, res) => {
    try {
      const { appHtml } = await render(req.originalUrl);
      const html = template.replace('<div id="app"></div>', `<div id="app">${appHtml}</div>`);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (error) {
      res.status(500).end(error?.stack || String(error));
    }
  });

  const port = Number(process.env.PORT || 4173);
  app.listen(port, () => {
    console.log(`SSR server running at http://localhost:${port}`);
  });
}

start();
