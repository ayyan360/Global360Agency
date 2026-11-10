import { ok } from '../utils/http.js';
import { getAssistantReply } from '../services/aiAssistantService.js';

export async function chat(req, res) {
  ok(res, { reply: await getAssistantReply(req.valid.body.messages) });
}
