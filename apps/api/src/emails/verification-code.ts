import type { EmailOTPOptions } from 'better-auth/plugins/email-otp'
import { emailLogo } from './brand.ts'

export type VerificationPurpose = Parameters<
  EmailOTPOptions['sendVerificationOTP']
>[0]['type']

export const OTP_EXPIRY_SECONDS = 10 * 60

const purposes = {
  'sign-in': {
    subject: 'Your Rhyme sign-in code',
    title: 'Sign in to Rhyme',
    description: 'Enter this code in Rhyme to sign in or create an account.',
    preview: 'Use your verification code to continue to Rhyme.',
  },
  'email-verification': {
    subject: 'Verify your Rhyme email',
    title: 'Verify your email address',
    description: 'Enter this code in Rhyme to verify your email address.',
    preview: 'Confirm your email address for your Rhyme account.',
  },
  'forget-password': {
    subject: 'Reset your Rhyme password',
    title: 'Reset your password',
    description:
      'Enter this code in Rhyme to continue resetting your password.',
    preview: 'Use your verification code to reset your Rhyme password.',
  },
  'change-email': {
    subject: 'Confirm your Rhyme email change',
    title: 'Confirm your new email address',
    description:
      'Enter this code in Rhyme to confirm this email address for your account.',
    preview: 'Confirm the new email address for your Rhyme account.',
  },
} satisfies Record<
  VerificationPurpose,
  { subject: string; title: string; description: string; preview: string }
>

export function verificationCodeEmail({
  code,
  type,
}: {
  code: string
  type: VerificationPurpose
}) {
  if (!/^\d{6}$/.test(code)) throw new Error('Invalid verification code.')
  if (!Object.hasOwn(purposes, type))
    throw new Error('Invalid verification purpose.')
  const copy = purposes[type]
  const expiry = `This code expires in ${OTP_EXPIRY_SECONDS / 60} minutes.`
  const notice = 'If you didn’t request this email, you can ignore it.'
  return {
    subject: copy.subject,
    text: `${copy.title}\n\n${copy.description}\n\n${code}\n\n${expiry} Do not share this code.\n\n${notice}\n\nRhyme`,
    headers: { 'Auto-Submitted': 'auto-generated', 'Content-Language': 'en' },
    attachments: [
      {
        content: emailLogo,
        filename: 'rhyme-logo.png',
        type: 'image/png',
        disposition: 'inline' as const,
        contentId: 'rhyme-logo',
      },
    ],
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${copy.subject}</title>
    <style>
      @media only screen and (max-width:480px) {
        .email-content { padding:28px 24px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;width:100%;background-color:#ffffff;color:#262626;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;" aria-hidden="true">${copy.preview}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff">
      <tr><td align="center" style="padding:16px 0;">
        <!--[if mso]><table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
          <tr><td class="email-content" style="padding:32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="padding-bottom:28px;border-bottom:1px solid #e5e5e5;">
                <img src="cid:rhyme-logo" alt="Rhyme" width="132" height="32" style="display:block;border:0;outline:none;color:#262626;font-family:Georgia,'Times New Roman',serif;font-size:26px;">
              </td></tr>
              <tr><td style="padding-top:28px;">
                <h1 style="margin:0;font-size:24px;line-height:32px;font-weight:600;letter-spacing:-0.5px;">${copy.title}</h1>
                <p style="margin:12px 0 0;font-size:14px;line-height:22px;color:#737373;">${copy.description}</p>
              </td></tr>
              <tr><td style="padding-top:24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td align="center" bgcolor="#eeeaf4" style="padding:18px 12px;background-color:#eeeaf4;border:1px solid #e7e1ef;border-radius:8px;">
                    <p aria-label="Verification code" style="margin:0;padding-left:6px;color:#514569;font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace;font-size:32px;line-height:44px;font-weight:600;letter-spacing:6px;">${code}</p>
                  </td></tr>
                </table>
                <p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#737373;">${expiry} Do not share this code.</p>
              </td></tr>
              <tr><td style="padding-top:28px;">
                <p style="margin:0;font-size:13px;line-height:20px;color:#737373;">${notice}</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td></tr>
    </table>
  </body>
</html>`,
  }
}
