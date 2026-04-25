import { requireRole } from "../../../utils/auth";
import { getPgPool } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, "user");
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT id, order_no, product_code, amount_cents, payment_channel, payment_status,
            assigned_key_code, provider_trade_no, paid_at, created_at, updated_at
       FROM orders
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [auth.id]
  );
  return { ok: true, items: result.rows };
});
