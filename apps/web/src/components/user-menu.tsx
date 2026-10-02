import { useEffect, useState } from 'react'
import { generateAvatar } from '@/lib/avatar'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { LogOut, Monitor, Moon, Sun, Settings } from 'lucide-react'
import { useSettings } from '@rhyme/hooks/queries'
import { useUpdateSettings } from '@rhyme/hooks/mutations'
import { toast } from '@rhyme/ui/components/toast'
import { useTheme } from '@rhyme/ui/components/theme'
import type { Theme } from '@rhyme/ui/components/theme'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@rhyme/ui/components/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@rhyme/ui/components/dropdown-menu'
import { authClient, displayName } from '@/lib/auth'
import type { SessionUser } from '@/lib/auth'

const themes: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function UserAvatar({
  user,
  className,
}: {
  user: SessionUser
  className?: string
}) {
  const [generated, setGenerated] = useState<{
    seed: string
    url: string
  } | null>(null)
  useEffect(() => {
    let active = true
    void generateAvatar(user.id)
      .then((url) => {
        if (active) setGenerated({ seed: user.id, url })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [user.id])
  return (
    <Avatar className={className}>
      <AvatarImage
        src={
          user.image ||
          (generated?.seed === user.id ? generated.url : undefined)
        }
        alt={displayName(user)}
      />
      <AvatarFallback className="text-xs font-medium uppercase">
        {displayName(user).slice(0, 2)}
      </AvatarFallback>
    </Avatar>
  )
}

export function UserMenu({
  user,
  children,
}: {
  user: SessionUser
  children: React.ReactElement
}) {
  const { theme } = useTheme()
  const { data: preferences } = useSettings()
  const updateSettings = useUpdateSettings()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const signOut = async () => {
    const { error } = await authClient.signOut()
    if (error) {
      toast.error(error.message ?? 'Unable to sign out. Try again.')
      return
    }
    await queryClient.cancelQueries()
    queryClient.clear()
    await navigate({ to: '/' })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={children} />
      <DropdownMenuContent
        align="end"
        collisionPadding={8}
        className="w-60 max-w-[calc(100vw-1rem)]"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <p className="break-words font-medium">{displayName(user)}</p>
            <p className="text-muted-foreground break-all text-xs">
              {user.email}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            render={
              <Link to="/settings">
                <Settings />
                Settings
              </Link>
            }
          />
        </DropdownMenuGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Monitor />
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => {
                if (!preferences || updateSettings.isPending) return
                updateSettings.mutate(
                  { theme: value as Theme },
                  {
                    onError: () =>
                      toast.error('Unable to save theme preference'),
                  },
                )
              }}
            >
              {themes.map(({ value, label, icon: Icon }) => (
                <DropdownMenuRadioItem
                  key={value}
                  value={value}
                  disabled={updateSettings.isPending || !preferences}
                >
                  <Icon />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
