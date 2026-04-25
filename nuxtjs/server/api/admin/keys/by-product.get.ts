import { getQuery } from "h3";
import { requireAdmin } from "../../../utils/auth";
import { getPgPool } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const query = getQuery(event);
  const productCode = String(query.productCode || "").trim();
  if (!productCode) {
    throw createError({ statusCode: 400, statusMessage: "缺少 productCode" });
  }
  const pool = getPgPool();
  const result = await pool.query(
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
    [productCode]
  );
  return { ok: true, items: result.rows };
});
