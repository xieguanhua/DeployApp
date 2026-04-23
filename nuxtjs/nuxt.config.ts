// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    pgConnectionString: process.env.PG_CONNECTION_STRING || "",
    licensePrivateKeyPem: process.env.LICENSE_PRIVATE_KEY_PEM || "",
    licensePublicKeyPem: process.env.LICENSE_PUBLIC_KEY_PEM || "",
    adminUsername: process.env.ADMIN_USERNAME || "admin",
    adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || "",
    adminJwtSecret: process.env.ADMIN_JWT_SECRET || "",
    aiApiKey: process.env.AI_API_KEY || "",
    aiApiHmacSecret: process.env.AI_API_HMAC_SECRET || "",
    activateClockSkewSeconds: Number(process.env.ACTIVATE_CLOCK_SKEW_SECONDS || "300"),
    activateTokenExpiresSeconds: Number(process.env.ACTIVATE_TOKEN_EXPIRES_SECONDS || "31536000")
  }
})
