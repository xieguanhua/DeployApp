import { Injectable } from '@nestjs/common';
import { AliyunSmsProvider } from './providers/aliyun-sms.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import type { VerificationChannel } from './types';

@Injectable()
export class VerificationProviderFactory {
  constructor(
    private readonly smsProvider: AliyunSmsProvider,
    private readonly emailProvider: SmtpEmailProvider
  ) {}

  isEnabled(channel: VerificationChannel) {
    if (channel === 'sms') {
      return String(process.env.AUTH_SMS_ENABLED || 'Y') !== 'N';
    }
    return String(process.env.AUTH_EMAIL_ENABLED || 'Y') !== 'N';
  }

  isConfigured(channel: VerificationChannel) {
    if (channel === 'sms') {
      return Boolean(
        process.env.ALIYUN_ACCESS_KEY_ID &&
          process.env.ALIYUN_ACCESS_KEY_SECRET &&
          process.env.ALIYUN_SMS_SIGN_NAME &&
          process.env.ALIYUN_SMS_TEMPLATE_CODE
      );
    }

    return Boolean(
      process.env.SMTP_HOST &&
        process.env.SMTP_PORT &&
        process.env.SMTP_FROM &&
        ((process.env.SMTP_USER && process.env.SMTP_PASS) || process.env.SMTP_AUTHLESS === 'Y')
    );
  }

  getProvider(channel: VerificationChannel) {
    if (channel === 'sms') {
      return this.smsProvider;
    }
    return this.emailProvider;
  }
}
