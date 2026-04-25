import { getHeader } from "h3";
import { getPgPool } from "../../../utils/db";
import { assignKeyForPaidOrder } from "../../../utils/orders";
import { verifyWechatNotifySignature } from "../../../utils/payment";

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, "utf8");
  const body = rawBody ? JSON.parse(rawBody) : {};
  const timestamp = getHeader(event, "wechatpay-timestamp") || "";
  const nonce = getHeader(event, "wechatpay-nonce") || "";
  const signature = getHeader(event, "wechatpay-signature") || "";

  if (!verifyWechatNotifySignature(timestamp, nonce, rawBody || "", signature)) {
    throw createError({ statusCode: 401, statusMessage: "微信回调验签失败" });
  }

  const outTradeNo = body?.resource?.out_trade_no || body?.out_trade_no;
  const tradeNo = body?.resource?.transaction_id || body?.transaction_id;
  const state = body?.trade_state || "SUCCESS";
  if (!outTradeNo || !tradeNo) {
    throw createError({ statusCode: 400, statusMessage: "回调参数不完整" });
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const orderRes = await client.query("SELECT id, payment_status FROM orders WHERE order_no = $1 FOR UPDATE", [outTradeNo]);
    if (!orderRes.rowCount) {
      throw createError({ statusCode: 404, statusMessage: "订单不存在" });
    }
    const order = orderRes.rows[0];
    if (order.payment_status !== "paid") {
      await client.query(
        `UPDATE orders
            SET payment_status = $1,
                provider_trade_no = $2,
                paid_at = now(),
                updated_at = now()
          WHERE id = $3`,
        [state === "SUCCESS" ? "paid" : "failed", tradeNo, order.id]
      );
    }
    let keyCode: string | null = null;
    if (state === "SUCCESS") {
      keyCode = await assignKeyForPaidOrder(client, Number(order.id));
    }
    await client.query("COMMIT");
    return { code: "SUCCESS", message: "成功", keyCode };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
