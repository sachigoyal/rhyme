import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Loader2, Mail } from 'lucide-react'
import { Button } from '@rhyme/ui/components/button'
import { Input } from '@rhyme/ui/components/input'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@rhyme/ui/components/input-otp'
import { Label } from '@rhyme/ui/components/label'
import { authClient, sessionQuery } from '@/lib/auth'

const CODE_LENGTH = 6

async function unwrap<T>(
  request: Promise<{ data: T; error: { message?: string } | null }>,
) {
  const { data, error } = await request
  if (error)
    throw new Error(error.message ?? 'Unable to complete sign-in. Try again.')
  return data
}

export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [resendIn, setResendIn] = useState(0)
  const queryClient = useQueryClient()
  const router = useRouter()
  const sendCode = useMutation({
    mutationFn: () =>
      unwrap(
        authClient.emailOtp.sendVerificationOtp({
          email: email.trim(),
          type: 'sign-in',
        }),
      ),
    onSuccess: () => {
      setStep('code')
      setResendIn(30)
    },
  })
  const verify = useMutation({
    mutationFn: (otp: string) =>
      unwrap(authClient.signIn.emailOtp({ email: email.trim(), otp })),
    onSuccess: async () => {
      await queryClient.cancelQueries()
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'session',
      })
      await queryClient.fetchQuery({ ...sessionQuery, staleTime: 0 })
      await router.navigate({
        to: '/auth/complete',
        search: { redirect: redirectTo },
      })
    },
    onError: () => setCode(''),
  })

  useEffect(() => {
    if (!resendIn) return
    const timer = window.setTimeout(
      () => setResendIn((remaining) => remaining - 1),
      1000,
    )
    return () => window.clearTimeout(timer)
  }, [resendIn])

  if (step === 'email') {
    return (
      <div>
        <h1 className="text-3xl font-medium tracking-tight">
          Sign in to Rhyme
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Enter your email to sign in or create an account.
        </p>
        <form
          className="mt-9 space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            sendCode.mutate()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 px-3"
              disabled={sendCode.isPending}
            />
          </div>
          <ErrorText error={sendCode.error} />
          <Button
            type="submit"
            className="h-11 w-full justify-between px-4"
            disabled={sendCode.isPending}
          >
            Continue with email{' '}
            {sendCode.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
          </Button>
          <p className="text-muted-foreground text-center text-xs">
            We’ll email you a verification code.
          </p>
        </form>
      </div>
    )
  }

  return (
    <div>
      <span className="bg-muted mb-6 grid size-10 place-items-center rounded-xl border">
        <Mail className="size-4" />
      </span>
      <h1 className="text-3xl font-medium tracking-tight">
        Enter verification code
      </h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        Enter the {CODE_LENGTH}-digit code we sent to
        <br />
        <span className="text-foreground font-medium">{email.trim()}</span>.
      </p>
      <form
        className="mt-8 space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (code.length === CODE_LENGTH && !verify.isPending)
            verify.mutate(code)
        }}
      >
        <Label htmlFor="sign-in-code" className="sr-only">
          Verification code
        </Label>
        <InputOTP
          id="sign-in-code"
          maxLength={CODE_LENGTH}
          value={code}
          onChange={setCode}
          onComplete={(otp) => {
            if (!verify.isPending) verify.mutate(otp)
          }}
          disabled={verify.isPending}
          autoFocus
          autoComplete="one-time-code"
          containerClassName="justify-between"
        >
          <InputOTPGroup className="w-full justify-between gap-2">
            {Array.from({ length: CODE_LENGTH }, (_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className="h-12 flex-1 rounded-lg border text-lg first:rounded-lg last:rounded-lg"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <ErrorText error={verify.error ?? sendCode.error} />
        <Button
          type="submit"
          className="h-11 w-full"
          disabled={code.length !== CODE_LENGTH || verify.isPending}
        >
          {verify.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Opening your workspace…
            </>
          ) : (
            <>
              Continue <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>
      <div className="mt-5 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={verify.isPending}
          onClick={() => {
            setStep('email')
            setCode('')
            verify.reset()
            sendCode.reset()
          }}
        >
          <ArrowLeft className="size-3.5" />
          Change email
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={sendCode.isPending || verify.isPending || resendIn > 0}
          onClick={() => {
            setCode('')
            verify.reset()
            sendCode.mutate()
          }}
        >
          {sendCode.isPending
            ? 'Sending…'
            : resendIn > 0
              ? `Resend in ${resendIn}s`
              : 'Resend code'}
        </Button>
      </div>
      <p className="text-muted-foreground mt-5 text-xs">
        The code expires in 10 minutes. Check your spam folder if it hasn’t
        arrived.
      </p>
    </div>
  )
}

function ErrorText({ error }: { error: Error | null }) {
  if (!error) return null
  return (
    <p role="alert" className="text-destructive text-sm">
      {error.message}
    </p>
  )
}
