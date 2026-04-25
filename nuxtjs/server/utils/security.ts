import { createHmac, randomBytes } from "node:crypto";
import { SignJWT, importPKCS8, importSPKI, jwtVerify } from "jose";

type LicensePayload = {
  keyCode: string;
  productCode: string;
  clientType: string;
  priceCents: number;
  deviceId: string;
  requestId: string;
  nonce: string;
};

export type AuthRole = "admin" | "user";

export type AuthClaims = {
  role: AuthRole;
};

export function assertFreshTimestamp(timestampMs: number, skewSec: number) {
  const now = Date.now();
  const delta = Math.abs(now - timestampMs);
  if (delta > skewSec * 1000) {
    throw createError({ statusCode: 400, statusMessage: "请求时间戳过期" });
  }
}

export function generateActivationKey(prefix = "TA") {
  const raw = randomBytes(12).toString("hex").toUpperCase();
  return `${prefix}-${raw.slice(0, 6)}-${raw.slice(6, 12)}-${raw.slice(12, 18)}`;
}

export async function signLicense(payload: LicensePayload, expiresInSec: number) {
  const { licensePrivateKeyPem } = useRuntimeConfig();
  if (!licensePrivateKeyPem) {
    throw createError({ statusCode: 500, statusMessage: "LICENSE_PRIVATE_KEY_PEM 未配置" });
  }

  const key = await importPKCS8(licensePrivateKeyPem, "RS256");
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${expiresInSec}s`)
    .sign(key);
}

export async function verifyAuthJwt(token: string) {
  const { authJwtSecret, adminJwtSecret } = useRuntimeConfig();
  const secretValue = authJwtSecret || adminJwtSecret;
  if (!secretValue) {
    throw createError({ statusCode: 500, statusMessage: "AUTH_JWT_SECRET 未配置" });
  }
  const secret = new TextEncoder().encode(secretValue);
  return jwtVerify(token, secret);
}

export async function signAuthJwt(subject: string, role: AuthRole) {
  const { authJwtSecret, adminJwtSecret } = useRuntimeConfig();
  const secretValue = authJwtSecret || adminJwtSecret;
  if (!secretValue) {
    throw createError({ statusCode: 500, statusMessage: "AUTH_JWT_SECRET 未配置" });
  }
  const secret = new TextEncoder().encode(secretValue);
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
}

export function verifyAiHmac(rawBody: string, timestamp: string, nonce: string, signature: string) {
  const { aiApiHmacSecret } = useRuntimeConfig();
  if (!aiApiHmacSecret) {
    throw createError({ statusCode: 500, statusMessage: "AI_API_HMAC_SECRET 未配置" });
  }
  const data = `${timestamp}.${nonce}.${rawBody}`;
  const expected = createHmac("sha256", aiApiHmacSecret).update(data).digest("hex");
  return expected === signature;
}

export async function verifyLicenseSignature(token: string) {
  const { licensePublicKeyPem } = useRuntimeConfig();
  if (!licensePublicKeyPem) {
    throw createError({ statusCode: 500, statusMessage: "LICENSE_PUBLIC_KEY_PEM 未配置" });
  }
  const key = await importSPKI(licensePublicKeyPem, "RS256");
  return jwtVerify(token, key);
}
