import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@rhyme/ui/components/button'
import { authClient } from '@/lib/auth'
import { GithubIcon } from '@/components/github-icon'

export function useSocialSignIn(redirectTo: string) {
  return useMutation({
    mutationFn: async (provider: 'google' | 'github') => {
      const callback = new URL('/auth/complete', window.location.origin)
      callback.searchParams.set('redirect', redirectTo)
      const errorCallback = new URL('/sign-in', window.location.origin)
      errorCallback.searchParams.set('redirect', redirectTo)
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: callback.href,
        newUserCallbackURL: callback.href,
        errorCallbackURL: errorCallback.href,
      })
      if (error)
        throw new Error(
          error.code === 'PROVIDER_NOT_FOUND'
            ? `${provider === 'google' ? 'Google' : 'Github'} sign-in isn’t configured yet. Please use email for now.`
            : (error.message ?? 'Unable to start sign-in. Please try again.'),
        )
    },
  })
}

export function SocialSignIn({
  signIn,
  authError,
  disabled,
}: {
  signIn: ReturnType<typeof useSocialSignIn>
  authError?: string
  disabled: boolean
}) {
  return (
    <div className="mt-8 space-y-3">
      {(['google', 'github'] as const).map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          className="h-11 w-full"
          disabled={disabled || signIn.isPending || signIn.isSuccess}
          onClick={() => signIn.mutate(provider)}
        >
          {signIn.isPending && signIn.variables === provider ? (
            <Loader2 className="size-4 animate-spin" />
          ) : provider === 'google' ? (
            <GoogleIcon />
          ) : (
            <GithubIcon />
          )}
          Continue with {provider === 'google' ? 'Google' : 'Github'}
        </Button>
      ))}
      {(signIn.error || authError) && (
        <p role="alert" className="text-destructive text-sm">
          {signIn.error?.message ??
            'Sign-in was canceled or couldn’t be completed. Please try again.'}
        </p>
      )}
      <div className="text-muted-foreground flex items-center gap-3 pt-3 text-xs">
        <span className="bg-border h-px flex-1" />
        or
        <span className="bg-border h-px flex-1" />
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.35-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.35 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
      />
    </svg>
  )
}
