const axios = require('axios');

function normalizeProviderName(value) {
  return String(value || '').trim().toLowerCase().replace(/-/g, '_');
}

function normalizeAIResponse(text, usage = {}, raw = {}) {
  return {
    text: String(text || '').trim(),
    usage: {
      promptTokens: Number(usage.promptTokens || usage.prompt_tokens || 0),
      completionTokens: Number(usage.completionTokens || usage.completion_tokens || 0),
      totalTokens: Number(usage.totalTokens || usage.total_tokens || 0)
    },
    raw
  };
}

async function invokeOpenAICompatible(config, prompt) {
  const baseUrl = (config.baseUrl || 'https://api.openai.com').replace(/\/$/, '');
  const response = await axios.post(
    `${baseUrl}/v1/chat/completions`,
    {
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7
    },
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: config.timeout || 20000
    }
  );

  const choice = response.data?.choices?.[0]?.message?.content || '';
  return normalizeAIResponse(choice, response.data?.usage, response.data);
}

async function invokeAnthropic(config, prompt) {
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: config.model,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    },
    {
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      timeout: config.timeout || 20000
    }
  );

  const text = (response.data?.content || [])
    .filter(part => part?.type === 'text')
    .map(part => part.text)
    .join('\n');
  return normalizeAIResponse(text, response.data?.usage, response.data);
}

async function invokeGemini(config, prompt) {
  const model = encodeURIComponent(config.model);
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 300 }
    },
    {
      timeout: config.timeout || 20000,
      headers: { 'Content-Type': 'application/json' }
    }
  );

  const text = (response.data?.candidates?.[0]?.content?.parts || [])
    .map(part => part.text || '')
    .join('\n');
  const usage = {
    prompt_tokens: response.data?.usageMetadata?.promptTokenCount || 0,
    completion_tokens: response.data?.usageMetadata?.candidatesTokenCount || 0,
    total_tokens: response.data?.usageMetadata?.totalTokenCount || 0
  };
  return normalizeAIResponse(text, usage, response.data);
}

async function invokeOllama(config, prompt) {
  const rawBase = String(config.baseUrl || 'http://localhost:11434').replace(/\/$/, '');
  // Strip trailing /v1 so we can append paths predictably
  const baseWithoutV1 = rawBase.replace(/\/v1$/, '');

  const openaiUrl = `${baseWithoutV1}/v1/chat/completions`;
  const nativeUrl = `${baseWithoutV1}/api/chat`;
  const headers = { 'Content-Type': 'application/json' };
  const apiKey = String(config.apiKey || '').trim();
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Try OpenAI-compatible endpoint first (Ollama >=0.1.24 + cloud)
  try {
    const response = await axios.post(
      openaiUrl,
      {
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.7,
        stream: false,
      },
      { headers, timeout: config.timeout || 25000 }
    );
    const text = response.data?.choices?.[0]?.message?.content || '';
    return normalizeAIResponse(text, response.data?.usage, response.data);
  } catch (openaiErr) {
    // Fall back to native Ollama /api/chat
    try {
      const nativeResponse = await axios.post(
        nativeUrl,
        {
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
        },
        { headers, timeout: config.timeout || 25000 }
      );
      const text = nativeResponse.data?.message?.content || '';
      return normalizeAIResponse(text, {}, nativeResponse.data);
    } catch (nativeErr) {
      // Surface the more informative error
      const err = nativeErr.response ? nativeErr : openaiErr;
      throw err;
    }
  }
}

async function invokeAIProvider(config, prompt) {
  const provider = normalizeProviderName(config.provider);
  if (!prompt || !String(prompt).trim()) {
    throw new Error('Prompt is required');
  }

  switch (provider) {
    case 'openai':
    case 'custom_openai':
      return invokeOpenAICompatible(config, prompt);
    case 'anthropic':
      return invokeAnthropic(config, prompt);
    case 'gemini':
      return invokeGemini(config, prompt);
    case 'ollama':
      return invokeOllama(config, prompt);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

module.exports = {
  invokeAIProvider,
  normalizeProviderName,
  normalizeAIResponse
};