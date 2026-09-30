import { useId, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useProfile, useSettings } from '@rhyme/hooks/queries'
import { useCompleteProfile, useUpdateSettings } from '@rhyme/hooks/mutations'
import { Button } from '@rhyme/ui/components/button'
import { Input } from '@rhyme/ui/components/input'
import { Label } from '@rhyme/ui/components/label'
import { Skeleton } from '@rhyme/ui/components/skeleton'
import { Switch } from '@rhyme/ui/components/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rhyme/ui/components/select'
import { defaultPreferences } from 'api/preferences-schema'
import type { preferencesSchema } from 'api/preferences-schema'
import { profileSchema } from 'api/profile-schema'
import type { z } from 'zod'
import type { ReactNode } from 'react'
import { PageHeading } from '@/components/page-heading'
import { WorkspaceShell } from '@/features/files/workspace-shell'
import type { SessionUser } from '@/lib/auth'

type Preferences = z.infer<typeof preferencesSchema>

export function SettingsPage({ user }: { user: SessionUser }) {
  const settings = useSettings()
  const profile = useProfile()
  const update = useUpdateSettings()
  const complete = useCompleteProfile()
  const router = useRouter()
  const [name, setName] = useState(user.name)
  const [profileError, setProfileError] = useState<string | null>(null)
  const preferences = settings.data
  const save = (patch: Partial<Preferences>) => {
    if (!preferences || update.isPending) return
    update.mutate(patch)
  }
  const saveProfile = (nextName: string, analyticsConsent: boolean) => {
    if (!profile.data || complete.isPending) return
    const result = profileSchema.safeParse({
      ...profile.data,
      name: nextName,
      analyticsConsent,
    })
    if (!result.success) {
      setProfileError('Enter a name between 1 and 80 characters.')
      return
    }
    setProfileError(null)
    complete.mutate(result.data, { onSuccess: () => router.invalidate() })
  }
  const pending = settings.isPending || update.isPending
  return (
    <WorkspaceShell user={user} section="settings" title="Settings">
      <main className="workspace-page">
        <div className="max-w-3xl">
          <PageHeading
            title="Settings"
            description="Manage your account and workspace preferences."
          />
          <div
            role="status"
            aria-live="polite"
            className="text-muted-foreground mb-6 min-h-5 text-xs"
          >
            {update.isPending || complete.isPending
              ? 'Saving…'
              : 'Preferences are saved to your account automatically.'}
          </div>
          {settings.isError ? (
            <div className="rounded-lg border p-5">
              <p className="text-sm">Unable to load preferences.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => void settings.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : settings.isPending ? (
            <div aria-label="Loading preferences" className="space-y-4">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            preferences && (
              <div className="space-y-8">
                <SettingsSection title="Workspace">
                  <SettingRow
                    title="Home page"
                    description="Choose what opens when you visit Rhyme. After sign-up, the dashboard always opens."
                  >
                    <Select
                      value={preferences.homeDestination}
                      onValueChange={(value) =>
                        save({
                          homeDestination:
                            value as Preferences['homeDestination'],
                        })
                      }
                      disabled={pending}
                    >
                      <SelectTrigger
                        aria-label="Home page"
                        className="w-full sm:w-52"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dashboard">Dashboard</SelectItem>
                        <SelectItem value="last-edited">
                          Last edited canvas
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                  <p className="text-muted-foreground px-5 pb-4 text-xs">
                    If your last edited canvas is unavailable, the dashboard
                    opens.
                  </p>
                </SettingsSection>
                <SettingsSection title="Appearance">
                  <SettingRow
                    title="Theme"
                    description="Use light mode, dark mode, or follow your system appearance."
                  >
                    <Select
                      value={preferences.theme}
                      onValueChange={(value) =>
                        save({ theme: value as Preferences['theme'] })
                      }
                      disabled={pending}
                    >
                      <SelectTrigger
                        aria-label="Theme"
                        className="w-full sm:w-52"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                </SettingsSection>
                <SettingsSection
                  title="Canvas defaults"
                  description="Applied when you open a canvas. You can change them temporarily from the canvas menu."
                >
                  <ToggleRow
                    title="Show grid"
                    description="Display a dot grid on the canvas."
                    checked={preferences.showGrid}
                    disabled={pending}
                    onChange={(showGrid) => save({ showGrid })}
                  />
                  <ToggleRow
                    title="Snap to shapes"
                    description="Align shapes with nearby shapes as you move them."
                    checked={preferences.snapToShapes}
                    disabled={pending}
                    onChange={(snapToShapes) => save({ snapToShapes })}
                  />
                  <ToggleRow
                    title="Open assistant"
                    description="Show the assistant panel when you open an editable canvas."
                    checked={preferences.openAssistant}
                    disabled={pending}
                    onChange={(openAssistant) => save({ openAssistant })}
                  />
                </SettingsSection>
                <SettingsSection title="Account">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (profile.data)
                        saveProfile(name, profile.data.analyticsConsent)
                    }}
                  >
                    <SettingRow
                      title="Display name"
                      description="Shown to people you share canvases with."
                    >
                      <div className="flex w-full items-center gap-2 sm:w-72">
                        <Input
                          aria-label="Display name"
                          value={name}
                          maxLength={80}
                          required
                          onChange={(event) => setName(event.target.value)}
                          disabled={complete.isPending}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          disabled={
                            complete.isPending ||
                            name.trim() === user.name ||
                            !name.trim()
                          }
                        >
                          Save
                        </Button>
                      </div>
                    </SettingRow>
                  </form>
                  <SettingRow
                    title="Email address"
                    description="Used for sign-in verification codes."
                  >
                    <span className="break-all text-sm">{user.email}</span>
                  </SettingRow>
                  {profile.data && (
                    <ToggleRow
                      title="Usage analytics"
                      description="Allow optional usage analytics. Canvas content is excluded."
                      checked={profile.data.analyticsConsent}
                      disabled={complete.isPending}
                      onChange={(consent) => saveProfile(user.name, consent)}
                    />
                  )}
                  {profile.isError && (
                    <p
                      role="alert"
                      className="text-destructive px-5 pb-4 text-sm"
                    >
                      Unable to load account preferences.{' '}
                      <button
                        className="underline"
                        onClick={() => void profile.refetch()}
                      >
                        Try again
                      </button>
                    </p>
                  )}
                </SettingsSection>
                <div className="flex items-center justify-between gap-4 border-t pt-5">
                  <p className="text-muted-foreground text-xs">
                    Reset appearance, home page, and canvas defaults.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => update.mutate(defaultPreferences)}
                  >
                    Reset preferences
                  </Button>
                </div>
              </div>
            )
          )}
          {(update.error || complete.error || profileError) && (
            <p role="alert" className="text-destructive mt-5 text-sm">
              {update.error?.message ?? complete.error?.message ?? profileError}
            </p>
          )}
        </div>
      </main>
    </WorkspaceShell>
  )
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {description && (
        <p className="text-muted-foreground mb-4 text-xs leading-5">
          {description}
        </p>
      )}
      <div className="overflow-hidden rounded-lg border bg-card">
        {children}
      </div>
    </section>
  )
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-b px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mt-1 text-xs leading-5">
          {description}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  disabled: boolean
  onChange: (value: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-6 border-b px-5 py-4 last:border-b-0">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">
          {title}
        </Label>
        <p
          id={`${id}-description`}
          className="text-muted-foreground mt-1 text-xs leading-5"
        >
          {description}
        </p>
      </div>
      <Switch
        id={id}
        aria-describedby={`${id}-description`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  )
}
