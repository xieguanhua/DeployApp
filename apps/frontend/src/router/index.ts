import type { App } from 'vue';
import {
  type Router,
  type RouterHistory,
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory
} from 'vue-router';
import { createBuiltinVueRoutes } from './routes/builtin';
import { createRouterGuard } from './guard';

const { VITE_ROUTER_HISTORY_MODE = 'history', VITE_BASE_URL } = import.meta.env;

const historyCreatorMap: Record<Env.RouterHistoryMode, (base?: string) => RouterHistory> = {
  hash: createWebHashHistory,
  history: createWebHistory,
  memory: createMemoryHistory
};

export function createAppRouter(ssr = false) {
  const history = ssr ? createMemoryHistory(VITE_BASE_URL) : historyCreatorMap[VITE_ROUTER_HISTORY_MODE](VITE_BASE_URL);
  return createRouter({
    history,
    routes: createBuiltinVueRoutes()
  });
}

export const router = createAppRouter(import.meta.env.SSR);

/** Setup Vue Router */
export async function setupRouter(
  app: App,
  options?: {
    router?: Router;
    ssr?: boolean;
    initialUrl?: string;
  }
) {
  const appRouter = options?.router || router;
  app.use(appRouter);
  if (!options?.ssr) {
    createRouterGuard(appRouter);
  } else if (options.initialUrl) {
    await appRouter.push(options.initialUrl);
  }
  await appRouter.isReady();
}
