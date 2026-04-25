declare const process: any;

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@soybeanjs/ui/nuxt'],
  runtimeConfig: {
    pgConnectionString: process.env.PG_CONNECTION_STRING || "",
    licensePrivateKeyPem: process.env.LICENSE_PRIVATE_KEY_PEM || "",
    licensePublicKeyPem: process.env.LICENSE_PUBLIC_KEY_PEM || "",
    adminUsername: process.env.ADMIN_USERNAME || "admin",
    adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || "",
    authJwtSecret: process.env.AUTH_JWT_SECRET || process.env.ADMIN_JWT_SECRET || "",
    adminJwtSecret: process.env.ADMIN_JWT_SECRET || "",
    aiApiKey: process.env.AI_API_KEY || "",
    aiApiHmacSecret: process.env.AI_API_HMAC_SECRET || "",
    alipayAppId: process.env.ALIPAY_APP_ID || "",
    alipayGateway: process.env.ALIPAY_GATEWAY || "https://openapi.alipay.com/gateway.do",
    alipayPrivateKey: process.env.ALIPAY_PRIVATE_KEY || "",
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || "",
    alipayNotifyUrl: process.env.ALIPAY_NOTIFY_URL || "",
    wechatMchId: process.env.WECHAT_MCH_ID || "",
    wechatAppId: process.env.WECHAT_APP_ID || "",
    wechatApiV3Key: process.env.WECHAT_API_V3_KEY || "",
    wechatSerialNo: process.env.WECHAT_SERIAL_NO || "",
    wechatPrivateKey: process.env.WECHAT_PRIVATE_KEY || "",
    wechatNotifyUrl: process.env.WECHAT_NOTIFY_URL || "",
    activateClockSkewSeconds: Number(process.env.ACTIVATE_CLOCK_SKEW_SECONDS || "300"),
    activateTokenExpiresSeconds: Number(process.env.ACTIVATE_TOKEN_EXPIRES_SECONDS || "31536000")
  }
})
