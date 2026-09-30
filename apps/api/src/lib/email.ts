import type { Env } from '../env'
import { verificationCodeEmail } from '../emails/verification-code.ts'
import type { VerificationPurpose } from '../emails/verification-code'

export async function sendVerificationCode(
  env: Env,
  { to, code, type }: { to: string; code: string; type: VerificationPurpose },
) {
  try {
    await env.EMAIL.send({
      from: { name: 'Rhyme', email: env.EMAIL_FROM },
      to,
      ...verificationCodeEmail({ code, type }),
    })
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'verification_email_failed',
        type,
        errorCode:
          error instanceof Error && 'code' in error ? error.code : 'UNKNOWN',
      }),
    )
  }
}
