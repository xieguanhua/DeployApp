import { z } from "zod";
import { requireAdmin } from "../../../utils/auth";
import { getPgPool } from "../../../utils/db";

const bodySchema = z.object({
  productCode: z.string().min(2).max(64)
});

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const body = bodySchema.parse(await readBody(event));
  const pool = getPgPool();
  const refCount = await pool.query("SELECT COUNT(1)::int AS count FROM activation_keys WHERE product_code = $1", [body.productCode]);
  if (Number(refCount.rows[0]?.count || 0) > 0) {
    throw createError({ statusCode: 409, statusMessage: "该产品下存在渠道码，不能删除" });
  }
  const result = await pool.query(
    "DELETE FROM activation_products WHERE product_code = $1 RETURNING product_code",
    [body.productCode]
  );
  if (!result.rowCount) {
    throw createError({ statusCode: 404, statusMessage: "产品不存在" });
  }
  return { ok: true };
});
