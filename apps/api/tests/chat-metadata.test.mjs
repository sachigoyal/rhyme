import assert from 'node:assert/strict'
import test from 'node:test'
import {
  summarizeTool,
  summarizeToolResult,
  transcriptMetadata,
} from '../src/agents/chat-metadata.ts'

const message = (parts, role = 'assistant') => ({
  id: crypto.randomUUID(),
  role,
  parts,
})
const tool = (state, extra = {}) => ({
  type: 'tool-create_shapes',
  toolCallId: 'call-one',
  state,
  input: { shapes: [{}, {}, {}] },
  ...extra,
})

test('requested edits do not claim completion', () => {
  assert.equal(
    summarizeTool('create_shapes', { shapes: [{}, {}] }),
    'Requested: create 2 shapes',
  )
  assert.deepEqual(
    transcriptMetadata([message([tool('input-available')])]).changes,
    [],
  )
})

test('partial success counts applied shapes and explains failures', () => {
  const result = summarizeToolResult('create_shapes', {
    created: [{}],
    errors: [{ error: 'invalid arrow endpoint' }],
  })
  assert.deepEqual(result, { summary: 'Created 1 shape · 1 issue', applied: 1 })
  const changes = transcriptMetadata([
    message([tool('output-available', { output: { created: [{}, {}] } })]),
  ]).changes
  assert.equal(changes[0].summary, 'Created 2 shapes')
  assert.equal(changes[0].applied, 2)
})

test('declined deletion never describes a successful deletion', () => {
  const changes = transcriptMetadata([
    message([
      {
        type: 'tool-delete_shapes',
        toolCallId: 'denied',
        input: { ids: ['a'] },
        state: 'output-error',
        errorText: 'User declined',
      },
    ]),
  ]).changes
  assert.equal(changes[0].applied, 0)
  assert.equal(changes[0].summary, 'Delete shapes was declined or failed')
})

test('read calls, unknown tools and prototype properties never become canvas changes', () => {
  assert.equal(summarizeTool('read_canvas', { scope: 'page' }), null)
  assert.equal(summarizeTool('__proto__', { shapes: [{}] }), null)
  assert.equal(summarizeToolResult('toString', { created: [{}] }), null)
  assert.deepEqual(
    transcriptMetadata([
      message(
        [tool('output-available', { output: { created: [{}] } })],
        'user',
      ),
    ]).changes,
    [],
  )
})

test('metadata uses first user prompt and latest visible text with bounded excerpts', () => {
  const metadata = transcriptMetadata([
    message([{ type: 'text', text: '  Draw a flowchart  ' }], 'user'),
    message([
      { type: 'reasoning', text: 'private chain of thought' },
      { type: 'text', text: 'x'.repeat(1000) },
    ]),
  ])
  assert.equal(metadata.title, 'Draw a flowchart')
  assert.equal(metadata.lastMessage, 'x'.repeat(240))
  assert.equal(metadata.messageCount, 2)
})
