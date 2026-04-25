import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { VerificationProvider, VerificationMessage } from './verification-provider.interface';
import { buildVerificationEmailHtml } from './templates/verification-email.template';

@Injectable()
export class SmtpEmailProvider implements VerificationProvider {
  readonly channel = 'email' as const;

  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    const host = process.env.SMTP_HOST || '';
    const port = Number(process.env.SMTP_PORT || 465);
    const secure = String(process.env.SMTP_SECURE || 'Y') !== 'N';
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    this.from = process.env.SMTP_FROM || user;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined
    });
  }

  async send(message: VerificationMessage): Promise<void> {
    const isEnglish = message.lang?.toLowerCase().startsWith('en') ?? false;
    const expireSeconds = Number(process.env.AUTH_CODE_EXPIRE_SECONDS || 300);
    const platformName = isEnglish
      ? process.env.APP_NAME_EN || 'StarSail'
      : process.env.APP_NAME_ZH || '星帆';

    const subject = isEnglish
      ? `${platformName} - Your verification code`
      : `${platformName} - 您的验证码`;
    const text = isEnglish
      ? `Your verification code is ${message.code}. It expires in ${Math.max(1, Math.ceil(expireSeconds / 60))} minute(s).`
      : `您的验证码是 ${message.code}，${Math.max(1, Math.ceil(expireSeconds / 60))} 分钟内有效。`;
    const html = buildVerificationEmailHtml({
      code: message.code,
      lang: message.lang,
      expireSeconds
    });

    await this.transporter.sendMail({
      from: this.from,
      to: message.target,
      subject,
      text,
      html
    });
  }
}
