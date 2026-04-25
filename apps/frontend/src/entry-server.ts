import { renderToString } from 'vue/server-renderer';
import { createSoybeanApp } from './entry-app';

export async function render(url: string) {
  const { app } = await createSoybeanApp({ ssr: true, initialUrl: url });
  const appHtml = await renderToString(app);
  return { appHtml };
}
