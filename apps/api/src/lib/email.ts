import type { Env } from '../env'
import { signInCodeEmail } from '../emails/sign-in-code'

export async function sendSignInCode(
  env: Env,
  { to, code }: { to: string; code: string },
) {
  try {
    await env.EMAIL.send({
      from: { name: 'Rhyme', email: env.EMAIL_FROM },
      to,
      ...signInCodeEmail(code),
    })
  } catch (error) {
    console.error('Failed to send sign-in code', error)
  }
}
