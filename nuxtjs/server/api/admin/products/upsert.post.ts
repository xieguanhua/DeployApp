import { z } from "zod";
import { requireAdmin } from "../../../utils/auth";
import { getPgPool } from "../../../utils/db";

const productSchema = z.object({
  productCode: z.string().min(2).max(64),
  productName: z.string().min(1).max(128),
  clientType: z.enum(["frontend", "backend", "fullstack"]),
  priceCents: z.number().int().min(0),
  isActive: z.boolean().optional().default(true)
});

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const body = productSchema.parse(await readBody(event));
  const pool = getPgPool();

  const result = await pool.query(
    `INSERT INTO activation_products (product_code, product_name, client_type, price_cents, is_active)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (product_code)
     DO UPDATE SET
       product_name = EXCLUDED.product_name,
       client_type = EXCLUDED.client_type,
       price_cents = EXCLUDED.price_cents,
       is_active = EXCLUDED.is_active
     RETURNING product_code, product_name, client_type, price_cents, is_active`,
    [body.productCode, body.productName, body.clientType, body.priceCents, body.isActive]
  );

  return {
    ok: true,
    product: result.rows[0]
  };
});
