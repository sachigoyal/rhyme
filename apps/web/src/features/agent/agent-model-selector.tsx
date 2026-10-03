import { ChevronDown } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useAssistantPreferences } from './assistant-preferences'
import { AGENT_MODELS, defaultAgentConfig } from 'api/agent-config'
import type { AgentConfig } from 'api/agent-config'
import { InputGroupButton } from '@rhyme/ui/components/input-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@rhyme/ui/components/dropdown-menu'

export function AgentModelSelector({
  config,
  onSelect,
  disabled,
}: {
  config: AgentConfig
  onSelect: (config: AgentConfig) => Promise<boolean>
  disabled: boolean
}) {
  const { connections } = useAssistantPreferences()
  const currentModel = AGENT_MODELS.find((model) => model.id === config.model)
  const currentConnection = connections.data?.find(
    (item) => item.id === config.connectionId,
  )
  const selected = config.connectionId
    ? `${config.connectionId}|${config.model}`
    : config.model

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <InputGroupButton
            size="sm"
            disabled={disabled}
            aria-label="Choose model"
            className="h-8 min-w-0 shrink gap-1.5 rounded-lg px-2.5 text-sm font-normal text-muted-foreground"
          >
            <span className="max-w-48 truncate">
              {config.connectionId
                ? `${currentConnection?.name ?? 'Saved connection'} · ${config.model}`
                : (currentModel?.label ?? 'Model')}
            </span>
            <ChevronDown className="size-3.5" />
          </InputGroupButton>
        }
      />
      <DropdownMenuContent
        side="top"
        align="start"
        className="max-h-96 w-72 overflow-y-auto border shadow-none ring-0"
      >
        <DropdownMenuRadioGroup
          value={selected}
          onValueChange={(value) => {
            if (value === selected) return
            const [connectionId, model] = value.split('|')
            const next = model
              ? defaultAgentConfig(model, connectionId)
              : defaultAgentConfig(value)
            void onSelect(next)
          }}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>Rhyme models</DropdownMenuLabel>
            {AGENT_MODELS.map((model) => (
              <DropdownMenuRadioItem
                key={model.id}
                value={model.id}
                disabled={disabled}
              >
                {model.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuGroup>
          {connections.data?.map((connection) => (
            <DropdownMenuGroup key={connection.id}>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>
                {connection.name} · Your API key
              </DropdownMenuLabel>
              {connection.models.map((model) => (
                <DropdownMenuRadioItem
                  key={model}
                  value={`${connection.id}|${model}`}
                  disabled={disabled}
                >
                  {model}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {connections.isError && (
            <DropdownMenuItem onClick={() => void connections.refetch()}>
              Connections unavailable · Retry
            </DropdownMenuItem>
          )}
          <DropdownMenuItem render={<Link to="/settings" />}>
            Manage AI connections
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
