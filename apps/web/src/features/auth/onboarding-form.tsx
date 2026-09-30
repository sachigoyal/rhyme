import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Questionnaire } from '@shadcn/react/questionnaire'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { profileSchema } from 'api/profile-schema'
import { useCompleteProfile } from '@rhyme/hooks/mutations'
import { buttonVariants } from '@rhyme/ui/components/button'
import { cn } from '@rhyme/ui/lib/utils'
import { displayName, sessionQuery } from '@/lib/auth'
import type { SessionUser } from '@/lib/auth'
import { guestDraft } from './guest-draft'

const questions = [
  {
    name: 'name',
    title: 'What should we call you?',
    description: 'A little introduction before your next big idea.',
    required: true,
    choices: [],
  },
  {
    name: 'role',
    title: 'What kind of work do you do?',
    description: 'Help us understand the people who create with Rhyme.',
    required: false,
    choices: [
      {
        value: 'design',
        label: 'Design',
        detail: 'Shape ideas and experiences',
      },
      {
        value: 'engineering',
        label: 'Engineering',
        detail: 'Build and map systems',
      },
      {
        value: 'product',
        label: 'Product & business',
        detail: 'Plan what comes next',
      },
      {
        value: 'education',
        label: 'Education',
        detail: 'Learn and teach visually',
      },
      {
        value: 'other',
        label: 'Something else',
        detail: 'There is room for every idea',
      },
    ],
  },
  {
    name: 'useCases',
    title: 'What will you make here?',
    description:
      'Choose as many as you like. There is no wrong starting point.',
    required: false,
    multiple: true,
    choices: [
      {
        value: 'brainstorming',
        label: 'Brainstorms',
        detail: 'Give your ideas some space',
      },
      {
        value: 'diagrams',
        label: 'Diagrams',
        detail: 'Make the complex clear',
      },
      {
        value: 'wireframes',
        label: 'Wireframes',
        detail: 'Explore an interface',
      },
      {
        value: 'planning',
        label: 'Plans & workshops',
        detail: 'Get everyone on the same page',
      },
      {
        value: 'teaching',
        label: 'Learning & teaching',
        detail: 'Think it through together',
      },
    ],
  },
  {
    name: 'teamSize',
    title: 'Who are you creating with?',
    description: 'A solo practice or a shared workspace — both belong here.',
    required: false,
    choices: [
      { value: 'solo', label: 'Just me' },
      { value: '2-10', label: '2–10 people' },
      { value: '11-50', label: '11–50 people' },
      { value: '51+', label: 'More than 50 people' },
    ],
  },
  {
    name: 'referral',
    title: 'How did you find Rhyme?',
    description: 'This helps us know where to meet our next creators.',
    required: false,
    choices: [
      { value: 'friend', label: 'A friend or colleague' },
      { value: 'search', label: 'Search' },
      { value: 'social', label: 'Social media' },
      { value: 'other', label: 'Somewhere else' },
    ],
  },
  {
    name: 'analyticsConsent',
    title: 'Help us make Rhyme better?',
    description:
      'Allow usage analytics to improve the experience. Your answers are stored in your profile; canvas content is never included in usage analytics.',
    required: true,
    choices: [
      {
        value: 'yes',
        label: 'Yes, share usage analytics',
        detail: 'Help us understand what works',
      },
      {
        value: 'no',
        label: 'No thanks',
        detail: 'Keep optional analytics off',
      },
    ],
  },
] as const

export function OnboardingForm({
  user,
  redirectTo,
}: {
  user: SessionUser
  redirectTo: string
}) {
  const [item, setItem] = useState('name')
  const [validationError, setValidationError] = useState<string | null>(null)
  const complete = useCompleteProfile()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const activeIndex = questions.findIndex((question) => question.name === item)

  return (
    <Questionnaire.Root
      items={questions}
      item={item}
      onItemChange={setItem}
      shortcuts="letters"
      className="w-full max-w-lg"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const result = profileSchema.safeParse({
          name: data.get('name'),
          role: data.get('role') ?? null,
          useCases: data.getAll('useCases'),
          teamSize: data.get('teamSize') ?? null,
          referral: data.get('referral') ?? null,
          analyticsConsent: data.get('analyticsConsent') === 'yes',
        })
        if (!result.success) {
          setValidationError(
            result.error.issues[0]?.message ??
              'Check your answers and try again.',
          )
          setItem('name')
          return
        }
        setValidationError(null)
        complete.mutate(result.data, {
          onSuccess: async () => {
            await queryClient.fetchQuery({ ...sessionQuery, staleTime: 0 })
            await navigate({ href: guestDraft.get() ? '/' : redirectTo })
          },
        })
      }}
    >
      <div className="mb-10 flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
          Make yourself at home
        </span>
        <Questionnaire.Progress className="text-muted-foreground text-xs" />
      </div>
      <div className="mb-10 flex gap-1.5" aria-hidden>
        {questions.map((question, index) => (
          <span
            key={question.name}
            className={cn(
              'h-1 flex-1 rounded-full',
              index <= activeIndex ? 'bg-foreground' : 'bg-muted',
            )}
          />
        ))}
      </div>
      <fieldset disabled={complete.isPending} className="min-w-0">
        {questions.map((question) => (
          <Questionnaire.Item
            key={question.name}
            name={question.name}
            required={question.required}
            multiple={'multiple' in question && question.multiple}
            className="min-h-96 min-w-0"
          >
            <Questionnaire.Title className="mb-3 text-3xl font-medium tracking-tight text-balance">
              {question.title}
            </Questionnaire.Title>
            <Questionnaire.Description className="text-muted-foreground mb-8 max-w-md text-sm leading-relaxed">
              {question.description}
            </Questionnaire.Description>
            <Questionnaire.Choices className="grid gap-2">
              {question.name === 'name' ? (
                <Questionnaire.Input
                  aria-label="Your name"
                  autoComplete="given-name"
                  defaultValue={user.name || displayName(user)}
                  maxLength={80}
                  placeholder="Your name"
                  className="border-input focus-visible:border-ring h-12 w-full rounded-lg border bg-transparent px-4 text-lg outline-none"
                />
              ) : (
                question.choices.map((choice) => (
                  <Questionnaire.Choice
                    key={choice.value}
                    value={choice.value}
                    className="border-border hover:bg-muted/50 focus-within:border-ring data-[checked]:border-foreground data-[checked]:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors"
                  >
                    <Questionnaire.ChoiceInput className="accent-foreground size-4 shrink-0" />
                    <Questionnaire.ChoiceLabel className="flex flex-1 flex-col gap-0.5 text-sm">
                      <span className="font-medium">{choice.label}</span>
                      {'detail' in choice && (
                        <span className="text-muted-foreground text-xs">
                          {choice.detail}
                        </span>
                      )}
                    </Questionnaire.ChoiceLabel>
                    <Questionnaire.ChoiceShortcut className="text-muted-foreground text-xs" />
                  </Questionnaire.Choice>
                ))
              )}
            </Questionnaire.Choices>
            <Questionnaire.Error className="text-destructive mt-3 text-sm" />
          </Questionnaire.Item>
        ))}
        <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
          <Questionnaire.Previous
            className={buttonVariants({ variant: 'ghost' })}
          >
            <ArrowLeft className="size-4" /> Back
          </Questionnaire.Previous>
          <div className="ml-auto flex items-center gap-2">
            <Questionnaire.Skip
              className={buttonVariants({ variant: 'ghost' })}
            >
              Skip
            </Questionnaire.Skip>
            <Questionnaire.Next className={buttonVariants()}>
              Continue <ArrowRight className="size-4" />
            </Questionnaire.Next>
            <Questionnaire.Submit className={buttonVariants()}>
              {complete.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}{' '}
              Open my canvas
            </Questionnaire.Submit>
          </div>
        </div>
      </fieldset>
      {(complete.error || validationError) && (
        <p role="alert" className="text-destructive mt-4 text-sm">
          {complete.error?.message ?? validationError}
        </p>
      )}
    </Questionnaire.Root>
  )
}
