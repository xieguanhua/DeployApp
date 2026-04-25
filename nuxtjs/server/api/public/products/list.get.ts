import { getPgPool } from "../../../utils/db";

export default defineEventHandler(async () => {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT product_code, product_name, client_type, price_cents, is_active, created_at
       FROM activation_products
      ORDER BY created_at DESC`
  );
  return { ok: true, items: result.rows };
});
