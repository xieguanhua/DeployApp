# Nuxt 激活服务（TradingAgents-CN）

用于 Electron 客户端激活与 Key 管理（Nuxt + PostgreSQL + Ant Design Vue）。

## 1) 国内源安装

```bash
npm config set registry https://registry.npmmirror.com
npm install
```

## 2) 环境变量

```bash
cp .env.example .env
```

必须配置：
- `PG_CONNECTION_STRING`
- `LICENSE_PRIVATE_KEY_PEM`
- `LICENSE_PUBLIC_KEY_PEM`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_JWT_SECRET`
- `AI_API_KEY`
- `AI_API_HMAC_SECRET`

## 3) 初始化数据库

执行 `server/db/schema.sql` 中建表语句到 PostgreSQL。

## 4) 本地启动

```bash
npm run dev
```

## 5) 类型模型（新增）

- 激活产品表：`activation_products`
  - `product_code`：产品类型（如 `TRADING_AGENTS`）
  - `client_type`：端类型（`frontend` / `backend` / `fullstack`）
  - `price_cents`：价格（分）
- 激活码创建必须指定 `productCode`，不再是无类型 key。

## 6) 已实现接口

- `POST /api/activate`
  - 客户端激活：`activationKey + deviceId + nonce + timestamp + requestId`
  - 返回 `licenseToken`（RS256 签名）+ `productCode/clientType/priceCents`
- `POST /api/admin/login`
  - 管理员登录，返回 JWT
- `POST /api/admin/products/upsert`
  - 创建或更新激活类型（产品、端类型、价格）
- `GET /api/admin/products/list`
  - 查询全部激活类型
- `POST /api/admin/keys/create`
  - 需要 `Authorization: Bearer <adminToken>`，且 body 必须带 `productCode`
- `POST /api/public/keys/create`
  - 供 AI 调用，要求 `x-api-key + x-signature + x-timestamp + x-nonce`，且 body 必须带 `productCode`

## 7) 安全机制（已内置）

- 激活响应不是明文 true/false，而是签名许可证（防伪造）
- `nonce` 一次性校验 + 时间戳窗口（防重放）
- key 与 `deviceId` 绑定（重装幂等，同设备可重复激活）
