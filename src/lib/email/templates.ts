function wrapper(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background-color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#111827;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#1f2937;border-radius:12px;border:1px solid rgba(255,255,255,0.1);">
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>
      </table>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">Scranton Branch Fantasy Football League</p>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

function ctaButton(href: string, label: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td align="center">
    <a href="${href}" target="_blank" style="display:inline-block;padding:12px 32px;background-color:#6366f1;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">
      ${label}
    </a>
  </td></tr>
</table>`;
}

export function buildInviteEmail({
  memberName,
  leagueName,
  sleeperInviteLink,
  seasonYear,
}: {
  memberName: string;
  leagueName: string;
  sleeperInviteLink: string;
  seasonYear: string;
}): string {
  return wrapper(`
    <h1 style="color:#ffffff;font-size:22px;margin:0 0 8px;">You're in, ${memberName}!</h1>
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 16px;">
      You've been assigned to <strong style="color:#ffffff;">${leagueName}</strong> for the ${seasonYear} season.
    </p>
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 4px;">
      Click below to join your league on Sleeper. Once you're in, we'll automatically detect your enrollment.
    </p>
    ${ctaButton(sleeperInviteLink, 'Join League on Sleeper')}
    <p style="color:#6b7280;font-size:13px;margin:0;">
      If the button doesn't work, copy this link:<br/>
      <a href="${sleeperInviteLink}" style="color:#818cf8;word-break:break-all;">${sleeperInviteLink}</a>
    </p>
  `);
}

export function buildReminderEmail({
  memberName,
  leagueName,
  sleeperInviteLink,
  enrolledCount,
  totalCount,
}: {
  memberName: string;
  leagueName: string;
  sleeperInviteLink: string;
  enrolledCount: number;
  totalCount: number;
}): string {
  return wrapper(`
    <h1 style="color:#ffffff;font-size:22px;margin:0 0 8px;">Still waiting on you, ${memberName}</h1>
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 16px;">
      <strong style="color:#ffffff;">${enrolledCount} of ${totalCount}</strong> members have already joined
      <strong style="color:#ffffff;">${leagueName}</strong> on Sleeper. Don't get left behind!
    </p>
    ${ctaButton(sleeperInviteLink, 'Join League on Sleeper')}
    <p style="color:#6b7280;font-size:13px;margin:0;">
      If the button doesn't work, copy this link:<br/>
      <a href="${sleeperInviteLink}" style="color:#818cf8;word-break:break-all;">${sleeperInviteLink}</a>
    </p>
  `);
}
