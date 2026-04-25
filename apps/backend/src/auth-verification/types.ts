export type VerificationChannel = 'sms' | 'email';

export type VerificationBizType = 'login' | 'register' | 'reset_password';

export type SendVerificationCodeInput = {
  channel: VerificationChannel;
  bizType: VerificationBizType;
  target: string;
  ip?: string;
  deviceId?: string;
  lang?: string;
};

export type VerifyCodeInput = {
  channel: VerificationChannel;
  bizType: VerificationBizType;
  target: string;
  code: string;
  lang?: string;
};
