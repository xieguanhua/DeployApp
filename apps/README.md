# Split Architecture (Preserve Existing `nuxtjs`)

This workspace now keeps your original code in `nuxtjs/` and adds a separated frontend/backend setup in `apps/`.

## Structure

- `apps/backend`: based on `nestjs-prisma-starter`
- `apps/frontend`: based on `soybean-admin-antd` with added SSR entry points

## Backend (NestJS + Prisma)

```bash
cd apps/backend
npm install
npm run start:dev
```

## Frontend (Soybean Admin Antd)

This repository is pnpm-workspace based.

```bash
cd apps/frontend
pnpm install
pnpm dev
```

## Frontend SSR Commands

```bash
cd apps/frontend
pnpm dev:ssr
pnpm build:ssr
pnpm start:ssr
```

SSR files added:

- `src/entry-app.ts`
- `src/entry-server.ts`
- `ssr/dev-server.mjs`
- `ssr/server.mjs`

## Notes

- Existing `nuxtjs/` remains untouched as your previous implementation.
- `soybean-admin-antd` is originally CSR-first; SSR support here is added via Vite server rendering entry and may require page-level guards for browser-only code in some modules.
