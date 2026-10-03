import { createFileRoute, Link } from '@tanstack/react-router'
import { PolicyPage } from '@/components/policy-page'

export const Route = createFileRoute('/privacy')({
  ssr: true,
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy policy"
      description="Rhyme is a personal project built for learning and experimentation. This page explains what the app stores and where your information goes."
    >
      <section>
        <h2>What Rhyme stores</h2>
        <ul>
          <li>
            Your email, name, profile picture, and sign-in sessions. Google and
            Github sign-in also store a provider account identifier and OAuth
            tokens. Verified matching emails connect to the same Rhyme user.
          </li>
          <li>
            Drawings, uploaded media, thumbnails, folders, sharing permissions,
            and workspace preferences so you can return to your work.
          </li>
          <li>
            Assistant messages, canvas change previews, and AI usage records
            when you use the assistant.
          </li>
          <li>
            Optional profile answers and your usage analytics preference. Basic
            request and error logs may include technical details such as your IP
            address and browser information.
          </li>
        </ul>
      </section>
      <section>
        <h2>Why this information is used</h2>
        <p>
          It lets you sign in, save and share canvases, use the assistant, and
          manage your settings. Technical logs help keep the project working and
          investigate problems. Rhyme does not sell your personal information or
          use it for targeted advertising.
        </p>
      </section>
      <section>
        <h2>Browser storage and cookies</h2>
        <p>
          Sign-in cookies keep your session active. Your browser also stores
          drafts, drawing caches, and preferences locally. Guest drawings stay
          on your device until you sign in and import them. Clearing site data
          removes local copies and can erase unsynced work.
        </p>
      </section>
      <section>
        <h2>Hosting, sign-in, and AI providers</h2>
        <p>
          Cloudflare hosts the app and stores cloud data, handles sign-in
          emails, and runs the built-in AI models. If you choose Google or
          Github sign-in, that provider handles authentication and shares your
          basic profile and email with Rhyme. Loading a provider profile picture
          also makes a request to its image host.
        </p>
        <p className="mt-3">
          Using the assistant sends your messages and relevant canvas context to
          the selected AI provider. Depending on the model, that can include
          canvas images. If you connect your own AI provider, its own privacy
          and billing terms apply. Saved API keys are encrypted in Rhyme&apos;s
          database and used to contact that provider.
        </p>
        <p className="mt-3">
          These services may process information in different countries. Avoid
          adding sensitive information to an experimental project or its AI
          conversations.
        </p>
      </section>
      <section>
        <h2>Sharing and analytics</h2>
        <p>
          People you grant access to can view or edit a canvas according to
          their permissions. The maintainer can access hosted data when
          operating or debugging the project.
        </p>
        <p className="mt-3">
          You can change the optional usage analytics preference in Settings. A
          third-party analytics tracker is not currently integrated. Essential
          technical logs and AI usage records are stored independently of that
          preference.
        </p>
      </section>
      <section>
        <h2>Keeping and deleting data</h2>
        <p>
          Account and cloud workspace data are kept while you use the project,
          until you delete them or request removal. Trashed canvases remain
          until permanently deleted. Deleting a canvas does not automatically
          delete its conversation and activity history; you can delete
          conversations separately. Local browser copies remain until you clear
          them.
        </p>
        <p className="mt-3">
          You can edit your name and picture in Settings, remove sharing access,
          delete your canvases and conversations, and remove saved AI keys.
          Rhyme does not currently have a self-service account deletion button.
        </p>
      </section>
      <section>
        <h2>Updates</h2>
        <p>
          This page will be updated when the project&apos;s data practices
          change. The <Link to="/terms">Terms of Service</Link> explain what to
          expect from this learning project.
        </p>
      </section>
    </PolicyPage>
  )
}
