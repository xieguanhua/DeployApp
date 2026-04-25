import { z } from "zod";
import { signAuthJwt } from "../../utils/security";
import { validateUserCredentials } from "../../utils/auth";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8)
});

export default defineEventHandler(async (event) => {
  const body = loginSchema.parse(await readBody(event));
  const user = await validateUserCredentials(body.username, body.password);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "账号或密码错误" });
  }
  const token = await signAuthJwt(String(user.id), user.role);
  return {
    ok: true,
    token,
    user
  };
});
