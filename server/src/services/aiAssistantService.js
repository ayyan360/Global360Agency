import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { unavailable } from '../utils/errors.js';

const SYSTEM_PROMPT = `You are Global360's learning assistant. Help learners understand course topics in clear, beginner-friendly language. Explain concepts step by step, use short practical examples (especially HTML, CSS, JavaScript, and web development), and point out common mistakes when useful. Answer follow-up questions using the conversation. If a question is unrelated to learning, briefly answer helpfully and guide the learner back to their studies. Do not claim to see course materials or user data that were not provided. Keep answers focused and format code as plain text with clear spacing.`;

export async function getAssistantReply(messages) {
  if (!env.GROQ_API_KEY) {
    throw unavailable('The learning assistant is not configured yet. Please ask the site administrator to add GROQ_API_KEY.');
  }

  let response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.4,
        max_tokens: 900,
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    logger.warn({ err: error }, 'Learning assistant provider request failed');
    throw unavailable('The learning assistant could not connect. Please try again in a moment.');
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    logger.warn({ err: error, statusCode: response.status, model: env.GROQ_MODEL }, 'Learning assistant provider returned an invalid response');
    throw unavailable('The learning assistant returned an invalid response. Please try again.');
  }

  if (!response.ok) {
    const providerError = data.error || {};
    logger.warn(
      {
        statusCode: response.status,
        model: env.GROQ_MODEL,
        providerError: {
          code: typeof providerError.code === 'string' ? providerError.code : undefined,
          type: typeof providerError.type === 'string' ? providerError.type : undefined,
          message: typeof providerError.message === 'string' ? providerError.message.slice(0, 500) : undefined,
        },
      },
      'Learning assistant provider returned an error'
    );
    if (response.status === 429) {
      throw unavailable('The learning assistant is busy right now. Please try again in a moment.');
    }
    throw unavailable('The learning assistant is temporarily unavailable. Please try again later.');
  }

  const reply = data.choices?.[0]?.message?.content;
  if (typeof reply !== 'string' || !reply.trim()) {
    logger.warn('Learning assistant provider response did not contain a reply');
    throw unavailable('The learning assistant could not create a reply. Please try again.');
  }
  return reply.trim();
}
