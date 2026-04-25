import { z } from "zod";
import { createUser } from "../../utils/auth";
import { signAuthJwt } from "../../utils/security";

const registerSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(8).max(128)
});

export default defineEventHandler(async (event) => {
  const body = registerSchema.parse(await readBody(event));
  const user = await createUser(body.username, body.password, "user");
  const token = await signAuthJwt(String(user.id), "user");
  return {
    ok: true,
    token,
    user: {
      id: Number(user.id),
      username: String(user.username),
      role: "user"
    }
  };
});
