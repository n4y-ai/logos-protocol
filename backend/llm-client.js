/**
 * LLM Client Module
 * 
 * Handles communication with LLM Gateway (llm.nlplay.ai or custom)
 * Supports OpenAI-compatible API format
 */

require('dotenv').config();

// Configuration from environment
const LLM_GATEWAY_URL = process.env.LLM_GATEWAY_URL || 'https://llm.nlplay.ai/v1';
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const LLM_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || '1024', 10);
const LLM_TEMPERATURE = parseFloat(process.env.LLM_TEMPERATURE || '0.7');

/**
 * Check if LLM is configured
 */
function isConfigured() {
  return !!LLM_API_KEY;
}

/**
 * Get current LLM configuration (for debugging/health check)
 */
function getConfig() {
  return {
    gatewayUrl: LLM_GATEWAY_URL,
    model: LLM_MODEL,
    maxTokens: LLM_MAX_TOKENS,
    temperature: LLM_TEMPERATURE,
    configured: isConfigured()
  };
}

/**
 * Call LLM with messages
 * 
 * @param {Array<{role: string, content: string}>} messages - Chat messages
 * @param {Object} options - Optional overrides
 * @returns {Promise<{content: string, model: string, tokens: number}>}
 */
async function chat(messages, options = {}) {
  if (!isConfigured()) {
    throw new Error('LLM not configured: LLM_API_KEY not set');
  }

  const model = options.model || LLM_MODEL;
  const maxTokens = options.maxTokens || LLM_MAX_TOKENS;
  const temperature = options.temperature ?? LLM_TEMPERATURE;

  const requestBody = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: false
  };

  console.log(`[LLM] Calling ${model} via ${LLM_GATEWAY_URL}`);
  console.log(`[LLM] Messages: ${messages.length}, maxTokens: ${maxTokens}`);

  const response = await fetch(`${LLM_GATEWAY_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[LLM] Error ${response.status}: ${errorText}`);
    throw new Error(`LLM API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Extract response from OpenAI-compatible format
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM returned empty response');
  }

  const usage = data.usage || {};
  const totalTokens = usage.total_tokens || 
    (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);

  console.log(`[LLM] Response received: ${content.length} chars, ${totalTokens} tokens`);

  return {
    content,
    model: data.model || model,
    tokens: totalTokens,
    finishReason: data.choices?.[0]?.finish_reason || 'unknown'
  };
}

/**
 * Simple completion (system + user message)
 * 
 * @param {string} systemPrompt - System prompt
 * @param {string} userMessage - User message
 * @param {Object} options - Optional overrides
 */
async function complete(systemPrompt, userMessage, options = {}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  return chat(messages, options);
}

/**
 * Chat with history
 * 
 * @param {string} systemPrompt - System prompt
 * @param {Array<{role: string, content: string}>} history - Previous messages
 * @param {string} userMessage - New user message
 * @param {Object} options - Optional overrides
 */
async function chatWithHistory(systemPrompt, history = [], userMessage, options = {}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage }
  ];

  return chat(messages, options);
}

module.exports = {
  isConfigured,
  getConfig,
  chat,
  complete,
  chatWithHistory
};

