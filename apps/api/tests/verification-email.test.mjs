import assert from 'node:assert/strict'
import test from 'node:test'
import {
  verificationCodeEmail,
  OTP_EXPIRY_SECONDS,
} from '../src/emails/verification-code.ts'
import { sendVerificationCode } from '../src/lib/email.ts'

const subjects = {
  'sign-in': 'Your Rhyme sign-in code',
  'email-verification': 'Verify your Rhyme email',
  'forget-password': 'Reset your Rhyme password',
  'change-email': 'Confirm your Rhyme email change',
}

test('every OTP purpose uses accurate copy and keeps codes out of the subject and preview', () => {
  for (const [type, subject] of Object.entries(subjects)) {
    for (const code of ['012345', '987654']) {
      const email = verificationCodeEmail({ type, code })
      assert.equal(email.subject, subject)
      assert.ok(!email.subject.includes(code))
      assert.ok(!email.html.match(/<div[^>]*>(.*?)<\/div>/s)[1].includes(code))
      assert.ok(email.text.includes(`\n\n${code}\n\n`))
      assert.equal(email.html.split(code).length, 2)
      assert.ok(
        email.html.includes(`expires in ${OTP_EXPIRY_SECONDS / 60} minutes`),
      )
      assert.ok(
        email.text.includes(`expires in ${OTP_EXPIRY_SECONDS / 60} minutes`),
      )
      assert.ok(email.html.includes('Do not share this code.'))
    }
  }
})

test('the brand is embedded as a PNG and code emails remain readable without images', () => {
  const email = verificationCodeEmail({ type: 'sign-in', code: '012345' })
  const image = email.attachments[0]
  const png = Buffer.from(image.content, 'base64')
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(png.readUInt32BE(16), 330)
  assert.equal(image.type, 'image/png')
  assert.equal(image.disposition, 'inline')
  assert.ok(email.html.includes(`src="cid:${image.contentId}"`))
  assert.ok(email.html.includes('alt="Rhyme"'))
  assert.ok(!email.html.includes('<svg'))
  assert.ok(email.html.includes('background-color:#ffffff'))
  assert.ok(email.html.includes('#eeeaf4'))
  assert.deepEqual(email.headers, {
    'Auto-Submitted': 'auto-generated',
    'Content-Language': 'en',
  })
})

test('invalid codes or purposes cannot become email content', () => {
  for (const code of ['12345', '1234567', '<img/>', '123\n45', 'ABCDEF'])
    assert.throws(() => verificationCodeEmail({ type: 'sign-in', code }))
  for (const type of ['unknown', 'toString', '__proto__'])
    assert.throws(() => verificationCodeEmail({ type, code: '012345' }))
})

test('sending uses the correct purpose and failure logs contain neither code nor recipient', async () => {
  const sent = []
  await sendVerificationCode(
    {
      EMAIL_FROM: 'auth@rhyme.sachi.dev',
      EMAIL: { send: async (message) => sent.push(message) },
    },
    {
      to: 'qa@example.com',
      code: '012345',
      type: 'change-email',
    },
  )
  assert.equal(sent[0].subject, subjects['change-email'])
  assert.deepEqual(sent[0].from, {
    name: 'Rhyme',
    email: 'auth@rhyme.sachi.dev',
  })
  const logged = []
  const original = console.error
  console.error = (message) => logged.push(message)
  try {
    await sendVerificationCode(
      {
        EMAIL_FROM: 'auth@rhyme.sachi.dev',
        EMAIL: {
          send: async () => {
            throw Object.assign(
              new Error('Provider rejected qa@example.com with code 012345'),
              { code: 'E_DELIVERY_FAILED' },
            )
          },
        },
      },
      { to: 'qa@example.com', code: '012345', type: 'sign-in' },
    )
  } finally {
    console.error = original
  }
  assert.deepEqual(JSON.parse(logged[0]), {
    event: 'verification_email_failed',
    type: 'sign-in',
    errorCode: 'E_DELIVERY_FAILED',
  })
  assert.ok(!logged[0].includes('012345'))
  assert.ok(!logged[0].includes('qa@example.com'))
})
