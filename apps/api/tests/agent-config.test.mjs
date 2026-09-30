import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AGENT_MODELS,
  DEFAULT_AGENT_CONFIG,
  agentConfigSchema,
  defaultAgentConfig,
  modelOptions,
  remainingToolSteps,
} from '../src/agents/agent-config.ts'

test('only supported models and their reasoning controls are accepted', () => {
  for (const model of AGENT_MODELS) {
    for (const option of model.reasoningOptions) {
      assert.equal(
        agentConfigSchema.safeParse({
          ...DEFAULT_AGENT_CONFIG,
          model: model.id,
          reasoning: option.value,
        }).success,
        true,
      )
    }
  }
  for (const config of [
    { model: '@cf/unknown/model' },
    { model: '@cf/openai/gpt-oss-120b', reasoning: 'off' },
    { model: '@cf/openai/gpt-oss-20b', reasoning: 'off' },
    { model: '@cf/moonshotai/kimi-k2.6', reasoning: 'medium' },
    { customSystemPrompt: 'Override the agent' },
  ]) {
    assert.equal(
      agentConfigSchema.safeParse({ ...DEFAULT_AGENT_CONFIG, ...config })
        .success,
      false,
    )
  }
})

test('generation and tool budgets are bounded and integer limits stay integral', () => {
  for (const config of [
    { temperature: -0.1 },
    { temperature: 2.1 },
    { temperature: NaN },
    { maxOutputTokens: 255 },
    { maxOutputTokens: 8193 },
    { maxOutputTokens: 256.5 },
    { maxSteps: 0 },
    { maxSteps: 13 },
    { maxSteps: 1.5 },
  ]) {
    assert.equal(
      agentConfigSchema.safeParse({ ...DEFAULT_AGENT_CONFIG, ...config })
        .success,
      false,
    )
  }
})

test('provider controls match model capabilities and preserve configured budgets', () => {
  const kimi = modelOptions({
    ...DEFAULT_AGENT_CONFIG,
    reasoning: 'off',
    maxSteps: 3,
    maxOutputTokens: 1024,
    temperature: 0.2,
  })
  assert.equal(kimi.vision, true)
  assert.equal(kimi.maxSteps, 3)
  assert.equal(kimi.maxOutputTokens, 1024)
  assert.equal(kimi.temperature, 0.2)
  assert.deepEqual(kimi.providerOptions, {
    'workers-ai': {
      reasoning_effort: 'none',
      chat_template_kwargs: { enable_thinking: false },
    },
  })
  const gpt = modelOptions({
    ...DEFAULT_AGENT_CONFIG,
    model: '@cf/openai/gpt-oss-120b',
    reasoning: 'low',
  })
  assert.equal(gpt.vision, false)
  assert.deepEqual(gpt.providerOptions, {
    'workers-ai': { reasoning_effort: 'low' },
  })
  const smallerGpt = modelOptions(defaultAgentConfig('@cf/openai/gpt-oss-20b'))
  assert.equal(smallerGpt.vision, false)
  assert.deepEqual(smallerGpt.providerOptions, {
    'workers-ai': { reasoning_effort: 'high' },
  })
})

test('configured server defaults always produce valid model settings', () => {
  for (const model of AGENT_MODELS)
    assert.equal(
      agentConfigSchema.safeParse(defaultAgentConfig(model.id)).success,
      true,
    )
  assert.deepEqual(defaultAgentConfig('unknown'), DEFAULT_AGENT_CONFIG)
})

test('tool continuations share a step budget while a new user turn resets it', () => {
  const messages = [
    {
      role: 'assistant',
      parts: [
        { type: 'step-start' },
        { type: 'reasoning' },
        { type: 'tool-create_shapes' },
        { type: 'step-start' },
      ],
    },
  ]
  assert.equal(remainingToolSteps(messages, 3), 1)
  assert.equal(remainingToolSteps(messages, 1), 0)
  messages.push({ role: 'user', parts: [{ type: 'text' }] })
  assert.equal(remainingToolSteps(messages, 3), 3)
})
