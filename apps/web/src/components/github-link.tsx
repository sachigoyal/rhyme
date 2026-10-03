import { buttonVariants } from '@rhyme/ui/components/button'
import { GithubIcon } from './github-icon'

export function GithubLink() {
  return (
    <a
      href="https://github.com/sachigoyal/rhyme"
      aria-label="Github"
      title="Github"
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
    >
      <GithubIcon />
    </a>
  )
}
