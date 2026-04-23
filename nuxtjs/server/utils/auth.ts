import bcrypt from "bcryptjs";
import { verifyAdminJwt } from "./security";

export async function requireAdmin(event: any) {
  const auth = getHeader(event, "authorization");
  if (!auth?.startsWith("Bearer ")) {
    throw createError({ statusCode: 401, statusMessage: "缺少管理员令牌" });
  }
  const token = auth.slice("Bearer ".length);
  await verifyAdminJwt(token);
}

export async function validateAdminCredentials(username: string, password: string) {
  const { adminUsername, adminPasswordHash } = useRuntimeConfig();
  if (!adminPasswordHash) {
    throw createError({ statusCode: 500, statusMessage: "ADMIN_PASSWORD_HASH 未配置" });
  }
  if (username !== adminUsername) return false;
  return bcrypt.compare(password, adminPasswordHash);
}
