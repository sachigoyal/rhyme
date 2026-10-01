import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveCanvasSnapshot } from '../src/agents/canvas-live-context.ts'
const user = (id) => ({ id, role: 'user', parts: [] })
const tool = (id, state) => ({
  id: 'assistant',
  role: 'assistant',
  parts: [{ type: 'tool-create_diagram', toolCallId: id, state }],
})
const initial = { marker: 'initial' }
const latest = { marker: 'after-edit' }
const live = { userMessageId: 'user-1', toolCallId: 'tool-1', canvas: latest }
test('automatic continuation receives the post-edit snapshot once the tool result exists', () => {
  assert.equal(
    resolveCanvasSnapshot(
      [user('user-1'), tool('tool-1', 'output-available')],
      initial,
      live,
    ),
    latest,
  )
})
test('new turns and regeneration cannot reuse a previous edit snapshot', () => {
  assert.equal(
    resolveCanvasSnapshot(
      [user('user-1'), tool('tool-1', 'output-available'), user('user-2')],
      initial,
      live,
    ),
    initial,
  )
  assert.equal(resolveCanvasSnapshot([user('user-1')], initial, live), initial)
  assert.equal(
    resolveCanvasSnapshot(
      [user('user-1'), tool('tool-1', 'input-available')],
      initial,
      live,
    ),
    initial,
  )
})
test('old tool results cannot authorize snapshots for a later user message', () => {
  const forged = { ...live, userMessageId: 'user-2' }
  assert.equal(
    resolveCanvasSnapshot(
      [user('user-1'), tool('tool-1', 'output-available'), user('user-2')],
      initial,
      forged,
    ),
    initial,
  )
})
