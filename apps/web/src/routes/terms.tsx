import { createFileRoute, Link } from '@tanstack/react-router'
import { PolicyPage } from '@/components/policy-page'

export const Route = createFileRoute('/terms')({
  ssr: true,
  component: TermsPage,
})

function TermsPage() {
  return (
    <PolicyPage
      title="Terms of Service"
      description="Rhyme is a personal learning project, not a commercial service. These are a few simple expectations for using it."
    >
      <section>
        <h2>An experimental project</h2>
        <p>
          You are welcome to use Rhyme to draw, explore ideas, and try the
          canvas assistant. Features and limits may change, and the project may
          be paused or discontinued. It is provided as available, without a
          promise of uptime, support, or reliable backups. Keep your own copies
          of work you care about.
        </p>
      </section>
      <section>
        <h2>Your account and your work</h2>
        <p>
          Use an email and sign-in account you control. You keep ownership of
          the content you create. By saving or sharing it in Rhyme, you allow
          the project to store and process it to provide the features you
          choose. Only upload material you have permission to use, and choose
          collaborators carefully.
        </p>
      </section>
      <section>
        <h2>Be considerate</h2>
        <p>
          Do not use Rhyme for unlawful content, harassment, spam, or attempts
          to access someone else&apos;s account or drawings. Do not deliberately
          overload or attack the project. Access may be limited or removed to
          protect other users and keep the project running.
        </p>
      </section>
      <section>
        <h2>Using the assistant</h2>
        <p>
          AI responses and canvas edits can be incorrect. Review them before
          relying on them. Built-in AI has usage limits. Connecting your own AI
          provider can incur charges from that provider, which you manage
          through your provider account.
        </p>
      </section>
      <section>
        <h2>Privacy and changes</h2>
        <p>
          The <Link to="/privacy">privacy policy</Link> explains how sign-in
          details, drawings, and assistant conversations are handled. These
          terms may be updated as the project evolves. Nothing here takes away
          rights that apply to you under local law.
        </p>
      </section>
    </PolicyPage>
  )
}
