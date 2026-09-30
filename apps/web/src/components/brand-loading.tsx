import { LogoMark } from './logo'

export function BrandLoading() {
  return (
    <main
      className="bg-background grid h-svh place-items-center"
      role="status"
      aria-label="Loading Rhyme"
    >
      <h1 className="sr-only">Online whiteboard</h1>
      <LogoMark className="brand-loading-mark size-12" />
    </main>
  )
}
