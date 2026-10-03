import { buttonVariants } from '@rhyme/ui/components/button'

export function GitHubLink() {
  return (
    <a
      href="https://github.com/sachigoyal/rhyme"
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
    >
      GitHub
    </a>
  )
}
