export class ProviderError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'ProviderError'
  }
}

export function providerError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error
  const errors: Record<string, unknown>[] = []
  let current = error
  for (let i = 0; i < 5 && current && typeof current === 'object'; i++) {
    const item = current as Record<string, unknown>
    errors.push(item)
    current = item.cause ?? item.lastError
  }
  const details = errors
    .map((item) => `${item.message ?? ''} ${item.responseBody ?? ''}`)
    .join(' ')
    .toLowerCase()
  const status = errors
    .map((item) => item.statusCode ?? item.status)
    .find((value) => typeof value === 'number')
  if (
    /insufficient_quota|quota exceeded|billing|credit|resource_exhausted/.test(
      details,
    )
  )
    return new ProviderError(
      'quota',
      'Your provider has no available credits or quota. Check billing and usage limits in your provider account.',
    )
  if (
    status === 401 ||
    /invalid_api_key|api key not valid|authentication_error|unauthenticated/.test(
      details,
    )
  )
    return new ProviderError(
      'invalid_key',
      'The provider rejected your API key. Replace it in Settings → AI connections and try again.',
    )
  if (status === 403 || /permission_denied/.test(details))
    return new ProviderError(
      'permission',
      'Your API key does not have permission to use this model. Check the key permissions and model access in your provider account.',
    )
  if (
    status === 404 ||
    /model_not_found|model.*(not found|does not exist|not available)/.test(
      details,
    )
  )
    return new ProviderError(
      'model_unavailable',
      'This model is unavailable for your API key. Check its exact model ID and your account access, or choose another model.',
    )
  if (status === 429 || /rate.limit|overloaded_error/.test(details))
    return new ProviderError(
      'rate_limit',
      'Your provider is receiving too many requests. Wait a moment and try again, or choose another model.',
    )
  if (status === 402)
    return new ProviderError(
      'quota',
      'Your provider requires available credits. Check billing in your provider account.',
    )
  if (
    /context.length|context_length|too many tokens|maximum context|input.*too long/.test(
      details,
    )
  )
    return new ProviderError(
      'context_limit',
      'This conversation exceeds the model’s context limit. Start a new conversation or choose a model with a larger context window.',
    )
  if (/content_filter|safety|blocked.*content/.test(details))
    return new ProviderError(
      'content_blocked',
      'The provider declined this request under its content policy. Rephrase your message and try again.',
    )
  if (
    /tool|function.call|image|vision|unsupported|not supported/.test(details) &&
    (status === 400 || status === 422)
  )
    return new ProviderError(
      'unsupported',
      'This model does not support the requested tools, images, or settings. Choose a model with tool calling, or turn off canvas images in the connection settings.',
    )
  if (
    errors.some((item) => item.name === 'TimeoutError') ||
    /timed?\s*out|timeout/.test(details)
  )
    return new ProviderError(
      'timeout',
      'The provider took too long to respond. Try again or choose a faster model.',
    )
  if (errors.some((item) => item.name === 'AbortError'))
    return new ProviderError(
      'cancelled',
      'The response was stopped. You can send another message.',
    )
  if (typeof status === 'number' && status >= 500)
    return new ProviderError(
      'provider_unavailable',
      'Your provider is temporarily unavailable. Try again shortly or choose another provider.',
    )
  if (status === 400 || status === 422)
    return new ProviderError(
      'invalid_request',
      'The provider rejected the model settings. Check the model ID and API base URL, or choose another model.',
    )
  if (/fetch|network|connect|dns|enotfound|redirect/.test(details))
    return new ProviderError(
      'connection',
      'Could not reach your provider. Check its API base URL and service status, then try again.',
    )
  return new ProviderError(
    'unknown',
    'The assistant could not complete this response. Try again, or check your AI connection in Settings.',
  )
}
