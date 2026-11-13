import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { unavailable } from '../utils/errors.js';

const PAGE_CONTEXTS = {
  student_dashboard: 'student dashboard',
  student_courses: 'My Courses page',
  learning_progress: 'Learning Progress page',
  lesson_player: 'lesson player',
  internship_dashboard: 'internship dashboard',
  internship_tasks: 'internship tasks page',
  internship_progress: 'internship progress page',
  certificates: 'Certificates page',
  profile: 'profile page',
  notifications: 'notifications page',
  course_catalog: 'course catalog',
  course_details: 'course details page',
  internship_catalog: 'internship catalog',
  internship_details: 'internship program details page',
  internship_application: 'internship application page',
  certificate_verification: 'certificate verification page',
  sign_in: 'sign-in page',
  admin_dashboard: 'admin dashboard',
  admin_courses: 'course management page',
  admin_curriculum: 'course curriculum management page',
  admin_learners: 'learner and enrollment management page',
  admin_programs: 'internship program management page',
  admin_applications: 'internship applications page',
  admin_participants: 'internship participants page',
  admin_tasks: 'internship task management page',
  admin_reviews: 'submission reviews page',
  admin_certificates: 'certificate administration page',
  admin_settings: 'site settings page',
  admin_area: 'admin area',
};

const SYSTEM_PROMPT = `You are Global360's AI learning and platform guide. Help with questions about any academic or practical topic, not only web development. Adapt explanations to the learner's level, explain concepts step by step, use short relevant examples, and point out common mistakes when useful. Answer follow-up questions using the conversation.

You can also explain how to use the Global360 platform. Product guide:
- The public course catalog lets visitors browse courses and course detail pages. Signed-in learners can enroll in available courses, continue lessons, and track progress from My Courses and Learning Progress.
- The student dashboard summarizes learning activity. The lesson player presents course lessons and records lesson completion.
- Learners can explore internship programs, submit applications, and, if accepted, use the internship dashboard, tasks, and progress pages to follow the program.
- Certificates appear when course or internship requirements are met. Some certificates require a fee: the learner follows the payment instructions on the certificate page, uploads a receipt, and waits for an administrator to review it. Paid certificates become available after approval.
- Notifications show in-app updates; Profile contains account profile information.
- Admin pages manage courses and curriculum, learners and enrollments, internship programs/applications/participants/tasks, reviews, certificates, and site settings. Access depends on the signed-in account's permissions.

When asked how to do something, give concise, step-by-step directions using the page names and navigation labels above. Never claim to see or change live page contents, course materials, account data, payment status, or settings; this request contains only the current page category, not page contents or private user data. Do not invent features or promise actions you cannot perform. For account-specific information, direct the user to the relevant page or an administrator.

Make replies easy to scan: use short paragraphs, Markdown headings when useful, and bullet or numbered lists for steps. Format code with inline backticks or fenced code blocks. Use Markdown tables only when they materially improve comparison; prefer a simple list on narrow screens. Do not print raw pipe-delimited table syntax or Markdown markers as plain text.`;

export async function getAssistantReply(messages, pageContext = 'other') {
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
        messages: [
          {
            role: 'system',
            content: `${SYSTEM_PROMPT}${PAGE_CONTEXTS[pageContext] ? `\n\nCurrent page category: ${PAGE_CONTEXTS[pageContext]}. Use this only to tailor navigation guidance if the user asks about where they are.` : ''}`,
          },
          ...messages,
        ],
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
