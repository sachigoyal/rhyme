import { useState } from 'react'
import { KeyRound, Loader2, Plus } from 'lucide-react'
import { useAIConnections } from '@rhyme/hooks/queries'
import {
  useRemoveAIConnection,
  useSaveAIConnection,
  useTestAIConnection,
} from '@rhyme/hooks/mutations'
import { Button } from '@rhyme/ui/components/button'
import { Input } from '@rhyme/ui/components/input'
import { Label } from '@rhyme/ui/components/label'
import { Switch } from '@rhyme/ui/components/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@rhyme/ui/components/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rhyme/ui/components/select'
import { toast } from '@rhyme/ui/components/toast'
import {
  PROVIDERS,
  connectionInputSchema,
  supportsUltrafast,
} from 'api/byok-schema'
import type { AIConnection, Provider } from 'api/byok-schema'

export function AIConnectionsSettings() {
  const connections = useAIConnections()
  const save = useSaveAIConnection()
  const test = useTestAIConnection()
  const remove = useRemoveAIConnection()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AIConnection | null>(null)
  const [provider, setProvider] = useState<Provider>('openai')
  const [name, setName] = useState('OpenAI')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [models, setModels] = useState('gpt-6.1-sol')
  const [serviceTier, setServiceTier] = useState<'standard' | 'ultrafast'>(
    'standard',
  )
  const [vision, setVision] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const busy = save.isPending || test.isPending || remove.isPending
  const selectedProvider = PROVIDERS.find((item) => item.id === provider)!

  const edit = (connection: AIConnection | null) => {
    setEditing(connection)
    setProvider(connection?.provider ?? 'openai')
    setName(connection?.name ?? 'OpenAI')
    setModels(connection?.models.join(', ') ?? 'gpt-6.1-sol')
    setVision(connection?.vision ?? true)
    setServiceTier(connection?.serviceTier ?? 'standard')
    setBaseUrl(connection?.baseUrl ?? '')
    setApiKey('')
    setError(null)
    setOpen(true)
  }

  const close = (nextOpen: boolean) => {
    if (busy) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setApiKey('')
      save.reset()
      test.reset()
    }
  }

  return (
    <section
      className="rounded-xl border p-5"
      aria-labelledby="ai-connections-title"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="ai-connections-title" className="text-sm font-medium">
            AI connections
          </h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            Bring your own API key and models to the canvas assistant.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => edit(null)}
          disabled={busy}
        >
          <Plus />
          Add connection
        </Button>
      </div>
      <p className="text-muted-foreground mt-3 text-xs leading-5">
        Keys are encrypted and private to your account. Your provider receives
        your messages and canvas context when selected, and bills your API
        usage. Built-in models include a limited free allowance each month.
      </p>
      {connections.isPending ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Loading connections…
        </p>
      ) : connections.isError ? (
        <div role="alert" className="mt-4 text-sm">
          Unable to load AI connections.{' '}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void connections.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : connections.data.length === 0 ? (
        <div className="mt-5 flex items-center gap-3 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
          <KeyRound className="size-4 shrink-0" />
          Add OpenAI, Anthropic, Google Gemini, or an OpenAI-compatible
          provider.
        </div>
      ) : (
        <div className="mt-5 divide-y rounded-lg border">
          {connections.data.map((connection) => (
            <div key={connection.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{connection.name}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {
                      PROVIDERS.find((item) => item.id === connection.provider)
                        ?.label
                    }{' '}
                    · Key ending {connection.keyHint}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      test.mutate(connection, {
                        onSuccess: (result) => {
                          toast.success(`${result.model}: ${result.message}`)
                          test.reset()
                        },
                        onError: (failure) => {
                          toast.error(failure.message)
                          test.reset()
                        },
                      })
                    }
                  >
                    Test
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => edit(connection)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setRemoving(connection.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground mt-3 break-words text-xs leading-5">
                {connection.models.join(' · ')}
                {connection.vision ? ' · Canvas images enabled' : ''}
                {connection.serviceTier === 'ultrafast'
                  ? ' · Ultrafast default'
                  : ''}
              </p>
              {removing === connection.id && (
                <div
                  className="mt-3 flex flex-wrap items-center gap-2 text-xs"
                  role="alert"
                >
                  <span>
                    Remove this connection? Conversations will need another
                    model.
                  </span>
                  <Button
                    size="xs"
                    variant="destructive"
                    disabled={busy}
                    onClick={() =>
                      remove.mutate(
                        { id: connection.id },
                        {
                          onSuccess: () => {
                            setRemoving(null)
                            toast.success('Connection removed')
                          },
                          onError: (failure) => toast.error(failure.message),
                        },
                      )
                    }
                  >
                    Remove connection
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setRemoving(null)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit AI connection' : 'Add AI connection'}
            </DialogTitle>
            <DialogDescription>
              Use a model that supports tool calling. Saving makes a small
              request billed by your provider, testing Ultrafast access when
              enabled.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              const parsed = connectionInputSchema.safeParse({
                id: editing?.id,
                name,
                provider,
                apiKey: apiKey.trim() || undefined,
                baseUrl,
                models: models
                  .split(',')
                  .map((model) => model.trim())
                  .filter(Boolean),
                vision,
                serviceTier: models
                  .split(',')
                  .some((model) => supportsUltrafast(provider, model.trim()))
                  ? serviceTier
                  : 'standard',
              })
              if (!parsed.success) {
                setError(
                  parsed.error.issues[0]?.message ??
                    'Check your connection settings.',
                )
                return
              }
              setError(null)
              save.mutate(parsed.data, {
                onSuccess: () => {
                  setApiKey('')
                  setOpen(false)
                  save.reset()
                  toast.success(
                    'Connection verified and saved. Choose it in the assistant’s model menu.',
                  )
                },
                onError: (failure) => {
                  setError(failure.message)
                  save.reset()
                },
              })
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="ai-provider">Provider</Label>
              <Select
                value={provider}
                items={PROVIDERS.map((item) => ({
                  value: item.id,
                  label: item.label,
                }))}
                disabled={busy}
                onValueChange={(value) => {
                  if (!value) return
                  const next = PROVIDERS.find((item) => item.id === value)!
                  setProvider(next.id)
                  setName(next.label)
                  setModels(next.models[0] ?? '')
                  setVision(next.vision)
                  setBaseUrl('')
                  setServiceTier('standard')
                  setApiKey('')
                  setError(null)
                }}
              >
                <SelectTrigger id="ai-provider" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-name">Connection name</Label>
              <Input
                id="ai-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={80}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-key">API key</Label>
              <Input
                id="ai-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                required={!editing}
                maxLength={4096}
                placeholder={
                  editing
                    ? `Leave blank to keep key ending ${editing.keyHint}`
                    : 'Paste your provider API key'
                }
                disabled={busy}
              />
            </div>
            {provider === 'compatible' && (
              <div className="space-y-2">
                <Label htmlFor="ai-url">API base URL</Label>
                <Input
                  id="ai-url"
                  type="url"
                  placeholder="https://openrouter.ai/api/v1"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  required
                  disabled={busy}
                />
                <p className="text-muted-foreground text-xs">
                  Public HTTPS endpoint for an OpenAI-compatible Chat
                  Completions API.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="ai-models">Model IDs</Label>
              <Input
                id="ai-models"
                value={models}
                onChange={(event) => setModels(event.target.value)}
                placeholder="provider/model-id, another-model-id"
                required
                disabled={busy}
              />
              <p className="text-muted-foreground text-xs leading-5">
                Separate IDs with commas. Enter any model your key can access.
                Each appears in the assistant’s model menu.
              </p>
              {selectedProvider.models.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedProvider.models.map((model) => (
                    <Button
                      key={model}
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={busy}
                      onClick={() =>
                        setModels((current) =>
                          [
                            ...new Set([
                              ...current
                                .split(',')
                                .map((item) => item.trim())
                                .filter(Boolean),
                              model,
                            ]),
                          ].join(', '),
                        )
                      }
                    >
                      {model}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="ai-vision">Include canvas images</Label>
                <p className="text-muted-foreground mt-1 text-xs">
                  Enable only if every model in this connection supports images.
                </p>
              </div>
              <Switch
                id="ai-vision"
                checked={vision}
                onCheckedChange={setVision}
                disabled={busy}
              />
            </div>
            {models
              .split(',')
              .some((model) => supportsUltrafast(provider, model.trim())) && (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="ai-ultrafast">Default to Ultrafast</Label>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    Faster responses at higher cost for supported models.
                    GPT-5.6 Sol requires preview access. You can change the mode
                    in the composer.
                  </p>
                </div>
                <Switch
                  id="ai-ultrafast"
                  checked={serviceTier === 'ultrafast'}
                  onCheckedChange={(checked) =>
                    setServiceTier(checked ? 'ultrafast' : 'standard')
                  }
                  disabled={busy}
                />
              </div>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => close(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {save.isPending && <Loader2 className="animate-spin" />}
                {save.isPending ? 'Testing…' : 'Test and save'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
