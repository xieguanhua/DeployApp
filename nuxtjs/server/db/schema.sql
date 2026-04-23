CREATE TABLE IF NOT EXISTS activation_products (
  id BIGSERIAL PRIMARY KEY,
  product_code VARCHAR(64) UNIQUE NOT NULL,
  product_name VARCHAR(128) NOT NULL,
  client_type VARCHAR(32) NOT NULL CHECK (client_type IN ('frontend', 'backend', 'fullstack')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activation_keys (
  id BIGSERIAL PRIMARY KEY,
  key_code VARCHAR(64) UNIQUE NOT NULL,
  product_code VARCHAR(64) NOT NULL REFERENCES activation_products(product_code),
  client_type VARCHAR(32) NOT NULL CHECK (client_type IN ('frontend', 'backend', 'fullstack')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  status VARCHAR(16) NOT NULL DEFAULT 'new',
  assigned_device_id VARCHAR(256),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

INSERT INTO activation_products (product_code, product_name, client_type, price_cents)
VALUES ('TRADING_AGENTS', 'TradingAgents', 'frontend', 0)
ON CONFLICT (product_code) DO NOTHING;
