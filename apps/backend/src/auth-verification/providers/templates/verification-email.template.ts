import { buildEmailLayout } from './email-layout.template';

type VerificationEmailTemplateInput = {
  code: string;
  lang?: string;
  expireSeconds?: number;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildVerificationEmailHtml(input: VerificationEmailTemplateInput): string {
  const isEnglish = input.lang?.toLowerCase().startsWith('en') ?? false;
  const expireMinutes = Math.max(1, Math.ceil((input.expireSeconds ?? 300) / 60));
  const platformName = isEnglish
    ? process.env.APP_NAME_EN || 'StarSail'
    : process.env.APP_NAME_ZH || '星帆';

  const contentHtml = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse; margin-bottom:24px; background-color:#f7f8ff; border:1px solid #e0e4ff; border-radius:16px;">
  <tr>
    <td align="center" style="padding:28px 16px;">
      <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#646cff; letter-spacing:2px; margin-bottom:14px;">
        ${isEnglish ? 'Verification Code' : '动态验证码'}
      </div>
      <div style="font-family:'Courier New', Courier, monospace; font-size:42px; font-weight:800; color:#111827; letter-spacing:8px; line-height:1.1;">
        ${escapeHtml(input.code)}
      </div>
      <div style="font-size:13px; color:#9ca3af; margin-top:14px; line-height:1.5;">
        ${isEnglish ? `This code expires in ${expireMinutes} minute(s)` : `该代码将在 ${expireMinutes} 分钟后过期`}
      </div>
    </td>
  </tr>
</table>`;

  return buildEmailLayout({
    lang: input.lang,
    headerIcon: '🛡️',
    headerTitle: isEnglish ? `${platformName} Security Verification` : `${platformName} 身份安全验证`,
    greeting: isEnglish ? 'Verify Your Action' : '验证您的操作',
    bodyText: isEnglish
      ? `To keep your ${platformName} account secure, we need to verify your identity. Please enter the 6-digit code below on the verification page.`
      : `为了保护您的 ${platformName} 账号安全，我们需要验证您的身份。请在页面中输入以下 6 位数字验证码。`,
    contentHtml,
    securityNote: isEnglish
      ? `Security Tip: If this was not you, please ignore this email. Never share your verification code with anyone. - ${platformName}`
      : `安全提醒：如非本人操作请忽略此邮件。请勿向任何人泄露您的验证码。 - ${platformName}`
  });
}
