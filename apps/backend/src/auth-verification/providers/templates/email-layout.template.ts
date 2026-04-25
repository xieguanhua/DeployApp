export type EmailLayoutInput = {
  lang?: string;
  headerIcon: string;
  headerTitle: string;
  greeting: string;
  bodyText: string;
  contentHtml: string;
  securityNote: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildEmailLayout(input: EmailLayoutInput): string {
  const lang = input.lang?.toLowerCase().startsWith('en') ? 'en' : 'zh-CN';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(input.headerTitle)}</title>
</head>
<body style="margin:0; padding:0; width:100%; background-color:#f6f8ff; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse; background-color:#f6f8ff;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="500" style="border-collapse:collapse; width:100%; max-width:500px; background-color:#ffffff; border-radius:20px;">
          <tr>
            <td align="center" bgcolor="#646cff" style="padding:44px 28px; text-align:center; background-color:#646cff; background-image:linear-gradient(135deg,#646cff 0%,#7c3aed 100%); border-radius:20px 20px 0 0;">
              <div style="display:inline-block; width:64px; height:64px; line-height:64px; border-radius:18px; border:1px solid rgba(255,255,255,0.35); color:#ffffff; font-size:28px; font-weight:700; background-color:rgba(255,255,255,0.2); margin-bottom:16px;">${escapeHtml(input.headerIcon)}</div>
              <div style="margin:0; color:#ffffff; font-size:24px; font-weight:800; line-height:1.2;">${escapeHtml(input.headerTitle)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 28px 28px; color:#374151;">
              <div style="font-size:20px; font-weight:700; line-height:1.4; color:#111827; margin-bottom:10px;">${escapeHtml(input.greeting)}</div>
              <div style="font-size:15px; line-height:1.7; color:#6b7280; margin-bottom:24px;">${escapeHtml(input.bodyText)}</div>
              ${input.contentHtml}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse; background-color:#f9fafb; border-left:4px solid #646cff; border-radius:12px;">
                <tr>
                  <td style="padding:16px; font-size:13px; color:#6b7280; line-height:1.6;">
                    ${escapeHtml(input.securityNote)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
