import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { env } from '../src/config/env.js';
import { getAssistantReply } from '../src/services/aiAssistantService.js';
import { createApp } from '../src/app.js';
import { aiAssistantBody } from '../src/validators/schemas.js';

describe('Learning assistant service', () => {
  it('accepts only supported page categories and defaults to no page context', () => {
    const messages = [{ role: 'user', content: 'Explain photosynthesis.' }];
    assert.equal(aiAssistantBody.parse({ messages }).pageContext, 'other');
    assert.equal(aiAssistantBody.safeParse({ messages, pageContext: 'student_dashboard' }).success, true);
    assert.equal(aiAssistantBody.safeParse({ messages, pageContext: 'https://example.com/private' }).success, false);
  });

  it('requires an authenticated session before accepting chat requests', async () => {
    const agent = request.agent(createApp());
    const csrf = await agent.get('/api/auth/csrf');
    const response = await agent
      .post('/api/ai-assistant/chat')
      .set('X-CSRF-Token', csrf.body.data.csrfToken)
      .send({ messages: [{ role: 'user', content: 'Explain div tags.' }] });

    assert.equal(response.status, 401);
  });

  it('sends bounded chat context to Groq and returns the generated reply', async () => {
    const originalKey = env.GROQ_API_KEY;
    const originalModel = env.GROQ_MODEL;
    const originalFetch = globalThis.fetch;
    env.GROQ_API_KEY = 'test-groq-key';
    env.GROQ_MODEL = 'test-model';
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
      assert.equal(options.headers.Authorization, 'Bearer test-groq-key');
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'test-model');
      assert.equal(body.messages[0].role, 'system');
      assert.match(body.messages[0].content, /any academic or practical topic/);
      assert.match(body.messages[0].content, /Current page category: course details page/);
      assert.match(body.messages[0].content, /payment instructions/);
      assert.deepEqual(body.messages[1], { role: 'user', content: 'What does a div do?' });
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'A div groups content.' } }] }) };
    };

    try {
      assert.equal(await getAssistantReply([{ role: 'user', content: 'What does a div do?' }], 'course_details'), 'A div groups content.');
    } finally {
      env.GROQ_API_KEY = originalKey;
      env.GROQ_MODEL = originalModel;
      globalThis.fetch = originalFetch;
    }
  });

  it('returns a clear unavailable error when no API key is configured', async () => {
    const originalKey = env.GROQ_API_KEY;
    env.GROQ_API_KEY = '';
    try {
      await assert.rejects(getAssistantReply([]), (error) => error.status === 503 && /GROQ_API_KEY/.test(error.message));
    } finally {
      env.GROQ_API_KEY = originalKey;
    }
  });

  it('does not expose provider error details to callers', async () => {
    const originalKey = env.GROQ_API_KEY;
    const originalFetch = globalThis.fetch;
    env.GROQ_API_KEY = 'test-groq-key';
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'invalid_api_key', message: 'Invalid key.' } }),
    });

    try {
      await assert.rejects(getAssistantReply([]), (error) => error.status === 503 && !/401|test-groq-key/.test(error.message));
    } finally {
      env.GROQ_API_KEY = originalKey;
      globalThis.fetch = originalFetch;
    }
  });
});
