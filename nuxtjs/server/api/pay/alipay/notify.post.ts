import { createVerify } from "node:crypto";
import { getPgPool } from "../../../utils/db";
import { assignKeyForPaidOrder } from "../../../utils/orders";

export default defineEventHandler(async (event) => {
  const body = await readBody<any>(event);
  const {
    out_trade_no: outTradeNo,
    trade_no: tradeNo,
    trade_status: tradeStatus,
    sign,
    sign_type: signType
  } = body || {};
  if (!outTradeNo || !tradeNo || !tradeStatus || !sign) {
    throw createError({ statusCode: 400, statusMessage: "回调参数不完整" });
  }

  const { alipayPublicKey } = useRuntimeConfig();
  if (!alipayPublicKey) {
    throw createError({ statusCode: 500, statusMessage: "ALIPAY_PUBLIC_KEY 未配置" });
  }

  const signSource = JSON.stringify({
    out_trade_no: outTradeNo,
    trade_no: tradeNo,
    trade_status: tradeStatus
  });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(signSource, "utf8");
  const ok = verifier.verify(alipayPublicKey, sign, "base64");
  if (!ok || String(signType || "").toUpperCase() !== "RSA2") {
    throw createError({ statusCode: 401, statusMessage: "支付宝回调验签失败" });
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const orderRes = await client.query(
      "SELECT id, payment_status FROM orders WHERE order_no = $1 FOR UPDATE",
      [outTradeNo]
    );
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
        [tradeStatus === "TRADE_SUCCESS" ? "paid" : "failed", tradeNo, order.id]
      );
    }
    let keyCode: string | null = null;
    if (tradeStatus === "TRADE_SUCCESS") {
      keyCode = await assignKeyForPaidOrder(client, Number(order.id));
    }
    await client.query("COMMIT");
    return { ok: true, keyCode };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
