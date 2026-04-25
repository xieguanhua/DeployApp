import { z } from "zod";
import { requireRole } from "../../../utils/auth";
import { buildAlipayPayload, signAlipayBizContent } from "../../../utils/payment";
import { createOrder } from "../../../utils/orders";

const bodySchema = z.object({
  productCode: z.string().min(2).max(64),
  paymentChannel: z.enum(["alipay", "wechat"])
});

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, "user");
  const body = bodySchema.parse(await readBody(event));

  const { order, product } = await createOrder({
    userId: auth.id,
    productCode: body.productCode,
    paymentChannel: body.paymentChannel
  });

  if (body.paymentChannel === "alipay") {
    const payload = buildAlipayPayload(order.order_no, Number(order.amount_cents), `${product.product_name} 渠道码`);
    const bizContent = JSON.stringify(payload);
    const signature = signAlipayBizContent(bizContent);
    return {
      ok: true,
      order,
      payInfo: {
        channel: "alipay",
        bizContent,
        signature
      }
    };
  }

  return {
    ok: true,
    order,
    payInfo: {
      channel: "wechat",
      message: "请将订单号用于微信支付下单，支付后由回调更新状态"
    }
  };
});
