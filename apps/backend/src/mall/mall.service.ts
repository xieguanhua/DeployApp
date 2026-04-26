import { randomBytes, createHmac, createSign, createVerify } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import * as bcrypt from 'bcrypt';

type UserRole = 'admin' | 'user';
type PlatformType = 'windows' | 'mac' | 'ios' | 'android' | 'linux' | 'web';
type EnableStatus = '1' | '2';

@Injectable()
export class MallService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.bootstrapSchema();
    await this.ensureInitAdmin();
    await this.ensureSystemSeed();
  }

  private async bootstrapSchema() {
    const statements = [
      `CREATE TABLE IF NOT EXISTS activation_products (
        id BIGSERIAL PRIMARY KEY,
        product_code VARCHAR(64) UNIQUE NOT NULL,
        product_name VARCHAR(128) NOT NULL,
        client_type VARCHAR(32) NOT NULL CHECK (client_type IN ('windows', 'mac', 'ios', 'android', 'linux', 'web')),
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        cover_image_url TEXT,
        promo_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
        install_packages JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        email VARCHAR(128) UNIQUE,
        phone VARCHAR(32) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(16) NOT NULL CHECK (role IN ('admin', 'user')),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(128)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON users(phone) WHERE phone IS NOT NULL`,
      `CREATE TABLE IF NOT EXISTS activation_keys (
        id BIGSERIAL PRIMARY KEY,
        key_code VARCHAR(64) UNIQUE NOT NULL,
        product_code VARCHAR(64) NOT NULL REFERENCES activation_products(product_code),
        client_type VARCHAR(32) NOT NULL CHECK (client_type IN ('windows', 'mac', 'ios', 'android', 'linux', 'web')),
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        status VARCHAR(16) NOT NULL DEFAULT 'unused',
        allocated_user_id BIGINT REFERENCES users(id),
        allocated_order_id BIGINT,
        allocated_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        assigned_device_id VARCHAR(256),
        activated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
        id BIGSERIAL PRIMARY KEY,
        order_no VARCHAR(64) UNIQUE NOT NULL,
        user_id BIGINT NOT NULL REFERENCES users(id),
        product_code VARCHAR(64) NOT NULL REFERENCES activation_products(product_code),
        amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
        payment_channel VARCHAR(32) NOT NULL CHECK (payment_channel IN ('alipay', 'wechat')),
        payment_status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'closed')),
        payment_provider_order_no VARCHAR(128),
        provider_trade_no VARCHAR(128),
        assigned_key_code VARCHAR(64),
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS activations (
        id BIGSERIAL PRIMARY KEY,
        key_code VARCHAR(64) NOT NULL REFERENCES activation_keys(key_code),
        device_id VARCHAR(256) NOT NULL,
        request_id VARCHAR(128) UNIQUE NOT NULL,
        nonce VARCHAR(128) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS used_nonces (
        nonce VARCHAR(128) PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS system_roles (
        id BIGSERIAL PRIMARY KEY,
        role_name VARCHAR(64) NOT NULL,
        role_code VARCHAR(64) UNIQUE NOT NULL,
        role_desc VARCHAR(255) NOT NULL DEFAULT '',
        status VARCHAR(2) NOT NULL DEFAULT '1',
        create_by VARCHAR(64) NOT NULL DEFAULT 'system',
        create_time TIMESTAMPTZ NOT NULL DEFAULT now(),
        update_by VARCHAR(64) NOT NULL DEFAULT 'system',
        update_time TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS system_menus (
        id BIGSERIAL PRIMARY KEY,
        parent_id BIGINT NOT NULL DEFAULT 0,
        menu_type VARCHAR(2) NOT NULL,
        menu_name VARCHAR(128) NOT NULL,
        route_name VARCHAR(128) NOT NULL,
        route_path VARCHAR(255) NOT NULL,
        component VARCHAR(255),
        icon VARCHAR(128) NOT NULL DEFAULT '',
        icon_type VARCHAR(2) NOT NULL DEFAULT '1',
        i18n_key VARCHAR(255),
        menu_order INTEGER NOT NULL DEFAULT 0,
        keep_alive BOOLEAN NOT NULL DEFAULT FALSE,
        constant BOOLEAN NOT NULL DEFAULT FALSE,
        href TEXT,
        hide_in_menu BOOLEAN NOT NULL DEFAULT FALSE,
        active_menu VARCHAR(128),
        multi_tab BOOLEAN NOT NULL DEFAULT FALSE,
        fixed_index_in_tab INTEGER,
        query JSONB NOT NULL DEFAULT '[]'::jsonb,
        buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(2) NOT NULL DEFAULT '1',
        create_by VARCHAR(64) NOT NULL DEFAULT 'system',
        create_time TIMESTAMPTZ NOT NULL DEFAULT now(),
        update_by VARCHAR(64) NOT NULL DEFAULT 'system',
        update_time TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS system_role_auth (
        role_id BIGINT PRIMARY KEY,
        home VARCHAR(128) NOT NULL DEFAULT 'home',
        menu_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        button_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
        update_time TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_product_created ON orders(product_code, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_activation_keys_product_status ON activation_keys(product_code, status)`,
      `CREATE INDEX IF NOT EXISTS idx_activations_key_device ON activations(key_code, device_id)`
    ];

    for (const sql of statements) {
      await this.prisma.$executeRawUnsafe(sql);
    }

    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE activation_products ADD COLUMN IF NOT EXISTS cover_image_url TEXT`
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE activation_products ADD COLUMN IF NOT EXISTS promo_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb`
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE activation_products ADD COLUMN IF NOT EXISTS install_packages JSONB NOT NULL DEFAULT '[]'::jsonb`
    );

    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE activation_products
       DROP CONSTRAINT IF EXISTS activation_products_client_type_check`
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE activation_keys
       DROP CONSTRAINT IF EXISTS activation_keys_client_type_check`
    );

    // 兼容历史 client_type 数据。
    await this.prisma.$executeRawUnsafe(
      `UPDATE activation_products
       SET client_type = CASE client_type
         WHEN 'frontend' THEN 'windows'
         WHEN 'backend' THEN 'mac'
         WHEN 'fullstack' THEN 'ios'
         ELSE client_type
       END
       WHERE client_type IN ('frontend', 'backend', 'fullstack')`
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE activation_keys
       SET client_type = CASE client_type
         WHEN 'frontend' THEN 'windows'
         WHEN 'backend' THEN 'mac'
         WHEN 'fullstack' THEN 'ios'
         ELSE client_type
       END
       WHERE client_type IN ('frontend', 'backend', 'fullstack')`
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE activation_products
       SET client_type = 'windows'
       WHERE client_type IS NULL
          OR client_type NOT IN ('windows', 'mac', 'ios', 'android', 'linux', 'web')`
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE activation_keys
       SET client_type = 'windows'
       WHERE client_type IS NULL
          OR client_type NOT IN ('windows', 'mac', 'ios', 'android', 'linux', 'web')`
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE activation_products
       ADD CONSTRAINT activation_products_client_type_check
       CHECK (client_type IN ('windows', 'mac', 'ios', 'android', 'linux', 'web'))`
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE activation_keys
       ADD CONSTRAINT activation_keys_client_type_check
       CHECK (client_type IN ('windows', 'mac', 'ios', 'android', 'linux', 'web'))`
    );

    await this.prisma.$executeRawUnsafe(
      `DO $$
       BEGIN
         BEGIN
           INSERT INTO activation_products (product_code, product_name, client_type, price_cents)
           VALUES ('TRADING_AGENTS', 'TradingAgents', 'windows', 0)
           ON CONFLICT (product_code) DO NOTHING;
         EXCEPTION WHEN check_violation THEN
           INSERT INTO activation_products (product_code, product_name, client_type, price_cents)
           VALUES ('TRADING_AGENTS', 'TradingAgents', 'frontend', 0)
           ON CONFLICT (product_code) DO NOTHING;
         END;
       END $$;`
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE activation_products
       SET client_type = 'windows'
       WHERE product_code = 'TRADING_AGENTS' AND client_type = 'frontend'`
    );
  }

  private async ensureInitAdmin() {
    const username = process.env.INIT_ADMIN_USERNAME || 'admin';
    const password = process.env.INIT_ADMIN_PASSWORD || 'Hua15989449409';

    const existed = await this.findUserByUsername(username);
    if (existed) {
      if (existed.role !== 'admin') {
        await this.prisma.$executeRawUnsafe(`UPDATE users SET role = 'admin' WHERE id = $1`, existed.id);
      }
      return;
    }

    await this.createUser(username, password, 'admin');
  }

  private async ensureSystemSeed() {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO system_roles (id, role_name, role_code, role_desc, status)
       VALUES
        (1, '超级管理员', 'R_SUPER', '系统超级管理员', '1'),
        (2, '管理员', 'R_ADMIN', '后台管理员', '1'),
        (3, '普通用户', 'R_USER', '前台普通用户', '1')
       ON CONFLICT (id) DO NOTHING`
    );

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO system_menus (id, parent_id, menu_type, menu_name, route_name, route_path, icon, icon_type, i18n_key, menu_order, keep_alive, constant, hide_in_menu, multi_tab, query, buttons, status)
       VALUES
        (6, 0, '2', '首页', 'home', '/home', 'mdi:monitor-dashboard', '1', 'route.home', 1, false, false, false, false, '[]'::jsonb, '[]'::jsonb, '1'),
        (7, 0, '2', '购买列表', 'purchase-orders', '/purchase-orders', 'mdi:clipboard-list-outline', '1', 'route.purchase-orders', 2, false, false, false, false, '[]'::jsonb, '[]'::jsonb, '1'),
        (8, 0, '2', '个人中心', 'user-center', '/user-center', 'mdi:account-cog-outline', '1', 'route.user-center', 3, false, false, false, false, '[]'::jsonb, '[]'::jsonb, '1'),
        (1, 0, '1', '系统管理', 'manage', '/manage', 'carbon:cloud-service-management', '1', 'route.manage', 9, false, false, false, false, '[]'::jsonb, '[]'::jsonb, '1'),
        (2, 1, '2', '用户管理', 'manage_user', '/manage/user', 'ic:round-manage-accounts', '1', 'route.manage_user', 1, false, false, false, false, '[]'::jsonb, '[]'::jsonb, '1'),
        (3, 1, '2', '角色管理', 'manage_role', '/manage/role', 'carbon:user-role', '1', 'route.manage_role', 2, false, false, false, false, '[]'::jsonb, '[{"code":"role:add","desc":"新增角色"},{"code":"role:edit","desc":"编辑角色"}]'::jsonb, '1'),
        (4, 1, '2', '菜单管理', 'manage_menu', '/manage/menu', 'material-symbols:route', '1', 'route.manage_menu', 3, false, false, false, false, '[]'::jsonb, '[{"code":"menu:add","desc":"新增菜单"},{"code":"menu:edit","desc":"编辑菜单"}]'::jsonb, '1'),
        (5, 0, '2', '产品管理', 'manage_products', '/manage/products', 'mdi:package-variant-closed', '1', 'route.manage_products', 8, true, false, false, false, '[]'::jsonb, '[{"code":"product:edit","desc":"编辑产品"}]'::jsonb, '1')
       ON CONFLICT (id) DO NOTHING`
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE system_menus SET route_path = '/products' WHERE route_name = 'manage_products'`
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE system_menus
       SET route_path = CASE route_name
         WHEN 'home' THEN '/home'
         WHEN 'purchase-orders' THEN '/purchase-orders'
         WHEN 'user-center' THEN '/user-center'
         ELSE route_path
       END
       WHERE route_name IN ('home', 'purchase-orders', 'user-center')`
    );
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO system_role_auth (role_id, home, menu_ids, button_codes, update_time)
       SELECT r.id, 'home', (
         SELECT COALESCE(jsonb_agg(m.id ORDER BY m.id), '[]'::jsonb)
         FROM system_menus m
         WHERE m.status = '1'
       ), '[]'::jsonb, now()
       FROM system_roles r
       WHERE r.role_code = 'R_SUPER'
         AND NOT EXISTS (SELECT 1 FROM system_role_auth a WHERE a.role_id = r.id)`
    );
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO system_role_auth (role_id, home, menu_ids, button_codes, update_time)
       SELECT r.id, 'home', (
         SELECT COALESCE(jsonb_agg(m.id ORDER BY m.id), '[]'::jsonb)
         FROM system_menus m
         WHERE m.status = '1'
           AND m.route_name IN ('home', 'purchase-orders', 'user-center')
       ), '[]'::jsonb, now()
       FROM system_roles r
       WHERE r.role_code = 'R_USER'
         AND NOT EXISTS (SELECT 1 FROM system_role_auth a WHERE a.role_id = r.id)`
    );
  }

  genKey(prefix = 'TA') {
    const raw = randomBytes(12).toString('hex').toUpperCase();
    return `${prefix}-${raw.slice(0, 6)}-${raw.slice(6, 12)}-${raw.slice(12, 18)}`;
  }

  genOrderNo(prefix = 'ORD') {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  async createUser(username: string, password: string, role: UserRole = 'user') {
    return this.createUserWithProfile({ username, password, role });
  }

  async createUserWithProfile(input: {
    username: string;
    password: string;
    role?: UserRole;
    email?: string | null;
    phone?: string | null;
  }) {
    const hash = await bcrypt.hash(input.password, 12);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO users (username, email, phone, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (username) DO NOTHING
       RETURNING id, username, email, phone, role, is_active`,
      input.username,
      input.email || null,
      input.phone || null,
      hash,
      input.role || 'user'
    );
    return rows[0] || null;
  }

  async findUserByUsername(username: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, username, email, phone, password_hash, role, is_active FROM users WHERE username = $1 LIMIT 1`,
      username
    );
    return rows[0] || null;
  }

  async findUserByEmail(email: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, username, email, phone, password_hash, role, is_active FROM users WHERE email = $1 LIMIT 1`,
      email
    );
    return rows[0] || null;
  }

  async findUserByPhone(phone: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, username, email, phone, password_hash, role, is_active FROM users WHERE phone = $1 LIMIT 1`,
      phone
    );
    return rows[0] || null;
  }

  async findUserByAccount(account: string) {
    const text = (account || '').trim();
    const normalizedPhone = text.replace(/[^\d+]/g, '');
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, username, email, phone, password_hash, role, is_active
       FROM users
       WHERE username = $1
          OR LOWER(email) = LOWER($1)
          OR phone = $1
          OR regexp_replace(COALESCE(phone, ''), '[^0-9+]', '', 'g') = $2
       LIMIT 1`,
      text,
      normalizedPhone
    );
    return rows[0] || null;
  }

  async updatePasswordByUserId(userId: number, newPassword: string) {
    const newHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$executeRawUnsafe(`UPDATE users SET password_hash = $1 WHERE id = $2`, newHash, userId);
  }

  async verifyUserPassword(user: any, password: string) {
    return bcrypt.compare(password, user.password_hash);
  }

  async changePassword(params: { userId: number; oldPassword: string; newPassword: string }) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, password_hash, is_active FROM users WHERE id = $1 LIMIT 1`,
      params.userId
    );
    const user = rows[0];
    if (!user || !user.is_active) return { ok: false as const, reason: 'not_found' as const };

    const oldOk = await bcrypt.compare(params.oldPassword, user.password_hash);
    if (!oldOk) return { ok: false as const, reason: 'old_password_error' as const };

    const newHash = await bcrypt.hash(params.newPassword, 12);
    await this.prisma.$executeRawUnsafe(`UPDATE users SET password_hash = $1 WHERE id = $2`, newHash, user.id);
    return { ok: true as const };
  }

  async products() {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT product_code, product_name, client_type, price_cents, is_active,
              cover_image_url, promo_image_urls, install_packages, created_at
       FROM activation_products ORDER BY created_at DESC`
    );
  }

  async upsertProduct(input: {
    productCode: string;
    productName: string;
    clientType?: PlatformType;
    priceCents: number;
    isActive?: boolean;
    coverImageUrl?: string | null;
    promoImageUrls?: string[];
    installPackages?: Array<{
      platform: PlatformType;
      packageName: string;
      packageUrl: string;
    }>;
  }) {
    const clientType = input.clientType || input.installPackages?.[0]?.platform || 'windows';
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO activation_products (
         product_code, product_name, client_type, price_cents, is_active, cover_image_url, promo_image_urls, install_packages
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
       ON CONFLICT (product_code)
       DO UPDATE SET product_name = EXCLUDED.product_name,
                     client_type = EXCLUDED.client_type,
                     price_cents = EXCLUDED.price_cents,
                    is_active = EXCLUDED.is_active,
                    cover_image_url = EXCLUDED.cover_image_url,
                    promo_image_urls = EXCLUDED.promo_image_urls,
                    install_packages = EXCLUDED.install_packages
       RETURNING product_code, product_name, client_type, price_cents, is_active, cover_image_url, promo_image_urls, install_packages`,
      input.productCode,
      input.productName,
      clientType,
      input.priceCents,
      input.isActive ?? true,
      input.coverImageUrl || null,
      JSON.stringify(input.promoImageUrls || []),
      JSON.stringify(input.installPackages || [])
    );
    return rows[0];
  }

  async deleteProduct(productCode: string) {
    const countRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(1)::int AS count FROM activation_keys WHERE product_code = $1`,
      productCode
    );
    if (Number(countRows[0]?.count || 0) > 0) return false;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `DELETE FROM activation_products WHERE product_code = $1 RETURNING product_code`,
      productCode
    );
    return !!rows[0];
  }

  async createKeys(body: { productCode: string; count: number; prefix?: string }) {
    const productRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT product_code, client_type, price_cents, is_active FROM activation_products WHERE product_code = $1 LIMIT 1`,
      body.productCode
    );
    const product = productRows[0];
    if (!product || !product.is_active) return null;

    const keys: string[] = [];
    for (let i = 0; i < body.count; i += 1) {
      const key = this.genKey(body.prefix || 'TA');
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO activation_keys (key_code, product_code, client_type, price_cents, status)
         VALUES ($1, $2, $3, $4, 'unused')`,
        key,
        product.product_code,
        product.client_type,
        product.price_cents
      );
      keys.push(key);
    }
    return keys;
  }

  async revokeKey(keyCode: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE activation_keys
       SET status = 'revoked', revoked_at = now()
       WHERE key_code = $1 AND assigned_device_id IS NULL
       RETURNING key_code, status, revoked_at`,
      keyCode
    );
    return rows[0] || null;
  }

  async listCodesByProduct(productCode: string) {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT k.key_code, k.status, k.product_code, k.client_type, k.price_cents, k.allocated_at, k.revoked_at,
              o.order_no, o.payment_status,
              u.username,
              COALESCE(array_agg(DISTINCT a.device_id) FILTER (WHERE a.device_id IS NOT NULL), '{}') AS device_ids
       FROM activation_keys k
       LEFT JOIN orders o ON o.id = k.allocated_order_id
       LEFT JOIN users u ON u.id = k.allocated_user_id
       LEFT JOIN activations a ON a.key_code = k.key_code
       WHERE k.product_code = $1
       GROUP BY k.key_code, k.status, k.product_code, k.client_type, k.price_cents, k.allocated_at, k.revoked_at, o.order_no, o.payment_status, u.username
       ORDER BY k.created_at DESC`,
      productCode
    );
  }

  async createOrder(userId: number, body: { productCode: string; paymentChannel: 'alipay' | 'wechat' }) {
    const productRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT product_code, product_name, price_cents, is_active FROM activation_products WHERE product_code = $1 LIMIT 1`,
      body.productCode
    );
    const product = productRows[0];
    if (!product || !product.is_active) return null;
    const orderNo = this.genOrderNo();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO orders (order_no, user_id, product_code, amount_cents, payment_channel, payment_status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id, order_no, product_code, amount_cents, payment_channel, payment_status, created_at`,
      orderNo,
      userId,
      product.product_code,
      product.price_cents,
      body.paymentChannel
    );
    return { order: rows[0], product };
  }

  async markOrderPaidAndAssign(orderNo: string, tradeNo: string) {
    const orderRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, user_id, product_code, payment_status, assigned_key_code
       FROM orders WHERE order_no = $1 LIMIT 1`,
      orderNo
    );
    const order = orderRows[0];
    if (!order) return null;

    if (order.payment_status !== 'paid') {
      await this.prisma.$executeRawUnsafe(
        `UPDATE orders SET payment_status = 'paid', provider_trade_no = $1, paid_at = now(), updated_at = now() WHERE id = $2`,
        tradeNo,
        order.id
      );
    }
    if (order.assigned_key_code) return order.assigned_key_code;

    const keyRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT key_code FROM activation_keys
       WHERE product_code = $1 AND status = 'unused' AND allocated_order_id IS NULL AND revoked_at IS NULL
       ORDER BY created_at ASC
       LIMIT 1`,
      order.product_code
    );
    const key = keyRows[0];
    if (!key) return null;

    await this.prisma.$executeRawUnsafe(
      `UPDATE activation_keys
       SET allocated_user_id = $1, allocated_order_id = $2, allocated_at = now()
       WHERE key_code = $3`,
      order.user_id,
      order.id,
      key.key_code
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE orders SET assigned_key_code = $1, updated_at = now() WHERE id = $2`,
      key.key_code,
      order.id
    );
    return key.key_code;
  }

  async listUserOrders(userId: number) {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, order_no, product_code, amount_cents, payment_channel, payment_status, assigned_key_code, provider_trade_no, paid_at, created_at, updated_at
       FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      userId
    );
  }

  async listAllOrders(params?: {
    productCode?: string;
    paymentStatus?: string;
    source?: 'order' | 'manual' | 'all';
    keyword?: string;
  }) {
    const whereSql: string[] = ['1=1'];
    const values: any[] = [];
    const push = (v: any) => {
      values.push(v);
      return `$${values.length}`;
    };

    if (params?.productCode) {
      whereSql.push(`src.product_code = ${push(params.productCode)}`);
    }
    if (params?.source && params.source !== 'all') {
      whereSql.push(`src.record_type = ${push(params.source)}`);
    }
    if (params?.paymentStatus) {
      whereSql.push(`src.payment_status = ${push(params.paymentStatus)}`);
    }
    if (params?.keyword) {
      const keyword = `%${params.keyword}%`;
      const p = push(keyword);
      whereSql.push(`(
        COALESCE(src.order_no, '') ILIKE ${p}
        OR COALESCE(src.assigned_key_code, '') ILIKE ${p}
        OR COALESCE(src.username, '') ILIKE ${p}
      )`);
    }

    const whereClause = whereSql.join(' AND ');
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT *
       FROM (
         SELECT
           o.id::text AS id,
           o.order_no,
           o.user_id::text AS user_id,
           u.username,
           o.product_code,
           o.amount_cents,
           o.payment_channel,
           o.payment_status,
           o.assigned_key_code,
           o.provider_trade_no,
           o.paid_at,
           o.created_at,
           o.updated_at,
           'order'::text AS record_type
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         UNION ALL
         SELECT
           k.id::text AS id,
           NULL::varchar AS order_no,
           k.allocated_user_id::text AS user_id,
           u.username,
           k.product_code,
           k.price_cents AS amount_cents,
           'manual'::varchar AS payment_channel,
           CASE
             WHEN k.status = 'revoked' THEN 'revoked'
             WHEN k.allocated_order_id IS NULL AND k.allocated_user_id IS NULL THEN 'manual_unallocated'
             WHEN k.assigned_device_id IS NOT NULL THEN 'activated'
             WHEN k.allocated_user_id IS NOT NULL THEN 'manual_allocated'
             ELSE COALESCE(k.status, 'manual')
           END AS payment_status,
           k.key_code AS assigned_key_code,
           NULL::varchar AS provider_trade_no,
           k.activated_at AS paid_at,
           k.created_at,
           k.created_at AS updated_at,
           'manual'::text AS record_type
         FROM activation_keys k
         LEFT JOIN users u ON u.id = k.allocated_user_id
         WHERE k.allocated_order_id IS NULL
       ) src
       WHERE ${whereClause}
       ORDER BY src.created_at DESC`,
      ...values
    );
  }

  async listUserCodes(userId: number) {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT k.key_code, k.product_code, k.client_type, k.status, k.assigned_device_id, k.activated_at, k.created_at,
              o.order_no, o.payment_status,
              COALESCE(array_agg(DISTINCT a.device_id) FILTER (WHERE a.device_id IS NOT NULL), '{}') AS device_ids
       FROM activation_keys k
       LEFT JOIN orders o ON o.id = k.allocated_order_id
       LEFT JOIN activations a ON a.key_code = k.key_code
       WHERE k.allocated_user_id = $1
       GROUP BY k.key_code, k.product_code, k.client_type, k.status, k.assigned_device_id, k.activated_at, k.created_at, o.order_no, o.payment_status
       ORDER BY k.created_at DESC`,
      userId
    );
  }

  async activate(body: {
    activationKey: string;
    deviceId: string;
    nonce: string;
    requestId: string;
    timestamp: number;
    productCode?: string;
    clientType?: PlatformType;
  }) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT key_code, status, assigned_device_id, product_code, client_type, price_cents
       FROM activation_keys WHERE key_code = $1 LIMIT 1`,
      body.activationKey
    );
    const key = rows[0];
    if (!key) return { error: 'not_found' as const };
    if (key.status === 'revoked') return { error: 'revoked' as const };
    if (body.productCode && body.productCode !== key.product_code) return { error: 'product_mismatch' as const };
    if (body.clientType && body.clientType !== key.client_type) return { error: 'client_mismatch' as const };

    if (!key.assigned_device_id) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE activation_keys SET assigned_device_id = $1, status = 'used', activated_at = now() WHERE key_code = $2`,
        body.deviceId,
        body.activationKey
      );
    } else if (key.assigned_device_id !== body.deviceId) {
      return { error: 'device_mismatch' as const };
    }

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO activations (key_code, device_id, request_id, nonce)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (request_id) DO NOTHING`,
      body.activationKey,
      body.deviceId,
      body.requestId,
      body.nonce
    );

    return {
      error: null,
      data: {
        productCode: key.product_code,
        clientType: key.client_type,
        priceCents: Number(key.price_cents)
      }
    };
  }

  verifyAiSignature(rawBody: string, timestamp: string, nonce: string, signature: string, secret: string) {
    const expected = createHmac('sha256', secret).update(`${timestamp}.${nonce}.${rawBody}`).digest('hex');
    return expected === signature;
  }

  signAlipayPayload(payload: string, privateKey: string) {
    const signer = createSign('RSA-SHA256');
    signer.update(payload, 'utf8');
    return signer.sign(privateKey, 'base64');
  }

  verifyAlipaySignature(payload: string, signature: string, publicKey: string) {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(payload, 'utf8');
    return verifier.verify(publicKey, signature, 'base64');
  }

  async listPurchasedProductsStatus(userId: number) {
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT p.product_code,
              p.product_name,
              p.client_type,
              p.price_cents,
              p.is_active,
              p.cover_image_url,
              p.promo_image_urls,
              p.install_packages,
              MAX(CASE WHEN k.assigned_device_id IS NOT NULL THEN 1 ELSE 0 END) AS activated_flag,
              COALESCE(array_agg(DISTINCT k.assigned_device_id) FILTER (WHERE k.assigned_device_id IS NOT NULL), '{}') AS device_ids
       FROM orders o
       INNER JOIN activation_products p ON p.product_code = o.product_code
       LEFT JOIN activation_keys k ON k.allocated_order_id = o.id
       WHERE o.user_id = $1 AND o.payment_status = 'paid'
       GROUP BY p.product_code, p.product_name, p.client_type, p.price_cents, p.is_active, p.cover_image_url, p.promo_image_urls, p.install_packages
       ORDER BY p.product_code`,
      userId
    );
  }

  async listSystemUsers(params: {
    current?: number;
    size?: number;
    userName?: string;
    userPhone?: string;
    userEmail?: string;
    status?: EnableStatus;
  }) {
    const current = Math.max(1, Number(params.current || 1));
    const size = Math.min(100, Math.max(1, Number(params.size || 10)));
    const offset = (current - 1) * size;

    const whereSql: string[] = ['1=1'];
    const values: any[] = [];
    const pushValue = (value: any) => {
      values.push(value);
      return `$${values.length}`;
    };

    if (params.userName) {
      const p = pushValue(`%${params.userName}%`);
      whereSql.push(`username ILIKE ${p}`);
    }
    if (params.userPhone) {
      const p = pushValue(`%${params.userPhone}%`);
      whereSql.push(`COALESCE(phone, '') ILIKE ${p}`);
    }
    if (params.userEmail) {
      const p = pushValue(`%${params.userEmail}%`);
      whereSql.push(`COALESCE(email, '') ILIKE ${p}`);
    }
    if (params.status) {
      whereSql.push(params.status === '1' ? `is_active = TRUE` : `is_active = FALSE`);
    }

    const whereClause = whereSql.join(' AND ');
    const countRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(1)::int AS total FROM users WHERE ${whereClause}`,
      ...values
    );
    const total = Number(countRows[0]?.total || 0);

    const limitPlaceholder = pushValue(size);
    const offsetPlaceholder = pushValue(offset);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, username, email, phone, role, is_active, created_at
       FROM users
       WHERE ${whereClause}
       ORDER BY id DESC
       LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      ...values
    );

    const records = rows.map(row => {
      const roleCode = row.role === 'admin' ? 'R_SUPER' : 'R_USER';
      return {
        id: Number(row.id),
        userName: row.username,
        userGender: '1' as const,
        nickName: row.username,
        userPhone: row.phone || '',
        userEmail: row.email || '',
        userRoles: [roleCode],
        createBy: 'system',
        createTime: row.created_at,
        updateBy: 'system',
        updateTime: row.created_at,
        status: (row.is_active ? '1' : '2') as EnableStatus
      };
    });

    return { current, size, total, records };
  }

  async getSystemUserDetail(id: number) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, username, email, phone, role, is_active, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      id
    );
    const row = rows[0];
    if (!row) return null;

    const roleCode = row.role === 'admin' ? 'R_SUPER' : 'R_USER';

    return {
      id: Number(row.id),
      userName: row.username,
      userGender: '1' as const,
      nickName: row.username,
      userPhone: row.phone || '',
      userEmail: row.email || '',
      userRoles: [roleCode],
      createBy: 'system',
      createTime: row.created_at,
      updateBy: 'system',
      updateTime: row.created_at,
      status: (row.is_active ? '1' : '2') as EnableStatus
    };
  }

  async listSystemRoles(params: {
    current?: number;
    size?: number;
    roleName?: string;
    roleCode?: string;
    status?: EnableStatus;
  }) {
    const current = Math.max(1, Number(params.current || 1));
    const size = Math.min(100, Math.max(1, Number(params.size || 10)));
    const offset = (current - 1) * size;
    const whereSql: string[] = ['1=1'];
    const values: any[] = [];
    const push = (v: any) => {
      values.push(v);
      return `$${values.length}`;
    };
    if (params.roleName) whereSql.push(`role_name ILIKE ${push(`%${params.roleName}%`)}`);
    if (params.roleCode) whereSql.push(`role_code ILIKE ${push(`%${params.roleCode}%`)}`);
    if (params.status) whereSql.push(`status = ${push(params.status)}`);
    const whereClause = whereSql.join(' AND ');

    const totalRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(1)::int AS total FROM system_roles WHERE ${whereClause}`,
      ...values
    );
    const pLimit = push(size);
    const pOffset = push(offset);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, role_name, role_code, role_desc, status, create_by, create_time, update_by, update_time
       FROM system_roles WHERE ${whereClause}
       ORDER BY id ASC LIMIT ${pLimit} OFFSET ${pOffset}`,
      ...values
    );
    const records = rows.map(r => ({
      id: Number(r.id),
      roleName: r.role_name,
      roleCode: r.role_code,
      roleDesc: r.role_desc,
      status: r.status as EnableStatus,
      createBy: r.create_by,
      createTime: r.create_time,
      updateBy: r.update_by,
      updateTime: r.update_time
    }));
    return { current, size, total: Number(totalRows[0]?.total || 0), records };
  }

  async getAllSystemRoles() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, role_name, role_code FROM system_roles WHERE status = '1' ORDER BY id ASC`
    );
    return rows.map(r => ({ id: Number(r.id), roleName: r.role_name, roleCode: r.role_code }));
  }

  async listSystemMenus() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM system_menus ORDER BY menu_order ASC, id ASC`
    );
    const records = rows.map(r => ({
      id: Number(r.id),
      parentId: Number(r.parent_id),
      menuType: r.menu_type,
      menuName: r.menu_name,
      routeName: r.route_name,
      routePath: r.route_path,
      component: r.component,
      icon: r.icon,
      iconType: r.icon_type,
      i18nKey: r.i18n_key,
      order: Number(r.menu_order || 0),
      keepAlive: !!r.keep_alive,
      constant: !!r.constant,
      href: r.href,
      hideInMenu: !!r.hide_in_menu,
      activeMenu: r.active_menu,
      multiTab: !!r.multi_tab,
      fixedIndexInTab: r.fixed_index_in_tab,
      query: r.query || [],
      buttons: r.buttons || [],
      status: r.status as EnableStatus,
      createBy: r.create_by,
      createTime: r.create_time,
      updateBy: r.update_by,
      updateTime: r.update_time
    }));
    return { current: 1, size: records.length, total: records.length, records };
  }

  async getSystemMenuTree() {
    const { records } = await this.listSystemMenus();
    const makeNode = (item: any): any => ({
      id: item.id,
      pId: item.parentId,
      label: item.menuName,
      children: records.filter((child: any) => child.parentId === item.id).map(makeNode)
    });
    return records.filter((item: any) => item.parentId === 0).map(makeNode);
  }

  async getSystemAllPages() {
    const { records } = await this.listSystemMenus();
    return records.map((item: any) => item.routeName).filter(Boolean);
  }

  private getDefaultComponent(menu: any, hasVisibleChild: boolean, isTopLevel: boolean) {
    if (menu.component && String(menu.component).trim()) return String(menu.component).trim();
    if (hasVisibleChild || menu.menuType === '1') return 'layout.base';
    if (isTopLevel) return `layout.base$view.${menu.routeName}`;
    return `view.${menu.routeName}`;
  }

  private normalizeMenuMeta(menu: any) {
    return {
      title: menu.routeName,
      i18nKey: menu.i18nKey || undefined,
      icon: menu.icon || undefined,
      order: Number(menu.order || 0),
      keepAlive: !!menu.keepAlive,
      href: menu.href || undefined,
      hideInMenu: !!menu.hideInMenu,
      activeMenu: menu.activeMenu || undefined,
      multiTab: !!menu.multiTab,
      fixedIndexInTab: menu.fixedIndexInTab ?? undefined,
      query: Array.isArray(menu.query) ? menu.query : []
    };
  }

  private buildAuthRoutesTree(records: any[], allowedIds?: Set<number>) {
    const enabled = records.filter(item => item.status === '1');
    const byId = new Map<number, any>(enabled.map(item => [Number(item.id), item]));
    const childrenMap = new Map<number, any[]>();

    enabled.forEach(item => {
      const parentId = Number(item.parentId || 0);
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(item);
    });

    const expandIds = new Set<number>();
    if (allowedIds && allowedIds.size > 0) {
      for (const id of allowedIds) {
        let current: any = byId.get(id);
        while (current) {
          const cid = Number(current.id);
          if (expandIds.has(cid)) break;
          expandIds.add(cid);
          current = byId.get(Number(current.parentId || 0));
        }
      }
    }

    const canInclude = (item: any) => {
      if (!allowedIds || allowedIds.size === 0) return true;
      return expandIds.has(Number(item.id));
    };

    const sortByOrder = (a: any, b: any) => Number(a.order || 0) - Number(b.order || 0) || Number(a.id) - Number(b.id);

    const buildNode = (item: any): any | null => {
      if (!canInclude(item)) return null;

      const directChildren = (childrenMap.get(Number(item.id)) || []).sort(sortByOrder);
      const children = directChildren.map(buildNode).filter(Boolean);
      const hasVisibleChild = children.length > 0;

      if (!item.routeName || !item.routePath) return null;

      const isTopLevel = Number(item.parentId || 0) === 0;

      return {
        id: String(item.id),
        name: item.routeName,
        path: item.routePath,
        component: this.getDefaultComponent(item, hasVisibleChild, isTopLevel),
        meta: this.normalizeMenuMeta(item),
        ...(hasVisibleChild ? { children } : {})
      };
    };

    return (childrenMap.get(0) || []).sort(sortByOrder).map(buildNode).filter(Boolean);
  }

  private flattenRouteNames(routes: any[]) {
    const names: string[] = [];
    const dfs = (list: any[]) => {
      for (const route of list) {
        if (route?.name) names.push(String(route.name));
        if (Array.isArray(route?.children) && route.children.length > 0) {
          dfs(route.children);
        }
      }
    };
    dfs(routes || []);
    return names;
  }

  private getRouteNameSetByRoleCode(records: any[], roleCode: string, menuIds: number[]) {
    const routeNameToId = new Map<string, number>(records.map(item => [String(item.routeName), Number(item.id)]));
    const roleIdSet = new Set<number>((menuIds || []).map(n => Number(n)).filter(Boolean));

    if (roleIdSet.size > 0) {
      return roleIdSet;
    }

    // 兼容未配置角色授权的历史数据：管理员默认可见全部，普通用户默认仅前台菜单。
    if (roleCode === 'R_SUPER' || roleCode === 'R_ADMIN') {
      return new Set<number>(records.filter(item => item.status === '1').map(item => Number(item.id)));
    }

    const fallbackNames = ['home', 'purchase-orders', 'user-center'];
    const fallbackIds = fallbackNames.map(name => routeNameToId.get(name)).filter(Boolean) as number[];
    return new Set<number>(fallbackIds);
  }

  private normalizeRouteHome(home: string | undefined, routes: any[]) {
    const allNames = new Set(this.flattenRouteNames(routes));
    if (home && allNames.has(home)) {
      return home;
    }
    if (allNames.has('home')) {
      return 'home';
    }
    return routes[0]?.name || 'home';
  }

  async getConstantRoutes() {
    const { records } = await this.listSystemMenus();
    const constants = records.filter(item => item.constant && item.status === '1');
    return this.buildAuthRoutesTree(constants);
  }

  async getUserRoutesByRoleCode(roleCode: string) {
    const roleAuth = await this.getRoleAuthByCode(roleCode);
    const { records } = await this.listSystemMenus();
    const authIds = this.getRouteNameSetByRoleCode(records, roleCode, roleAuth.menuIds || []);
    const dynamicRecords = records.filter(item => !item.constant);
    const routes = this.buildAuthRoutesTree(dynamicRecords, authIds);
    const home = this.normalizeRouteHome(roleAuth.home, routes);
    return { routes, home };
  }

  async isRouteExistByRoleCode(roleCode: string, routeName: string) {
    const { routes } = await this.getUserRoutesByRoleCode(roleCode);
    const names = new Set(this.flattenRouteNames(routes));
    return names.has(routeName);
  }

  async upsertSystemUser(input: {
    id?: number;
    userName: string;
    userPhone?: string;
    userEmail?: string;
    status: EnableStatus;
    userRoles?: string[];
  }) {
    const role: UserRole = input.userRoles?.includes('R_SUPER') || input.userRoles?.includes('R_ADMIN') ? 'admin' : 'user';
    const isActive = input.status === '1';
    if (input.id) {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `UPDATE users SET username = $1, phone = $2, email = $3, role = $4, is_active = $5 WHERE id = $6 RETURNING id`,
        input.userName,
        input.userPhone || null,
        input.userEmail || null,
        role,
        isActive,
        input.id
      );
      return rows[0] || null;
    }
    const passwordHash = await bcrypt.hash('ChangeMe123_', 12);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO users (username, phone, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      input.userName,
      input.userPhone || null,
      input.userEmail || null,
      passwordHash,
      role,
      isActive
    );
    return rows[0] || null;
  }

  async deleteSystemUser(id: number) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`DELETE FROM users WHERE id = $1 RETURNING id`, id);
    return !!rows[0];
  }

  async upsertSystemRole(input: {
    id?: number;
    roleName: string;
    roleCode: string;
    roleDesc: string;
    status: EnableStatus;
  }) {
    if (input.id) {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `UPDATE system_roles
         SET role_name = $1, role_code = $2, role_desc = $3, status = $4, update_time = now()
         WHERE id = $5
         RETURNING id`,
        input.roleName,
        input.roleCode,
        input.roleDesc,
        input.status,
        input.id
      );
      return rows[0] || null;
    }
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO system_roles (role_name, role_code, role_desc, status, create_by, update_by)
       VALUES ($1, $2, $3, $4, 'system', 'system')
       RETURNING id`,
      input.roleName,
      input.roleCode,
      input.roleDesc,
      input.status
    );
    return rows[0] || null;
  }

  async deleteSystemRole(id: number) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`DELETE FROM system_roles WHERE id = $1 RETURNING id`, id);
    await this.prisma.$executeRawUnsafe(`DELETE FROM system_role_auth WHERE role_id = $1`, id);
    return !!rows[0];
  }

  async upsertSystemMenu(input: any) {
    if (input.id) {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `UPDATE system_menus
         SET parent_id = $1, menu_type = $2, menu_name = $3, route_name = $4, route_path = $5,
             component = $6, icon = $7, icon_type = $8, i18n_key = $9, menu_order = $10,
             keep_alive = $11, constant = $12, href = $13, hide_in_menu = $14, active_menu = $15,
             multi_tab = $16, fixed_index_in_tab = $17, query = $18::jsonb, buttons = $19::jsonb,
             status = $20, update_time = now()
         WHERE id = $21 RETURNING id`,
        input.parentId,
        input.menuType,
        input.menuName,
        input.routeName,
        input.routePath,
        input.component || null,
        input.icon || '',
        input.iconType || '1',
        input.i18nKey || null,
        Number(input.order || 0),
        !!input.keepAlive,
        !!input.constant,
        input.href || null,
        !!input.hideInMenu,
        input.activeMenu || null,
        !!input.multiTab,
        input.fixedIndexInTab ?? null,
        JSON.stringify(input.query || []),
        JSON.stringify(input.buttons || []),
        input.status || '1',
        input.id
      );
      return rows[0] || null;
    }
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO system_menus
       (parent_id, menu_type, menu_name, route_name, route_path, component, icon, icon_type, i18n_key,
        menu_order, keep_alive, constant, href, hide_in_menu, active_menu, multi_tab, fixed_index_in_tab,
        query, buttons, status, create_by, update_by)
       VALUES
       ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb,$20,'system','system')
       RETURNING id`,
      input.parentId,
      input.menuType,
      input.menuName,
      input.routeName,
      input.routePath,
      input.component || null,
      input.icon || '',
      input.iconType || '1',
      input.i18nKey || null,
      Number(input.order || 0),
      !!input.keepAlive,
      !!input.constant,
      input.href || null,
      !!input.hideInMenu,
      input.activeMenu || null,
      !!input.multiTab,
      input.fixedIndexInTab ?? null,
      JSON.stringify(input.query || []),
      JSON.stringify(input.buttons || []),
      input.status || '1'
    );
    return rows[0] || null;
  }

  async deleteSystemMenu(id: number) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT id, parent_id FROM system_menus`);
    const ids = new Set<number>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of rows) {
        const iid = Number(item.id);
        const pid = Number(item.parent_id);
        if (ids.has(pid) && !ids.has(iid)) {
          ids.add(iid);
          changed = true;
        }
      }
    }
    const idArr = Array.from(ids);
    const deleted = await this.prisma.$queryRawUnsafe<any[]>(
      `DELETE FROM system_menus WHERE id = ANY($1::bigint[]) RETURNING id`,
      idArr
    );
    return deleted.length > 0;
  }

  async getRoleMenuAuth(roleId: number) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT role_id, home, menu_ids, button_codes FROM system_role_auth WHERE role_id = $1 LIMIT 1`,
      roleId
    );
    const row = rows[0];
    if (!row) return { home: 'home', menuIds: [], buttonCodes: [] };
    return {
      home: row.home || 'home',
      menuIds: Array.isArray(row.menu_ids) ? row.menu_ids.map((n: any) => Number(n)) : [],
      buttonCodes: Array.isArray(row.button_codes) ? row.button_codes.map((s: any) => String(s)) : []
    };
  }

  async saveRoleMenuAuth(roleId: number, payload: { home: string; menuIds: number[] }) {
    const old = await this.getRoleMenuAuth(roleId);
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO system_role_auth (role_id, home, menu_ids, button_codes, update_time)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, now())
       ON CONFLICT (role_id)
       DO UPDATE SET home = EXCLUDED.home, menu_ids = EXCLUDED.menu_ids, button_codes = EXCLUDED.button_codes, update_time = now()`,
      roleId,
      payload.home,
      JSON.stringify(payload.menuIds || []),
      JSON.stringify(old.buttonCodes || [])
    );
    return this.getRoleMenuAuth(roleId);
  }

  async getRoleButtonAuth(roleId: number) {
    const auth = await this.getRoleMenuAuth(roleId);
    return auth.buttonCodes;
  }

  async getRoleAuthByCode(roleCode: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM system_roles WHERE role_code = $1 LIMIT 1`,
      roleCode
    );
    const roleId = Number(rows[0]?.id || 0);
    if (!roleId) {
      return { home: 'home', menuIds: [], buttonCodes: [] };
    }
    return this.getRoleMenuAuth(roleId);
  }

  async saveRoleButtonAuth(roleId: number, payload: { buttonCodes: string[] }) {
    const old = await this.getRoleMenuAuth(roleId);
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO system_role_auth (role_id, home, menu_ids, button_codes, update_time)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, now())
       ON CONFLICT (role_id)
       DO UPDATE SET home = EXCLUDED.home, menu_ids = EXCLUDED.menu_ids, button_codes = EXCLUDED.button_codes, update_time = now()`,
      roleId,
      old.home || 'home',
      JSON.stringify(old.menuIds || []),
      JSON.stringify(payload.buttonCodes || [])
    );
    return this.getRoleMenuAuth(roleId);
  }

  async getAllButtons() {
    const { records } = await this.listSystemMenus();
    const codes: Array<{ code: string; desc: string }> = [];
    for (const menu of records) {
      for (const btn of menu.buttons || []) {
        if (!codes.find(item => item.code === btn.code)) {
          codes.push({ code: btn.code, desc: btn.desc || btn.code });
        }
      }
    }
    return codes;
  }
}
