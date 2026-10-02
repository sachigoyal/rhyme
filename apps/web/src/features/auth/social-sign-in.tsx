import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@rhyme/ui/components/button'
import { authClient } from '@/lib/auth'

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
            ? `${provider === 'google' ? 'Google' : 'GitHub'} sign-in isn’t configured yet. Please use email for now.`
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
            <GitHubIcon />
          )}
          Continue with {provider === 'google' ? 'Google' : 'GitHub'}
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

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-4"
      aria-hidden="true"
    >
      <path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.64 1.22 3.28.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.01-.12-.29-.5-1.43.11-2.98 0 0 .95-.3 3.09 1.15a10.8 10.8 0 0 1 5.62 0c2.14-1.45 3.08-1.15 3.08-1.15.62 1.55.23 2.69.12 2.98.72.78 1.15 1.78 1.15 3.01 0 4.32-2.63 5.27-5.14 5.55.4.35.77 1.03.77 2.08v3.1c0 .3.2.65.77.54A11.25 11.25 0 0 0 12 .75Z" />
    </svg>
  )
}
