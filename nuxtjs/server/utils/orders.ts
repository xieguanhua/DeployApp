import { type PoolClient } from "pg";
import { genOrderNo, type PaymentChannel } from "./payment";
import { getPgPool } from "./db";

export async function createOrder(params: {
  userId: number;
  productCode: string;
  paymentChannel: PaymentChannel;
}) {
  const pool = getPgPool();
  const productRes = await pool.query(
    "SELECT product_code, product_name, client_type, price_cents, is_active FROM activation_products WHERE product_code = $1 LIMIT 1",
    [params.productCode]
  );
  if (!productRes.rowCount) {
    throw createError({ statusCode: 404, statusMessage: "产品不存在" });
  }
  const product = productRes.rows[0];
  if (!product.is_active) {
    throw createError({ statusCode: 403, statusMessage: "产品已下架" });
  }

  const orderNo = genOrderNo();
  const result = await pool.query(
    `INSERT INTO orders (order_no, user_id, product_code, amount_cents, payment_channel, payment_status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING id, order_no, product_code, amount_cents, payment_channel, payment_status, created_at`,
    [orderNo, params.userId, params.productCode, product.price_cents, params.paymentChannel]
  );

  return {
    order: result.rows[0],
    product
  };
}

export async function assignKeyForPaidOrder(client: PoolClient, orderId: number) {
  const orderRes = await client.query(
    "SELECT id, user_id, product_code, payment_status, assigned_key_code FROM orders WHERE id = $1 FOR UPDATE",
    [orderId]
  );
  if (!orderRes.rowCount) {
    throw createError({ statusCode: 404, statusMessage: "订单不存在" });
  }
  const order = orderRes.rows[0];
  if (order.assigned_key_code) {
    return order.assigned_key_code as string;
  }
  if (order.payment_status !== "paid") {
    throw createError({ statusCode: 400, statusMessage: "订单未支付，无法分配渠道码" });
  }

  const keyRes = await client.query(
    `SELECT key_code
       FROM activation_keys
      WHERE product_code = $1
        AND status = 'unused'
        AND allocated_order_id IS NULL
        AND revoked_at IS NULL
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED`,
    [order.product_code]
  );

  if (!keyRes.rowCount) {
    throw createError({ statusCode: 409, statusMessage: "当前产品暂无可分配渠道码" });
  }
  const keyCode = keyRes.rows[0].key_code as string;

  await client.query(
    `UPDATE activation_keys
        SET allocated_user_id = $1,
            allocated_order_id = $2,
            allocated_at = now()
      WHERE key_code = $3`,
    [order.user_id, order.id, keyCode]
  );
  await client.query("UPDATE orders SET assigned_key_code = $1, updated_at = now() WHERE id = $2", [keyCode, order.id]);

  return keyCode;
}
