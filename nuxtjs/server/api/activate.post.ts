import { z } from "zod";
import { getPgPool } from "../utils/db";
import { assertFreshTimestamp, signLicense } from "../utils/security";

const activateBodySchema = z.object({
  activationKey: z.string().min(8).max(128),
  deviceId: z.string().min(8).max(256),
  nonce: z.string().min(8).max(128),
  requestId: z.string().min(8).max(128),
  timestamp: z.number().int(),
  productCode: z.string().min(2).max(64).optional(),
  clientType: z.enum(["frontend", "backend", "fullstack"]).optional()
});

export default defineEventHandler(async (event) => {
  const body = activateBodySchema.parse(await readBody(event));
  const config = useRuntimeConfig();
  assertFreshTimestamp(body.timestamp, config.activateClockSkewSeconds);

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const nonceExists = await client.query("SELECT 1 FROM used_nonces WHERE nonce = $1 LIMIT 1", [body.nonce]);
    if (nonceExists.rowCount) {
      throw createError({ statusCode: 409, statusMessage: "nonce 已使用，疑似重放请求" });
    }
    await client.query("INSERT INTO used_nonces (nonce) VALUES ($1)", [body.nonce]);

    const keyRow = await client.query(
      "SELECT key_code, status, assigned_device_id, product_code, client_type, price_cents FROM activation_keys WHERE key_code = $1 FOR UPDATE",
      [body.activationKey]
    );
    if (!keyRow.rowCount) {
      throw createError({ statusCode: 404, statusMessage: "激活码不存在" });
    }
    const key = keyRow.rows[0];
    if (key.status === "revoked") {
      throw createError({ statusCode: 403, statusMessage: "激活码已禁用" });
    }
    if (body.productCode && body.productCode !== key.product_code) {
      throw createError({ statusCode: 403, statusMessage: "激活码产品类型不匹配" });
    }
    if (body.clientType && body.clientType !== key.client_type) {
      throw createError({ statusCode: 403, statusMessage: "激活码端类型不匹配" });
    }

    if (!key.assigned_device_id) {
      await client.query(
        "UPDATE activation_keys SET assigned_device_id = $1, status = 'activated', activated_at = now() WHERE key_code = $2",
        [body.deviceId, body.activationKey]
      );
    } else if (key.assigned_device_id !== body.deviceId) {
      throw createError({ statusCode: 403, statusMessage: "激活码已绑定其他设备" });
    }

    await client.query(
      "INSERT INTO activations (key_code, device_id, request_id, nonce) VALUES ($1, $2, $3, $4) ON CONFLICT (request_id) DO NOTHING",
      [body.activationKey, body.deviceId, body.requestId, body.nonce]
    );

    const licenseToken = await signLicense(
      {
        keyCode: body.activationKey,
        productCode: key.product_code,
        clientType: key.client_type,
        priceCents: Number(key.price_cents),
        deviceId: body.deviceId,
        requestId: body.requestId,
        nonce: body.nonce
      },
      config.activateTokenExpiresSeconds
    );

    await client.query("COMMIT");
    return {
      ok: true,
      licenseToken,
      algorithm: "RS256",
      productCode: key.product_code,
      clientType: key.client_type,
      priceCents: Number(key.price_cents)
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
