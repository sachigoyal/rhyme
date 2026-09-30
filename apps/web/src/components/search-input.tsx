import { Search, X } from 'lucide-react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@rhyme/ui/components/input-group'

export function SearchInput({
  value,
  onChange,
  label,
  className,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  className?: string
}) {
  return (
    <InputGroup className={className}>
      <InputGroupInput
        aria-label={label}
        placeholder={`${label}…`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault()
            onChange('')
          }
        }}
      />
      <InputGroupAddon>
        <Search className="size-3.5" />
      </InputGroupAddon>
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label="Clear search"
            size="icon-xs"
            onClick={() => onChange('')}
          >
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}
