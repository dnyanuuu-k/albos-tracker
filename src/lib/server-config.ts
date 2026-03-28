/**
 * Server-side configuration (read in API routes / server components only).
 * Document every variable in `.env.example`.
 */

export const serverConfig = {
  get appUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  },

  /** Base URL for the optional Socket.IO notification sidecar (internal HTTP). */
  get notificationServiceUrl(): string {
    return (
      process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005'
    ).replace(/\/$/, '');
  },

  /** Resend / SMTP "from" — must match a verified sender in production. */
  get emailFrom(): string {
    return process.env.EMAIL_FROM || 'ETMS <onboarding@resend.dev>';
  },

  get resendApiKey(): string | undefined {
    return process.env.RESEND_API_KEY;
  },
};
