import { z } from "zod";
import { requireAdmin } from "../../../utils/auth";
import { getPgPool } from "../../../utils/db";
import { generateActivationKey } from "../../../utils/security";

const keyCreateSchema = z.object({
  count: z.number().int().min(1).max(200).default(1),
  prefix: z.string().min(2).max(12).optional(),
  productCode: z.string().min(2).max(64)
});

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const body = keyCreateSchema.parse(await readBody(event));
  const pool = getPgPool();

  const keys: string[] = [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
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
