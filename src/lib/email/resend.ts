import { Resend } from 'resend';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@scrantonbranchffl.com';

// Lazy-init so `next build` (which loads route modules to collect page data)
// doesn't crash when RESEND_API_KEY is absent. We only instantiate when the
// first email actually needs to be sent — that's the only path that requires
// the key, and we surface a clean error if it's missing at that point.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  _resend = new Resend(key);
  return _resend;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('Email send failed:', err);
    return { success: false, error: String(err) };
  }
}
