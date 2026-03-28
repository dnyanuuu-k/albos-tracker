/**
 * Transactional email. Set RESEND_API_KEY + EMAIL_FROM in production (Resend).
 * Without RESEND_API_KEY, sends are logged only (safe for local dev).
 */

import { serverConfig } from '@/lib/server-config';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

async function sendViaResend(options: EmailOptions): Promise<{ id: string }> {
  const key = serverConfig.resendApiKey;
  if (!key) throw new Error('RESEND_API_KEY not set');

  const { to, subject, html, text, from = serverConfig.emailFrom } = options;
  const toList = Array.isArray(to) ? to : [to];

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: toList,
      subject,
      html: html || undefined,
      text: text || undefined,
    }),
  });

  const body = (await res.json()) as { id?: string; message?: string; name?: string };

  if (!res.ok) {
    console.error('[email] Resend error:', res.status, body);
    throw new Error(body.message || 'Failed to send email');
  }

  return { id: body.id || 'sent' };
}

function logMockEmail(options: EmailOptions): { id: string } {
  const { to, subject, html, text, from = serverConfig.emailFrom } = options;
  console.log('=== EMAIL (mock — set RESEND_API_KEY for production) ===');
  console.log('From:', from);
  console.log('To:', Array.isArray(to) ? to.join(', ') : to);
  console.log('Subject:', subject);
  if (text) console.log('Text:', text);
  if (html) console.log('HTML:', html.slice(0, 500) + (html.length > 500 ? '…' : ''));
  console.log('======================================================');
  return { id: `mock_${Date.now()}` };
}

/**
 * Send an email: Resend when configured, otherwise console mock.
 */
export async function sendEmail(options: EmailOptions): Promise<{ id: string }> {
  if (serverConfig.resendApiKey) {
    return sendViaResend(options);
  }
  return logMockEmail(options);
}

export async function sendInvitationEmail(
  email: string,
  name: string,
  orgName: string,
  setupLink: string
): Promise<{ id: string }> {
  return sendEmail({
    to: email,
    subject: `Invitation to join ${orgName} on ETMS`,
    html: `
      <h2>Welcome to ETMS</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>You have been invited to join <strong>${escapeHtml(orgName)}</strong> on ETMS.</p>
      <p><a href="${setupLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept invitation</a></p>
      <p style="margin-top: 20px; color: #666;">This link expires in 72 hours.</p>
      <p>If you did not expect this email, you can ignore it.</p>
    `,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  resetLink: string
): Promise<{ id: string }> {
  return sendEmail({
    to: email,
    subject: 'Reset your ETMS password',
    html: `
      <h2>Password reset</h2>
      <p>We received a request to reset the password for your ETMS account.</p>
      <p><a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset password</a></p>
      <p style="margin-top: 16px; color: #666;">This link expires in 15 minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
    text: `Reset your password: ${resetLink}\n\nThis link expires in 15 minutes.`,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
