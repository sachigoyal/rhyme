import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canGenerateConversationTitle,
  fallbackConversationTitle,
  normalizeConversationTitle,
} from '../src/agents/conversation-title.ts'

test('only an automatic first-prompt title is eligible for generation', () => {
  const promptTitle = 'Help me draw a launch plan for our new stationery brand'
  assert.equal(
    canGenerateConversationTitle({
      source: 'pending',
      title: 'New conversation',
      promptTitle,
    }),
    true,
  )
  assert.equal(
    canGenerateConversationTitle({
      source: 'pending',
      title: promptTitle,
      promptTitle,
    }),
    true,
  )
  assert.equal(
    canGenerateConversationTitle({
      source: 'pending',
      title: 'My personal launch plan',
      promptTitle,
    }),
    false,
  )
  assert.equal(
    canGenerateConversationTitle({
      source: 'pending',
      title: 'New conversation',
      promptTitle: '',
    }),
    false,
  )
})

test('manual renames and completed or in-flight generation are never regenerated', () => {
  const promptTitle = 'My original prompt'
  for (const source of ['manual', 'generated', 'generating']) {
    assert.equal(
      canGenerateConversationTitle({ source, title: promptTitle, promptTitle }),
      false,
    )
    assert.equal(
      canGenerateConversationTitle({
        source,
        title: 'New conversation',
        promptTitle,
      }),
      false,
    )
  }
})

test('generated titles are clean, single-line and bounded', () => {
  assert.equal(
    normalizeConversationTitle(
      'Title: "Stationery Brand Launch Plan"\nExtra explanation',
    ),
    'Stationery Brand Launch Plan',
  )
  assert.equal(
    normalizeConversationTitle('  **A   short title.**  '),
    'A short title',
  )
  const title = normalizeConversationTitle(
    'A very long descriptive conversation title with many extra words that should disappear',
  )
  assert.ok(title.length <= 60)
  assert.ok(title.split(' ').length <= 7)
  assert.equal(normalizeConversationTitle('   '), '')
})

test('failure fallback stays concise and never invents an unrelated subject', () => {
  assert.equal(
    fallbackConversationTitle('Could you please draw a launch plan'),
    'Draw a launch plan',
  )
  assert.equal(fallbackConversationTitle(''), 'New conversation')
  assert.ok(fallbackConversationTitle('x'.repeat(200)).length <= 60)
})
