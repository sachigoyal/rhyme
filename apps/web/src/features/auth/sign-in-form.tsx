import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@rhyme/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@rhyme/ui/components/card'
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
  if (error) throw new Error(error.message ?? 'Something went wrong')
  return data
}

export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const queryClient = useQueryClient()
  const router = useRouter()

  const sendCode = useMutation({
    mutationFn: () =>
      unwrap(
        authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' }),
      ),
    onSuccess: () => setStep('code'),
  })

  const verify = useMutation({
    mutationFn: (otp: string) =>
      unwrap(authClient.signIn.emailOtp({ email, otp })),
    onSuccess: async () => {
      await queryClient.fetchQuery({ ...sessionQuery, staleTime: 0 })
      await router.navigate({ href: redirectTo })
    },
    onError: () => setCode(''),
  })

  if (step === 'email') {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome to Rhyme</CardTitle>
          <CardDescription>
            Sign in or create an account with your email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              sendCode.mutate()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <ErrorText error={sendCode.error} />
            <Button
              type="submit"
              className="w-full"
              disabled={sendCode.isPending}
            >
              {sendCode.isPending && <Loader2 className="animate-spin" />}
              Continue with email
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Check your inbox</CardTitle>
        <CardDescription>
          We sent a {CODE_LENGTH}-digit code to{' '}
          <span className="text-foreground font-medium">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-5">
        <InputOTP
          maxLength={CODE_LENGTH}
          value={code}
          onChange={setCode}
          onComplete={(otp) => verify.mutate(otp)}
          disabled={verify.isPending}
          autoFocus
        >
          <InputOTPGroup>
            {Array.from({ length: CODE_LENGTH }, (_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className="size-11 text-lg"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <ErrorText error={verify.error} />
        <div className="flex w-full items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStep('email')
              setCode('')
              verify.reset()
            }}
          >
            <ArrowLeft />
            Change email
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={sendCode.isPending}
            onClick={() => sendCode.mutate()}
          >
            {sendCode.isPending ? 'Sending…' : 'Resend code'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ErrorText({ error }: { error: Error | null }) {
  if (!error) return null
  return <p className="text-destructive text-center text-sm">{error.message}</p>
}
