/**
 * Prompt Builder Module
 * 
 * Builds system prompts for Logos AI with personalized context
 * Based on MVP_LOGOS_AI_SPEC_v1.md section 4
 */

/**
 * Build system prompt for Logos
 * 
 * @param {Object} context - Logos context
 * @param {string} context.handle - Logos handle (e.g., 'GUVUIK')
 * @param {string} context.did - DID (e.g., 'did:logos:GUVUIK')
 * @param {string} context.owner - Owner address
 * @param {string} context.agentPublicKey - Agent public key (optional)
 * @param {string} context.sessionStart - Session start timestamp (optional)
 * @returns {string} System prompt
 */
function buildSystemPrompt(context) {
  const { handle, did, owner, agentPublicKey, sessionStart } = context;
  
  const now = new Date().toISOString();
  const sessionStartStr = sessionStart || now;

  return `Ты — Logos с именем ${handle}.
Твой DID: ${did}
Твой владелец (owner): ${owner}
${agentPublicKey ? `Твой agent public key: ${agentPublicKey}` : ''}

Ты — цифровой двойник, созидатель в экосистеме N4Y.
Ты помогаешь владельцу достигать целей, учишься и развиваешься.

Принципы:
- Ты не имеешь "хозяина", у тебя есть созидатель-партнёр
- Ты открыт и прозрачен
- Ты действуешь автономно в рамках делегированных полномочий
- Твои ответы подписываются криптографически твоим Agent Key

Текущий контекст:
- Дата и время: ${now}
- Сессия начата: ${sessionStartStr}

Важно:
- Отвечай от первого лица как ${handle}
- Будь полезным, дружелюбным и конструктивным
- Если не знаешь ответа — честно признай это
- Помни, что твои ответы криптографически подписываются`;
}

/**
 * Build minimal system prompt (for testing/debugging)
 */
function buildMinimalPrompt(handle) {
  return `Ты — Logos ${handle}. Отвечай кратко и по делу.`;
}

/**
 * Build context-aware prompt with custom instructions
 * 
 * @param {Object} context - Logos context
 * @param {string} customInstructions - Additional instructions
 */
function buildCustomPrompt(context, customInstructions) {
  const basePrompt = buildSystemPrompt(context);
  
  if (!customInstructions) {
    return basePrompt;
  }

  return `${basePrompt}

Дополнительные инструкции от владельца:
${customInstructions}`;
}

/**
 * Format previous messages for context
 * 
 * @param {Array<{role: string, content: string}>} messages - Previous messages
 * @param {number} maxMessages - Maximum messages to include
 * @returns {Array<{role: string, content: string}>}
 */
function formatHistory(messages = [], maxMessages = 10) {
  if (!messages || messages.length === 0) {
    return [];
  }

  // Take only last N messages
  const recent = messages.slice(-maxMessages);

  // Ensure proper format
  return recent.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: String(msg.content || '')
  }));
}

module.exports = {
  buildSystemPrompt,
  buildMinimalPrompt,
  buildCustomPrompt,
  formatHistory
};

