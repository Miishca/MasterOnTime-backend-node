// Реальна відправка email через Resend (sandbox-домен onboarding@resend.dev
// поки не верифікований власний домен — Resend дозволяє слати ЛИШЕ на email
// самого власника акаунта Resend, будь-кому іншому лист відхилиться). Це
// нормально для розробки: forgot-password для власного акаунта реально
// прийде на пошту; для тестових @t.dev-адрес відправка мовчки не вдасться —
// саме тому лишаємо devResetToken-ехо в /auth/forgot-password як запасний
// шлях, а не прибираємо його.
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    // eslint-disable-next-line no-console
    console.log(`[email stub] RESEND_API_KEY not set — would send to ${to}: ${subject}`);
    return;
  }
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      // eslint-disable-next-line no-console
      console.error(`[email] Resend rejected the send to ${to}:`, error);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[email] send to ${to} failed:`, err);
  }
  // Навмисно не кидаємо помилку далі: відсутність email не повинна ламати
  // основний флоу (forgot-password все одно створює токен і працює через
  // devResetToken, навіть якщо лист не дійшов).
}

export function passwordResetEmail(resetLink: string): { subject: string; html: string } {
  return {
    subject: 'Reset your MasterOnTime password',
    html: `
      <p>Someone requested a password reset for your MasterOnTime account.</p>
      <p><a href="${resetLink}">Click here to set a new password</a> (expires in 1 hour).</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  };
}
