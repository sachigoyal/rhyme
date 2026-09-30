import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@rhyme/ui/components/theme'
import type { Theme } from '@rhyme/ui/components/theme'
import { Avatar, AvatarFallback } from '@rhyme/ui/components/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
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
  return (
    <Avatar className={className}>
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
  children: React.ReactNode
}) {
  const { theme, setTheme } = useTheme()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const signOut = async () => {
    await authClient.signOut()
    queryClient.clear()
    await navigate({ to: '/sign-in' })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-medium">{displayName(user)}</p>
          <p className="text-muted-foreground truncate text-xs">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => setTheme(value as Theme)}
            >
              {themes.map(({ value, label, icon: Icon }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  <Icon />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
