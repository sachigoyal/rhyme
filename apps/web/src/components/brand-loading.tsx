import { LogoMark } from './logo'

export function BrandLoading() {
  return (
    <main
      className="bg-background grid h-svh place-items-center"
      role="status"
      aria-label="Loading Rhyme"
    >
      <h1 className="sr-only">Online whiteboard</h1>
      <LogoMark className="size-12" animated />
    </main>
  )
}
