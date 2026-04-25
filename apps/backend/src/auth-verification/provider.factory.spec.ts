import { VerificationProviderFactory } from './provider.factory';
import { AliyunSmsProvider } from './providers/aliyun-sms.provider';
import { SmtpEmailProvider } from './providers/smtp-email.provider';

describe('VerificationProviderFactory', () => {
  const smsProvider = { channel: 'sms', send: jest.fn() } as unknown as AliyunSmsProvider;
  const emailProvider = { channel: 'email', send: jest.fn() } as unknown as SmtpEmailProvider;
  const factory = new VerificationProviderFactory(smsProvider, emailProvider);

  afterEach(() => {
    delete process.env.AUTH_SMS_ENABLED;
    delete process.env.AUTH_EMAIL_ENABLED;
  });

  it('returns provider by channel', () => {
    expect(factory.getProvider('sms')).toBe(smsProvider);
    expect(factory.getProvider('email')).toBe(emailProvider);
  });

  it('honors channel enabled switch', () => {
    process.env.AUTH_SMS_ENABLED = 'N';
    process.env.AUTH_EMAIL_ENABLED = 'Y';
    expect(factory.isEnabled('sms')).toBe(false);
    expect(factory.isEnabled('email')).toBe(true);
  });
});
