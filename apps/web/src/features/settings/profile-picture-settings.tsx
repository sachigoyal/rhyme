import { useRef } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useUpdateProfilePicture } from '@rhyme/hooks/mutations'
import { Button } from '@rhyme/ui/components/button'
import { toast } from '@rhyme/ui/components/toast'
import { UserAvatar } from '@/components/user-menu'
import { env } from '@/lib/env'
import type { SessionUser } from '@/lib/auth'

export function ProfilePictureSettings({ user }: { user: SessionUser }) {
  const input = useRef<HTMLInputElement>(null)
  const update = useUpdateProfilePicture(env.apiUrl)
  const router = useRouter()
  const save = async (file: File | null) => {
    if (
      file &&
      (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 2 * 1024 * 1024)
    ) {
      toast.error('Choose a PNG, JPG, or WebP image under 2 MB')
      return
    }
    try {
      await update.mutateAsync(file)
      await router.invalidate()
      toast.success('Profile picture updated')
    } catch {
      toast.error('Unable to save profile picture')
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-3">
      <UserAvatar user={user} className="size-12" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Profile picture</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Your own image or a unique grainy gradient. PNG, JPG, WebP · up to 2
          MB.
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Upload profile picture"
        className="sr-only"
        disabled={update.isPending}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void save(file)
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={update.isPending}
        onClick={() => input.current?.click()}
      >
        {update.isPending ? 'Saving…' : 'Upload picture'}
      </Button>
      {user.image && (
        <Button
          variant="ghost"
          size="sm"
          disabled={update.isPending}
          onClick={() => void save(null)}
        >
          Use generated
        </Button>
      )}
    </div>
  )
}
