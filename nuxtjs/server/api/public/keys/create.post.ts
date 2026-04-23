import { z } from "zod";
import { getPgPool } from "../../../utils/db";
import { assertFreshTimestamp, generateActivationKey, verifyAiHmac } from "../../../utils/security";

const publicCreateSchema = z.object({
  count: z.number().int().min(1).max(100).default(1),
  prefix: z.string().min(2).max(12).optional(),
  productCode: z.string().min(2).max(64)
});

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const apiKey = getHeader(event, "x-api-key");
  const signature = getHeader(event, "x-signature");
  const timestamp = getHeader(event, "x-timestamp");
  const nonce = getHeader(event, "x-nonce");

  if (!apiKey || !signature || !timestamp || !nonce) {
    throw createError({ statusCode: 401, statusMessage: "缺少 AI 接口鉴权头" });
  }
  if (apiKey !== config.aiApiKey) {
    throw createError({ statusCode: 401, statusMessage: "AI_API_KEY 无效" });
  }

  const ts = Number(timestamp);
  assertFreshTimestamp(ts, config.activateClockSkewSeconds);

  const rawBody = (await readRawBody(event)) || "";
  if (!verifyAiHmac(rawBody, timestamp, nonce, signature)) {
    throw createError({ statusCode: 401, statusMessage: "HMAC 签名验证失败" });
  }
  const body = publicCreateSchema.parse(rawBody ? JSON.parse(rawBody) : {});

  const pool = getPgPool();
  const client = await pool.connect();
  const keys: string[] = [];
  try {
    await client.query("BEGIN");
    const nonceExists = await client.query("SELECT 1 FROM used_nonces WHERE nonce = $1 LIMIT 1", [nonce]);
    if (nonceExists.rowCount) {
      throw createError({ statusCode: 409, statusMessage: "nonce 已使用" });
    }
    await client.query("INSERT INTO used_nonces (nonce) VALUES ($1)", [nonce]);

    const productResult = await client.query(
      "SELECT product_code, client_type, price_cents, is_active FROM activation_products WHERE product_code = $1 LIMIT 1",
      [body.productCode]
    );
    if (!productResult.rowCount) {
      throw createError({ statusCode: 404, statusMessage: "产品类型不存在" });
    }
    const product = productResult.rows[0];
    if (!product.is_active) {
      throw createError({ statusCode: 403, statusMessage: "产品类型已停用" });
    }

    for (let i = 0; i < body.count; i += 1) {
      const keyCode = generateActivationKey(body.prefix || "TA");
      await client.query(
        "INSERT INTO activation_keys (key_code, product_code, client_type, price_cents, status) VALUES ($1, $2, $3, $4, 'new')",
        [keyCode, product.product_code, product.client_type, product.price_cents]
      );
      keys.push(keyCode);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { ok: true, keys };
});
