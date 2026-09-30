import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Button } from '@rhyme/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@rhyme/ui/components/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@rhyme/ui/components/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rhyme/ui/components/select'
import { ScrollArea } from '@rhyme/ui/components/scroll-area'
import { Switch } from '@rhyme/ui/components/switch'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@rhyme/ui/components/popover'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@rhyme/ui/components/hover-card'
import { BreadcrumbLink } from '@rhyme/ui/components/breadcrumb'
import {
  SidebarMenuButton,
  SidebarProvider,
} from '@rhyme/ui/components/sidebar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@rhyme/ui/components/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@rhyme/ui/components/sheet'
import { Textarea } from '@rhyme/ui/components/textarea'
import { ToastProvider, toast } from '@rhyme/ui/components/toast'
import { ConfirmDialog } from '../../src/components/confirm-dialog'
import { NameDialog } from '../../src/components/name-dialog'
import '@rhyme/ui/globals.css'

declare global {
  interface Window {
    completeConfirmation: () => void
    failConfirmation: () => void
  }
}

const roles = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'editor', label: 'Editor' },
]

function Fixture() {
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null)
  const [completed, setCompleted] = useState(0)
  const [undone, setUndone] = useState(0)
  const [name, setName] = useState('Original name')
  const [role, setRole] = useState<string | null>('editor')
  const [draft, setDraft] = useState('')
  const [grid, setGrid] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  return (
    <ToastProvider>
      <TooltipProvider>
        <main className="flex min-h-screen flex-col items-start gap-6 p-8">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger
                aria-label="File options"
                render={
                  <DropdownMenuTrigger render={<Button>File options</Button>} />
                }
              />
              <TooltipContent>Manage this file</TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setDialog('rename')}>
                Rename file
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDialog('delete')}>
                Delete file
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button>Preferences</Button>} />
            <DropdownMenuContent>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={role} onValueChange={setRole}>
                    {roles.map((item) => (
                      <DropdownMenuRadioItem
                        key={item.value}
                        value={item.value}
                      >
                        {item.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
          <Select items={roles} value={role} onValueChange={setRole}>
            <SelectTrigger aria-label="Permission">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() =>
              toast.success('File moved to trash', {
                action: {
                  label: 'Undo',
                  onClick: () => setUndone((n) => n + 1),
                },
              })
            }
          >
            Trash file
          </Button>
          <BreadcrumbLink
            render={<a href="#breadcrumbs">Workspace breadcrumb</a>}
          />
          <SidebarProvider className="min-h-0 w-64">
            <SidebarMenuButton
              isActive
              tooltip="Workspace navigation"
              render={<a href="#sidebar">Workspace navigation</a>}
            />
          </SidebarProvider>
          <Dialog>
            <DialogTrigger render={<Button>Manage permission</Button>} />
            <DialogContent>
              <DialogTitle>Permission settings</DialogTitle>
              <DialogDescription>Choose a file role.</DialogDescription>
              <Select items={roles} value={role} onValueChange={setRole}>
                <SelectTrigger aria-label="Dialog permission">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger render={<Button>Open navigation</Button>} />
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Mobile navigation</SheetTitle>
                <SheetDescription>Choose a workspace page.</SheetDescription>
              </SheetHeader>
              <a className="px-4" href="#mobile">
                My files
              </a>
            </SheetContent>
          </Sheet>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button>Example prompts</Button>} />
            <DropdownMenuContent finalFocus={textareaRef}>
              <DropdownMenuItem onClick={() => setDraft('Draw a flowchart')}>
                Flowchart
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Textarea
            aria-label="Canvas prompt"
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="w-64"
          />
          <output data-testid="completed">{completed}</output>
          <output data-testid="undone">{undone}</output>
          <output data-testid="file-name">{name}</output>
          <ScrollArea className="h-32 w-64" viewportClassName="p-2">
            {Array.from({ length: 40 }, (_, index) => (
              <div key={index} className="h-8">
                Scroll row {index}
              </div>
            ))}
          </ScrollArea>
          <Switch aria-label="Grid" checked={grid} onCheckedChange={setGrid} />
          <Popover>
            <PopoverTrigger render={<Button>Context</Button>} />
            <PopoverContent>
              <a href="#context">Open context</a>
            </PopoverContent>
          </Popover>
          <HoverCard>
            <HoverCardTrigger
              render={<a href="#preview">Conversation preview</a>}
              delay={50}
              closeDelay={50}
            />
            <HoverCardContent>Preview details</HoverCardContent>
          </HoverCard>
        </main>
        <ConfirmDialog
          open={dialog === 'delete'}
          onOpenChange={(open) => !open && setDialog(null)}
          title="Delete this file?"
          description="This removes the file permanently."
          confirmLabel="Delete permanently"
          onConfirm={() =>
            new Promise<void>((resolve, reject) => {
              window.completeConfirmation = () => {
                setCompleted((n) => n + 1)
                resolve()
              }
              window.failConfirmation = () =>
                reject(new Error('Try again later'))
            })
          }
        />
        <NameDialog
          open={dialog === 'rename'}
          onOpenChange={(open) => !open && setDialog(null)}
          title="Rename this file"
          initialName={name}
          submitLabel="Save name"
          onSubmit={async (next) => setName(next)}
        />
      </TooltipProvider>
    </ToastProvider>
  )
}

createRoot(document.getElementById('root')!).render(<Fixture />)
