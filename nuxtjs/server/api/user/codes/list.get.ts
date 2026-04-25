import { requireRole } from "../../../utils/auth";
import { getPgPool } from "../../../utils/db";

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, "user");
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT k.key_code, k.product_code, k.client_type, k.status, k.assigned_device_id, k.activated_at, k.created_at,
            o.order_no, o.payment_status,
            COALESCE(array_agg(DISTINCT a.device_id) FILTER (WHERE a.device_id IS NOT NULL), '{}') AS device_ids
       FROM activation_keys k
       LEFT JOIN orders o ON o.id = k.allocated_order_id
       LEFT JOIN activations a ON a.key_code = k.key_code
      WHERE k.allocated_user_id = $1
      GROUP BY k.key_code, k.product_code, k.client_type, k.status, k.assigned_device_id, k.activated_at, k.created_at, o.order_no, o.payment_status
      ORDER BY k.created_at DESC`,
    [auth.id]
  );
  return { ok: true, items: result.rows };
});
