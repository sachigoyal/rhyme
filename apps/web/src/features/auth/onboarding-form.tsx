import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Questionnaire } from '@shadcn/react/questionnaire'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { profileSchema } from 'api/profile-schema'
import { useProfile } from '@rhyme/hooks/queries'
import { useCompleteProfile } from '@rhyme/hooks/mutations'
import { buttonVariants } from '@rhyme/ui/components/button'
import { cn } from '@rhyme/ui/lib/utils'
import { displayName, sessionQuery } from '@/lib/auth'
import type { SessionUser } from '@/lib/auth'
import { onboardingDraft, onboardingSteps } from './onboarding-draft'
import type { OnboardingDraft } from './onboarding-draft'

const questions = [
  {
    name: 'name',
    title: 'Your name',
    description: 'Shown to people you share canvases with.',
    required: true,
    choices: [],
  },
  {
    name: 'role',
    title: 'Your role',
    description: 'Optional.',
    required: false,
    choices: [
      {
        value: 'design',
        label: 'Design',
      },
      {
        value: 'engineering',
        label: 'Engineering',
      },
      {
        value: 'product',
        label: 'Product & business',
      },
      {
        value: 'education',
        label: 'Education',
      },
      {
        value: 'other',
        label: 'Other',
      },
    ],
  },
  {
    name: 'useCases',
    title: 'How will you use Rhyme?',
    description: 'Select all that apply. Optional.',
    required: false,
    multiple: true,
    choices: [
      {
        value: 'brainstorming',
        label: 'Brainstorming',
      },
      {
        value: 'diagrams',
        label: 'Diagrams',
      },
      {
        value: 'wireframes',
        label: 'Wireframes',
      },
      {
        value: 'planning',
        label: 'Planning and workshops',
      },
      {
        value: 'teaching',
        label: 'Teaching and learning',
      },
    ],
  },
  {
    name: 'teamSize',
    title: 'Team size',
    description: 'How many people are on your team? Optional.',
    required: false,
    choices: [
      { value: 'solo', label: '1 person' },
      { value: '2-10', label: '2–10 people' },
      { value: '11-50', label: '11–50 people' },
      { value: '51+', label: '51+ people' },
    ],
  },
  {
    name: 'referral',
    title: 'How did you hear about Rhyme?',
    description: 'Optional.',
    required: false,
    choices: [
      { value: 'friend', label: 'A friend or colleague' },
      { value: 'search', label: 'Search' },
      { value: 'social', label: 'Social media' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    name: 'analyticsConsent',
    title: 'Usage analytics',
    description:
      'Choose whether to share usage analytics. Canvas content is excluded. Your selection is saved to your profile.',
    required: true,
    choices: [
      {
        value: 'yes',
        label: 'Share usage analytics',
        detail: 'Allow optional usage analytics',
      },
      {
        value: 'no',
        label: 'Don’t share usage analytics',
        detail: 'Disable optional usage analytics',
      },
    ],
  },
] as const

export function OnboardingForm({ user }: { user: SessionUser }) {
  const [draft, setDraft] = useState(() =>
    onboardingDraft.get(user.id, user.name || displayName(user)),
  )
  const draftRef = useRef(draft)
  const [storageError, setStorageError] = useState(false)
  const item = draft.step
  const updateDraft = (next: OnboardingDraft) => {
    draftRef.current = next
    setDraft(next)
    try {
      onboardingDraft.set(user.id, next)
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }
  const setItem = (step: string) => {
    if (onboardingSteps.includes(step as OnboardingDraft['step']))
      updateDraft({
        ...draftRef.current,
        step: step as OnboardingDraft['step'],
      })
  }
  const [validationError, setValidationError] = useState<string | null>(null)
  const complete = useCompleteProfile()
  const profile = useProfile()
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
        if (!draft.answers.analyticsConsent) {
          setItem('analyticsConsent')
          return
        }
        const result = profileSchema.safeParse({
          ...draft.answers,
          analyticsConsent: draft.answers.analyticsConsent === 'yes',
        })
        if (!result.success) {
          setValidationError(
            result.error.issues[0]?.message ??
              'Check your answers and try again.',
          )
          const field = result.error.issues[0]?.path[0]
          setItem(typeof field === 'string' ? field : 'name')
          return
        }
        setValidationError(null)
        complete.mutate(result.data, {
          onSuccess: async () => {
            await profile.refetch({ throwOnError: true })
            await queryClient.fetchQuery({ ...sessionQuery, staleTime: 0 })
            onboardingDraft.clear(user.id)
            await navigate({ to: '/auth/complete', replace: true })
          },
        })
      }}
    >
      <div className="mb-10 flex items-center justify-between">
        <span className="text-muted-foreground text-sm font-medium">
          Profile
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
                  value={draft.answers.name}
                  onChange={(event) =>
                    updateDraft({
                      ...draft,
                      answers: { ...draft.answers, name: event.target.value },
                    })
                  }
                  maxLength={80}
                  placeholder="Your name"
                  className="border-input focus-visible:border-ring h-12 w-full rounded-lg border bg-transparent px-4 text-lg outline-none"
                />
              ) : (
                question.choices.map((choice) => (
                  <Questionnaire.Choice
                    key={choice.value}
                    value={choice.value}
                    checked={
                      question.name === 'useCases'
                        ? draft.answers.useCases.includes(
                            choice.value as OnboardingDraft['answers']['useCases'][number],
                          )
                        : draft.answers[question.name] === choice.value
                    }
                    onChange={(event) => {
                      const value =
                        question.name === 'useCases'
                          ? event.target.checked
                            ? [...draft.answers.useCases, choice.value]
                            : draft.answers.useCases.filter(
                                (entry) => entry !== choice.value,
                              )
                          : event.target.checked
                            ? choice.value
                            : null
                      updateDraft({
                        ...draft,
                        answers: { ...draft.answers, [question.name]: value },
                      })
                    }}
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
              onClick={() =>
                updateDraft({
                  ...draft,
                  answers: {
                    ...draft.answers,
                    [item]: item === 'useCases' ? [] : null,
                  },
                })
              }
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
              {complete.isPending ? 'Saving…' : 'Finish setup'}
            </Questionnaire.Submit>
          </div>
        </div>
      </fieldset>
      {storageError && (
        <p role="status" className="text-muted-foreground mt-4 text-xs">
          Browser storage is unavailable. Keep this page open until setup is
          complete.
        </p>
      )}
      {(complete.error || validationError) && (
        <p role="alert" className="text-destructive mt-4 text-sm">
          {complete.error?.message ?? validationError}
        </p>
      )}
    </Questionnaire.Root>
  )
}
