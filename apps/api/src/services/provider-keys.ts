const encoder = new TextEncoder()

async function encryptionKey(secret: string) {
  if (!secret || secret.length < 32)
    throw new Error('Provider key encryption is not configured')
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'HKDF',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode('rhyme:byok:v1'),
      info: encoder.encode('provider-keys'),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const decode = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0))

export async function encryptProviderKey(
  apiKey: string,
  secret: string,
  identity: string,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(identity) },
    await encryptionKey(secret),
    encoder.encode(apiKey),
  )
  return `v1.${encode(iv)}.${encode(new Uint8Array(encrypted))}`
}

export async function decryptProviderKey(
  value: string,
  secret: string,
  identity: string,
) {
  const [version, iv, data] = value.split('.')
  if (version !== 'v1' || !iv || !data)
    throw new Error('Invalid encrypted provider key')
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decode(iv),
      additionalData: encoder.encode(identity),
    },
    await encryptionKey(secret),
    decode(data),
  )
  return new TextDecoder().decode(decrypted)
}
