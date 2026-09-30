import { ChevronDown, Loader2 } from 'lucide-react'
import { AGENT_MODELS, defaultAgentConfig } from 'api/agent-config'
import type { AgentConfig } from 'api/agent-config'
import { InputGroupButton } from '@rhyme/ui/components/input-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@rhyme/ui/components/dropdown-menu'

export function AgentModelSelector({
  config,
  onSelect,
  disabled,
  saving,
}: {
  config: AgentConfig
  onSelect: (config: AgentConfig) => Promise<boolean>
  disabled: boolean
  saving: boolean
}) {
  const currentModel = AGENT_MODELS.find((model) => model.id === config.model)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <InputGroupButton
            size="sm"
            disabled={disabled}
            aria-label="Choose model"
            className="h-8 min-w-0 gap-1.5 rounded-lg px-2.5 text-sm font-normal text-muted-foreground"
          >
            <span className="truncate">{currentModel?.label ?? 'Model'}</span>
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </InputGroupButton>
        }
      />
      <DropdownMenuContent
        side="top"
        align="start"
        className="w-48 border shadow-none ring-0"
      >
        <DropdownMenuRadioGroup
          value={config.model}
          onValueChange={(model) => {
            if (model !== config.model) void onSelect(defaultAgentConfig(model))
          }}
        >
          {AGENT_MODELS.map((model) => (
            <DropdownMenuRadioItem
              key={model.id}
              value={model.id}
              disabled={disabled}
            >
              {model.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
