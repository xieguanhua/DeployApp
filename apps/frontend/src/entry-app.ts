import { createApp, createSSRApp, type App as VueApp } from 'vue';
import './plugins/assets';
import { setupAppVersionNotification, setupDayjs, setupIconifyOffline, setupLoading, setupNProgress } from './plugins';
import { setupStore } from './store';
import { createAppRouter, router as appRouterSingleton, setupRouter } from './router';
import { setupI18n } from './locales';
import App from '@/App.vue';

type CreateEntryOptions = {
  ssr?: boolean;
  initialUrl?: string;
};

export async function createSoybeanApp(options: CreateEntryOptions = {}) {
  const isSsr = !!options.ssr;

  if (!isSsr) {
    setupLoading();
    setupNProgress();
  }

  setupIconifyOffline();
  setupDayjs();

  const app: VueApp = isSsr ? createSSRApp(App) : createApp(App);
  const router = isSsr ? createAppRouter(true) : appRouterSingleton;

  setupStore(app);
  await setupRouter(app, { router, ssr: isSsr, initialUrl: options.initialUrl });
  setupI18n(app);

  if (!isSsr) {
    setupAppVersionNotification();
  }

  return { app, router };
}

export async function bootstrapClientApp() {
  const { app } = await createSoybeanApp();
  app.mount('#app');
}
