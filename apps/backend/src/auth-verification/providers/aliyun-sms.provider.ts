import { Injectable } from '@nestjs/common';
import Dysmsapi, * as $Dysmsapi from '@alicloud/dysmsapi20170525';
import OpenApi, * as $OpenApi from '@alicloud/openapi-client';
import Util, * as $Util from '@alicloud/tea-util';
import type { VerificationProvider, VerificationMessage } from './verification-provider.interface';

@Injectable()
export class AliyunSmsProvider implements VerificationProvider {
  readonly channel = 'sms' as const;

  private readonly client: Dysmsapi;
  private readonly signName: string;
  private readonly templateCode: string;

  constructor() {
    const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID || '';
    const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET || '';
    const endpoint = process.env.ALIYUN_SMS_ENDPOINT || 'dysmsapi.aliyuncs.com';
    this.signName = process.env.ALIYUN_SMS_SIGN_NAME || '';
    this.templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE || '';

    const config = new $OpenApi.Config({
      accessKeyId,
      accessKeySecret
    });
    config.endpoint = endpoint;
    this.client = new Dysmsapi(config);
  }

  async send(message: VerificationMessage): Promise<void> {
    const request = new $Dysmsapi.SendSmsRequest({
      phoneNumbers: message.target,
      signName: this.signName,
      templateCode: this.templateCode,
      templateParam: JSON.stringify({ code: message.code })
    });

    const runtime = new $Util.RuntimeOptions({});
    const result = await this.client.sendSmsWithOptions(request, runtime);
    if (result.body?.code !== 'OK') {
      throw new Error(result.body?.message || 'Aliyun SMS send failed');
    }
  }
}
