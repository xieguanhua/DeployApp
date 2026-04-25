import { createHash, randomInt } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { VerificationProviderFactory } from './provider.factory';
import type { SendVerificationCodeInput, VerifyCodeInput } from './types';

@Injectable()
export class VerificationService implements OnModuleInit {
  private readonly codeExpireSeconds = Number(process.env.AUTH_CODE_EXPIRE_SECONDS || 300);
  private readonly sendIntervalSeconds = Number(process.env.AUTH_CODE_SEND_INTERVAL_SECONDS || 60);
  private readonly maxFailCount = Number(process.env.AUTH_CODE_MAX_FAIL_COUNT || 5);
  private readonly hashSalt = process.env.AUTH_VERIFICATION_SALT || 'verification-salt';

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: VerificationProviderFactory
  ) {}

  async onModuleInit() {
    await this.bootstrapSchema();
  }

  private async bootstrapSchema() {
    const statements = [
      `CREATE TABLE IF NOT EXISTS auth_verification_codes (
        id BIGSERIAL PRIMARY KEY,
        target VARCHAR(256) NOT NULL,
        channel VARCHAR(16) NOT NULL CHECK (channel IN ('sms', 'email')),
        biz_type VARCHAR(32) NOT NULL CHECK (biz_type IN ('login', 'register', 'reset_password')),
        code_hash VARCHAR(255) NOT NULL,
        expire_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        fail_count INTEGER NOT NULL DEFAULT 0,
        request_ip VARCHAR(128),
        device_id VARCHAR(128),
        lang VARCHAR(32),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_auth_verification_target_biz_created
       ON auth_verification_codes(target, biz_type, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_auth_verification_ip_created
       ON auth_verification_codes(request_ip, created_at DESC)`
    ];

    for (const sql of statements) {
      await this.prisma.$executeRawUnsafe(sql);
    }
  }

  private hashCode(target: string, code: string) {
    return createHash('sha256')
      .update(`${target}:${code}:${this.hashSalt}`)
      .digest('hex');
  }

  private generateCode() {
    return String(randomInt(100000, 999999));
  }

  async sendCode(input: SendVerificationCodeInput) {
    if (!this.providerFactory.isEnabled(input.channel)) {
      return { ok: false as const, reason: 'channel_disabled' as const };
    }
    if (!this.providerFactory.isConfigured(input.channel)) {
      return { ok: false as const, reason: 'channel_not_configured' as const };
    }

    const latestRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT created_at
       FROM auth_verification_codes
       WHERE target = $1 AND channel = $2 AND biz_type = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      input.target,
      input.channel,
      input.bizType
    );
    const latest = latestRows[0];
    if (latest) {
      const seconds = (Date.now() - new Date(latest.created_at).getTime()) / 1000;
      if (seconds < this.sendIntervalSeconds) {
        return { ok: false as const, reason: 'send_too_frequent' as const };
      }
    }

    if (input.ip) {
      const ipRows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(1)::int AS count
         FROM auth_verification_codes
         WHERE request_ip = $1 AND created_at > now() - interval '1 minute'`,
        input.ip
      );
      if (Number(ipRows[0]?.count || 0) >= 20) {
        return { ok: false as const, reason: 'ip_rate_limited' as const };
      }
    }

    const code = this.generateCode();
    const codeHash = this.hashCode(input.target, code);
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO auth_verification_codes
       (target, channel, biz_type, code_hash, expire_at, request_ip, device_id, lang)
       VALUES ($1, $2, $3, $4, now() + ($5 || ' seconds')::interval, $6, $7, $8)`,
      input.target,
      input.channel,
      input.bizType,
      codeHash,
      String(this.codeExpireSeconds),
      input.ip || null,
      input.deviceId || null,
      input.lang || null
    );

    const provider = this.providerFactory.getProvider(input.channel);
    await provider.send({
      target: input.target,
      code,
      lang: input.lang
    });

    return { ok: true as const };
  }

  async verifyCode(input: VerifyCodeInput) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, code_hash, expire_at, used_at, fail_count
       FROM auth_verification_codes
       WHERE target = $1 AND channel = $2 AND biz_type = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      input.target,
      input.channel,
      input.bizType
    );
    const row = rows[0];
    if (!row) return { ok: false as const, reason: 'code_not_found' as const };
    if (row.used_at) return { ok: false as const, reason: 'code_used' as const };
    if (new Date(row.expire_at).getTime() < Date.now()) {
      return { ok: false as const, reason: 'code_expired' as const };
    }
    if (Number(row.fail_count || 0) >= this.maxFailCount) {
      return { ok: false as const, reason: 'code_locked' as const };
    }

    const expectedHash = this.hashCode(input.target, input.code);
    if (expectedHash !== row.code_hash) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE auth_verification_codes
         SET fail_count = fail_count + 1
         WHERE id = $1`,
        row.id
      );
      return { ok: false as const, reason: 'code_invalid' as const };
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE auth_verification_codes
       SET used_at = now()
       WHERE id = $1`,
      row.id
    );
    return { ok: true as const };
  }
}
