import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAIConnections } from '@rhyme/hooks/queries'
import type { RouterOutputs } from '@rhyme/trpc-client'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { agentConfigSchema, DEFAULT_AGENT_CONFIG } from 'api/agent-config'
import { supportsUltrafast } from 'api/byok-schema'
import type { AgentConfig } from 'api/agent-config'

type Connections = RouterOutputs['aiConnections']['list']
type Preferences = { config?: AgentConfig; connections?: Connections }

export const useAssistantStore = create<{
  accounts: Record<string, Preferences>
  setConfig: (userId: string, config: AgentConfig) => void
  setConnections: (userId: string, connections: Connections) => void
}>()(
  persist(
    (set) => ({
      accounts: {},
      setConfig: (userId, config) =>
        set((state) => ({
          accounts: {
            ...state.accounts,
            [userId]: { ...state.accounts[userId], config },
          },
        })),
      setConnections: (userId, connections) =>
        set((state) => {
          const previous = state.accounts[userId]
          if (
            JSON.stringify(previous?.connections) ===
            JSON.stringify(connections)
          )
            return state
          return {
            accounts: {
              ...state.accounts,
              [userId]: { ...previous, connections },
            },
          }
        }),
    }),
    {
      name: 'rhyme-assistant-preferences',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ accounts: state.accounts }),
    },
  ),
)

export function useAssistantPreferences() {
  const queryClient = useQueryClient()
  const userId =
    queryClient.getQueryData<{ user: { id: string } }>(['session'])?.user.id ??
    ''
  const preferences = useAssistantStore((state) => state.accounts[userId])
  const connections = useAIConnections(preferences?.connections)
  const parsed = agentConfigSchema.safeParse(preferences?.config)
  const config = parsed.success ? preferences!.config! : DEFAULT_AGENT_CONFIG

  useEffect(() => {
    if (!userId || !connections.data || connections.isPlaceholderData) return
    useAssistantStore.getState().setConnections(userId, connections.data)
    if (config.connectionId) {
      const connection = connections.data.find(
        (item) =>
          item.id === config.connectionId && item.models.includes(config.model),
      )
      if (!connection)
        useAssistantStore.getState().setConfig(userId, DEFAULT_AGENT_CONFIG)
      else if (
        config.serviceTier === 'ultrafast' &&
        !supportsUltrafast(connection.provider, config.model)
      )
        useAssistantStore
          .getState()
          .setConfig(userId, { ...config, serviceTier: 'standard' })
    }
  }, [userId, connections.data, connections.isPlaceholderData, config])

  return {
    config,
    connections,
    configure: async (next: AgentConfig) => {
      if (!userId) return false
      const validated = agentConfigSchema.safeParse(next)
      if (!validated.success) return false
      useAssistantStore.getState().setConfig(userId, validated.data)
      return true
    },
  }
}
