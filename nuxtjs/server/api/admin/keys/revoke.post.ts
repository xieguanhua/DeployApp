import { z } from "zod";
import { requireAdmin } from "../../../utils/auth";
import { getPgPool } from "../../../utils/db";

const bodySchema = z.object({
  keyCode: z.string().min(8).max(64)
});

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const body = bodySchema.parse(await readBody(event));
  const pool = getPgPool();
  const result = await pool.query(
    `UPDATE activation_keys
        SET status = 'revoked',
            revoked_at = now()
      WHERE key_code = $1
        AND assigned_device_id IS NULL
      RETURNING key_code, status, revoked_at`,
    [body.keyCode]
  );
  if (!result.rowCount) {
    throw createError({ statusCode: 404, statusMessage: "渠道码不存在、已使用或不可作废" });
  }
  return { ok: true, item: result.rows[0] };
});
