import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveAgentStatus } from '../src/features/agent/agent-status.ts'

const status = (overrides = {}) =>
  resolveAgentStatus({
    messages: [],
    connected: true,
    busy: false,
    usingTools: false,
    error: false,
    completed: false,
    ...overrides,
  })
const message = (state, type = 'tool-read_canvas') => ({
  id: 'reply',
  role: 'assistant',
  parts: [{ type, state, toolCallId: 'call' }],
})

test('assistant expressions reflect connection, execution, approval, completion, and failure', () => {
  assert.equal(status(), 'idle')
  assert.equal(status({ connected: false }), 'connecting')
  assert.equal(status({ busy: true }), 'thinking')
  assert.equal(status({ usingTools: true }), 'editing')
  assert.equal(status({ completed: true }), 'done')
  assert.equal(status({ busy: true, completed: true }), 'thinking')
  assert.equal(status({ error: true, busy: true }), 'error')
  assert.equal(
    status({
      messages: [message('input-available', 'tool-delete_shapes')],
      busy: true,
    }),
    'approval',
  )
  assert.equal(
    status({
      messages: [message('output-available', 'tool-delete_shapes')],
      busy: true,
    }),
    'thinking',
  )
})

test('only unfinished tools in the active response show tool activity', () => {
  for (const state of ['input-streaming', 'input-available']) {
    assert.equal(status({ messages: [message(state)], busy: true }), 'editing')
  }
  for (const state of ['output-available', 'output-error']) {
    assert.equal(status({ messages: [message(state)], busy: true }), 'thinking')
  }
  assert.equal(
    status({
      messages: [
        message('input-available'),
        {
          id: 'new',
          role: 'user',
          parts: [{ type: 'text', text: 'Next request' }],
        },
      ],
      busy: true,
    }),
    'thinking',
  )
  assert.equal(
    status({ messages: [message('input-available')], completed: true }),
    'done',
  )
})
