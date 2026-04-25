import type { CustomRoute } from '@elegant-router/types';
import { layouts, views } from '../elegant/imports';
import { getRoutePath, transformElegantRoutesToVueRoutes } from '../elegant/transform';
import { createStaticRoutes, getAuthVueRoutes } from './index';

export const ROOT_ROUTE: CustomRoute = {
  name: 'root',
  path: '/',
  redirect: getRoutePath(import.meta.env.VITE_ROUTE_HOME) || '/home',
  meta: {
    title: 'root',
    constant: true
  }
};

const NOT_FOUND_ROUTE: CustomRoute = {
  name: 'not-found',
  path: '/:pathMatch(.*)*',
  component: 'layout.blank$view.404',
  meta: {
    title: 'not-found',
    constant: true
  }
};

/** builtin routes, it must be constant and setup in vue-router */
function getBuiltinRoutes() {
  const { constantRoutes } = createStaticRoutes();
  return [ROOT_ROUTE, ...constantRoutes, NOT_FOUND_ROUTE];
}

/** create builtin vue routes */
export function createBuiltinVueRoutes() {
  const builtinRoutes = getBuiltinRoutes();
  const baseRoutes = transformElegantRoutesToVueRoutes(builtinRoutes, layouts, views);

  // ensure constant generated routes (e.g. login/403/404/500) are available at bootstrap
  const { constantRoutes } = createStaticRoutes();
  const constantVueRoutes = getAuthVueRoutes(constantRoutes);
  const merged = [...baseRoutes];
  const exists = new Set(merged.map(route => String(route.name || '')));
  for (const route of constantVueRoutes) {
    const routeName = String(route.name || '');
    if (routeName && !exists.has(routeName)) {
      merged.push(route);
      exists.add(routeName);
    }
  }

  return merged;
}
