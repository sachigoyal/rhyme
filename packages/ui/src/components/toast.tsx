'use client'

import type { ReactNode } from 'react'
import { Toast } from '@base-ui/react/toast'
import { CircleCheckIcon, OctagonXIcon, XIcon } from 'lucide-react'

const toastManager = Toast.createToastManager()

interface ToastOptions {
  action?: {
    label: ReactNode
    onClick: () => void
  }
}

function addToast(title: ReactNode, type?: string, options?: ToastOptions) {
  const id = toastManager.add({
    title,
    type,
    actionProps: options?.action
      ? {
          children: options.action.label,
          onClick: () => {
            options.action?.onClick()
            toastManager.close(id)
          },
        }
      : undefined,
  })
  return id
}

const toast = Object.assign(
  (title: ReactNode, options?: ToastOptions) =>
    addToast(title, undefined, options),
  {
    success: (title: ReactNode, options?: ToastOptions) =>
      addToast(title, 'success', options),
    error: (title: ReactNode, options?: ToastOptions) =>
      addToast(title, 'error', options),
  },
)

function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider toastManager={toastManager} timeout={4000} limit={3}>
      {children}
      <Toaster />
    </Toast.Provider>
  )
}

function Toaster() {
  const { toasts } = Toast.useToastManager()

  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed bottom-[max(24px,env(safe-area-inset-bottom))] left-1/2 z-[100] w-[calc(100%-32px)] max-w-[356px] -translate-x-1/2 outline-none">
        {toasts.map((item) => (
          <Toast.Root
            key={item.id}
            toast={item}
            swipeDirection={['down', 'left', 'right']}
            data-slot="toast"
            className="bg-popover text-popover-foreground absolute bottom-0 w-full origin-bottom rounded-lg border shadow-lg transition-[transform,height,opacity] duration-200 ease-out after:absolute after:top-full after:left-0 after:h-[15px] after:w-full motion-reduce:transition-none"
            style={({
              expanded,
              limited,
              transitionStatus,
              swipeDirection,
            }) => {
              const hidden = limited || transitionStatus === 'ending'
              const starting = transitionStatus === 'starting'
              const offset = expanded
                ? 'calc(var(--toast-offset-y) * -1 - var(--toast-index) * 14px)'
                : 'calc(var(--toast-index) * -12px - var(--toast-index) * 0.05 * var(--toast-frontmost-height, var(--toast-height)))'
              const x =
                hidden && swipeDirection === 'left'
                  ? 'calc(var(--toast-swipe-movement-x, 0px) - 150%)'
                  : hidden && swipeDirection === 'right'
                    ? 'calc(var(--toast-swipe-movement-x, 0px) + 150%)'
                    : 'var(--toast-swipe-movement-x, 0px)'
              const y =
                starting ||
                (hidden && (!swipeDirection || swipeDirection === 'down'))
                  ? 'calc(var(--toast-height) + 40px)'
                  : `calc(${offset} + var(--toast-swipe-movement-y, 0px))`
              const scale = expanded
                ? '1'
                : 'calc(1 - var(--toast-index) * 0.05)'

              return {
                height: expanded
                  ? 'var(--toast-height)'
                  : 'var(--toast-frontmost-height, var(--toast-height))',
                zIndex: 'calc(1000 - var(--toast-index))',
                opacity: hidden || starting ? 0 : 1,
                transform: `translateX(${x}) translateY(${y}) scale(${scale})`,
              }
            }}
          >
            <Toast.Content className="flex min-h-[52px] items-center gap-2 overflow-hidden p-4 transition-opacity duration-200 data-[behind]:opacity-0 data-[expanded]:opacity-100 motion-reduce:transition-none">
              {item.type === 'success' && (
                <CircleCheckIcon
                  aria-hidden="true"
                  className="size-4 shrink-0"
                />
              )}
              {item.type === 'error' && (
                <OctagonXIcon aria-hidden="true" className="size-4 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <Toast.Title className="text-[13px] leading-normal font-medium wrap-break-word" />
                {item.description && (
                  <Toast.Description className="text-muted-foreground mt-1 text-[13px] leading-normal wrap-break-word" />
                )}
              </div>
              {item.actionProps && (
                <Toast.Action className="bg-primary text-primary-foreground focus-visible:ring-ring/50 h-6 shrink-0 rounded px-2 text-xs font-medium outline-none focus-visible:ring-2" />
              )}
              <Toast.Close
                aria-label="Dismiss notification"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -mr-1 flex size-6 shrink-0 items-center justify-center rounded outline-none focus-visible:ring-2"
              >
                <XIcon aria-hidden="true" className="size-3.5" />
              </Toast.Close>
            </Toast.Content>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}

export { toast, toastManager, ToastProvider, Toaster }
