import { z } from "zod";
import { signAuthJwt } from "../../utils/security";
import { validateAdminCredentials } from "../../utils/auth";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8)
});

export default defineEventHandler(async (event) => {
  const body = loginSchema.parse(await readBody(event));
  const valid = await validateAdminCredentials(body.username, body.password);
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: "账号或密码错误" });
  }

  const token = await signAuthJwt(body.username, "admin");
  return { ok: true, token };
});
