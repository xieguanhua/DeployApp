import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { MallController } from './mall.controller';
import { MallService } from './mall.service';
import { VerificationService } from '../auth-verification/verification.service';
import { VerificationProviderFactory } from '../auth-verification/provider.factory';
import { AliyunSmsProvider } from '../auth-verification/providers/aliyun-sms.provider';
import { SmtpEmailProvider } from '../auth-verification/providers/smtp-email.provider';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({
      secret:
        process.env.AUTH_JWT_SECRET ||
        process.env.JWT_ACCESS_SECRET ||
        'dev-secret',
      signOptions: { expiresIn: '12h' }
    })
  ],
  controllers: [MallController],
  providers: [MallService, VerificationService, VerificationProviderFactory, AliyunSmsProvider, SmtpEmailProvider],
  exports: [MallService]
})
export class MallModule {}
