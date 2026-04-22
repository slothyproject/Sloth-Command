const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const { invokeAIProvider, normalizeProviderName } = require('../lib/ai-providers');

test('normalizeProviderName keeps provider routing stable', () => {
  assert.equal(normalizeProviderName('custom-openai'), 'custom_openai');
  assert.equal(normalizeProviderName('OpenAI'), 'openai');
});

test('invokeAIProvider routes OpenAI-compatible providers', async (t) => {
  const originalPost = axios.post;
  t.after(() => { axios.post = originalPost; });
  axios.post = async () => ({
    data: {
      choices: [{ message: { content: 'Hello from OpenAI' } }],
      usage: { total_tokens: 21 }
    }
  });

  const result = await invokeAIProvider({
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: 'secret'
  }, 'hello');

  assert.equal(result.text, 'Hello from OpenAI');
  assert.equal(result.usage.totalTokens, 21);
});

test('invokeAIProvider routes Anthropic providers', async (t) => {
  const originalPost = axios.post;
  t.after(() => { axios.post = originalPost; });
  axios.post = async () => ({
    data: {
      content: [{ type: 'text', text: 'Anthropic reply' }],
      usage: { input_tokens: 10, output_tokens: 5 }
    }
  });

  const result = await invokeAIProvider({
    provider: 'anthropic',
    model: 'claude-3-5-haiku-latest',
    apiKey: 'secret'
  }, 'hello');

  assert.equal(result.text, 'Anthropic reply');
});

test('invokeAIProvider routes Gemini providers', async (t) => {
  const originalPost = axios.post;
  t.after(() => { axios.post = originalPost; });
  axios.post = async () => ({
    data: {
      candidates: [{ content: { parts: [{ text: 'Gemini reply' }] } }],
      usageMetadata: { totalTokenCount: 9 }
    }
  });

  const result = await invokeAIProvider({
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    apiKey: 'secret'
  }, 'hello');

  assert.equal(result.text, 'Gemini reply');
  assert.equal(result.usage.totalTokens, 9);
});