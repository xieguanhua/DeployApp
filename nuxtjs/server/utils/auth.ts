import bcrypt from "bcryptjs";
import { getPgPool } from "./db";
import { type AuthRole, verifyAuthJwt } from "./security";

export async function requireAdmin(event: any) {
  return requireRole(event, "admin");
}

export async function requireUser(event: any) {
  return requireRole(event, "user");
}

export async function requireRole(event: any, role: AuthRole) {
  const auth = getHeader(event, "authorization");
  if (!auth?.startsWith("Bearer ")) {
    throw createError({ statusCode: 401, statusMessage: "缺少认证令牌" });
  }
  const token = auth.slice("Bearer ".length);
  const verified = await verifyAuthJwt(token);
  const tokenRole = (verified.payload.role || "") as AuthRole;
  if (tokenRole !== role) {
    throw createError({ statusCode: 403, statusMessage: "权限不足" });
  }
  return {
    id: Number(verified.payload.sub || 0),
    username: String(verified.payload.username || ""),
    role: tokenRole
  };
}

export async function validateAdminCredentials(username: string, password: string) {
  const pool = getPgPool();
  const userResult = await pool.query(
    "SELECT id, username, password_hash, role, is_active FROM users WHERE username = $1 LIMIT 1",
    [username]
  );
  if (userResult.rowCount) {
    const user = userResult.rows[0];
    if (!user.is_active || user.role !== "admin") return false;
    return bcrypt.compare(password, user.password_hash);
  }

  const { adminUsername, adminPasswordHash } = useRuntimeConfig();
  if (!adminPasswordHash) {
    throw createError({ statusCode: 500, statusMessage: "ADMIN_PASSWORD_HASH 未配置" });
  }
  if (username !== adminUsername) return false;
  return bcrypt.compare(password, adminPasswordHash);
}

export async function createUser(username: string, password: string, role: AuthRole = "user") {
  const pool = getPgPool();
  const hashed = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO users (username, password_hash, role, is_active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (username) DO NOTHING
     RETURNING id, username, role`,
    [username, hashed, role]
  );
  if (!result.rowCount) {
    throw createError({ statusCode: 409, statusMessage: "用户名已存在" });
  }
  return result.rows[0];
}

export async function validateUserCredentials(username: string, password: string) {
  const pool = getPgPool();
  const result = await pool.query(
    "SELECT id, username, password_hash, role, is_active FROM users WHERE username = $1 LIMIT 1",
    [username]
  );
  if (!result.rowCount) return null;
  const user = result.rows[0];
  if (!user.is_active) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return {
    id: Number(user.id),
    username: String(user.username),
    role: user.role as AuthRole
  };
}
