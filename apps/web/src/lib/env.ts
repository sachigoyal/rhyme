export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8787',
  tldrawLicenseKey: import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined,
}
