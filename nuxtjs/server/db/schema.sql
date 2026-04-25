CREATE TABLE IF NOT EXISTS activation_products (
  id BIGSERIAL PRIMARY KEY,
  product_code VARCHAR(64) UNIQUE NOT NULL,
  product_name VARCHAR(128) NOT NULL,
  client_type VARCHAR(32) NOT NULL CHECK (client_type IN ('frontend', 'backend', 'fullstack')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activation_keys (
  id BIGSERIAL PRIMARY KEY,
  key_code VARCHAR(64) UNIQUE NOT NULL,
  product_code VARCHAR(64) NOT NULL REFERENCES activation_products(product_code),
  client_type VARCHAR(32) NOT NULL CHECK (client_type IN ('frontend', 'backend', 'fullstack')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  status VARCHAR(16) NOT NULL DEFAULT 'unused',
  allocated_user_id BIGINT REFERENCES users(id),
  allocated_order_id BIGINT,
  allocated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  assigned_device_id VARCHAR(256),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
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
);

CREATE TABLE IF NOT EXISTS activations (
  id BIGSERIAL PRIMARY KEY,
  key_code VARCHAR(64) NOT NULL REFERENCES activation_keys(key_code),
  device_id VARCHAR(256) NOT NULL,
  request_id VARCHAR(128) UNIQUE NOT NULL,
  nonce VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS used_nonces (
  nonce VARCHAR(128) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE activation_keys ADD COLUMN IF NOT EXISTS product_code VARCHAR(64);
ALTER TABLE activation_keys ADD COLUMN IF NOT EXISTS client_type VARCHAR(32);
ALTER TABLE activation_keys ADD COLUMN IF NOT EXISTS price_cents INTEGER;
ALTER TABLE activation_keys ADD COLUMN IF NOT EXISTS allocated_user_id BIGINT REFERENCES users(id);
ALTER TABLE activation_keys ADD COLUMN IF NOT EXISTS allocated_order_id BIGINT;
ALTER TABLE activation_keys ADD COLUMN IF NOT EXISTS allocated_at TIMESTAMPTZ;
ALTER TABLE activation_keys ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_key_code VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_trade_no VARCHAR(128);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE activation_keys SET status = 'unused' WHERE status = 'new';
UPDATE activation_keys SET status = 'used' WHERE assigned_device_id IS NOT NULL AND status <> 'revoked';

CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_product_created ON orders(product_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activation_keys_product_status ON activation_keys(product_code, status);
CREATE INDEX IF NOT EXISTS idx_activations_key_device ON activations(key_code, device_id);

INSERT INTO activation_products (product_code, product_name, client_type, price_cents)
VALUES ('TRADING_AGENTS', 'TradingAgents', 'frontend', 0)
ON CONFLICT (product_code) DO NOTHING;
