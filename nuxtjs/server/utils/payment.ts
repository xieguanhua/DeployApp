import { createHash, createSign, timingSafeEqual } from "node:crypto";

export type PaymentChannel = "alipay" | "wechat";
export type PaymentStatus = "pending" | "paid" | "failed" | "closed";

export function genOrderNo(prefix = "ORD") {
  const now = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${now}-${rand}`;
}

export function buildAlipayPayload(orderNo: string, amountCents: number, subject: string) {
  const amount = (amountCents / 100).toFixed(2);
  return {
    outTradeNo: orderNo,
    totalAmount: amount,
    subject,
    productCode: "FAST_INSTANT_TRADE_PAY"
  };
}

export function signAlipayBizContent(content: string) {
  const { alipayPrivateKey } = useRuntimeConfig();
  if (!alipayPrivateKey) {
    throw createError({ statusCode: 500, statusMessage: "ALIPAY_PRIVATE_KEY 未配置" });
  }
  const signer = createSign("RSA-SHA256");
  signer.update(content, "utf8");
  return signer.sign(alipayPrivateKey, "base64");
}

export function verifyWechatNotifySignature(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string
) {
  const { wechatApiV3Key } = useRuntimeConfig();
  if (!wechatApiV3Key) return false;
  const data = `${timestamp}\n${nonce}\n${body}\n`;
  const digest = createHash("sha256").update(data + wechatApiV3Key).digest();
  const expected = createHash("sha256").update(signature).digest();
  return digest.length === expected.length && timingSafeEqual(digest, expected);
}
