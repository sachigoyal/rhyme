export function getCanvasAgentOptions(
  fileId: string,
  conversationId: string,
  apiUrl: string,
) {
  return {
    agent: 'CanvasAgent',
    name: conversationId,
    basePath: `files/${fileId}/agent/${conversationId}/chat`,
    host: apiUrl,
    protocol: apiUrl.startsWith('https:') ? 'wss' : 'ws',
  } as const
}
