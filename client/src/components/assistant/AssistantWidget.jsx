import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Sparkles, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';
import { AssistantMarkdown } from './AssistantMarkdown.jsx';
import { getAssistantPageContext } from './pageContext.js';

const GREETING = {
  role: 'assistant',
  content: "Hi! I can explain topics, help with your courses, or guide you around Global360. What would you like help with?",
};

export function AssistantWidget() {
  const { user, status } = useAuth();
  if (status !== 'ready' || !user) return null;
  return <AssistantChat key={user.id} />;
}

function AssistantChat() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages, open, sending]);

  async function sendMessage(event) {
    return sendContent(input.trim(), event);
  }

  async function sendContent(content, event) {
    event?.preventDefault();
    if (!content || sending) return;

    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setSending(true);

    try {
      const response = await api.post('/ai-assistant/chat', {
        messages: nextMessages.filter((message) => message.role !== 'assistant' || message !== GREETING).slice(-10),
        pageContext: getAssistantPageContext(pathname),
      });
      setMessages((current) => [...current, { role: 'assistant', content: response.data.data.reply }].slice(-20));
    } catch (requestError) {
      setError(requestError.message || 'Unable to reach the learning assistant. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[70]">
      {open && (
        <section
          aria-label="Learning assistant"
          className="mb-3 flex h-[min(38rem,calc(100dvh-7rem))] w-[min(25rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.4rem] border border-primary-100 bg-white shadow-[var(--shadow-pop)] animate-fade-in"
        >
          <header className="relative flex items-center gap-3 overflow-hidden bg-gradient-to-br from-primary via-primary to-[#4820b8] px-4 py-4 text-white">
            <span className="absolute -right-7 -top-10 size-28 rounded-full bg-white/10" aria-hidden="true" />
            <span className="absolute -bottom-12 right-16 size-24 rounded-full bg-white/5" aria-hidden="true" />
            <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/15 shadow-inner">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div className="relative min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-white">AI learning &amp; platform assistant</h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-white/80">
                <span className="size-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
                Learn and navigate Global360
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="relative rounded-xl p-2 text-white/90 transition hover:bg-white/15" aria-label="Close learning assistant">
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>

          <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-primary-50/70 via-page/70 to-white p-4" aria-live="polite" aria-relevant="additions text">
            {messages.map((message, index) => {
              const isUser = message.role === 'user';
              const isGreeting = index === 0 && !isUser;
              return (
                <div key={`${index}-${message.role}`} className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <span className="mb-0.5 grid size-7 shrink-0 place-items-center rounded-xl bg-primary-light text-primary" aria-hidden="true">
                      <Sparkles className="size-3.5" />
                    </span>
                  )}
                  <div className={`max-w-[86%] ${isUser ? 'text-right' : ''}`}>
                    {isGreeting && <p className="mb-1.5 ml-1 text-[10px] font-semibold uppercase tracking-wide text-primary">Your Global360 guide</p>}
                    <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${isUser ? 'whitespace-pre-wrap rounded-br-md bg-gradient-to-br from-primary to-[#5420c5] text-left text-white shadow-sm shadow-primary/20' : 'rounded-bl-md border border-primary-100 bg-white text-ink shadow-[0_3px_12px_-8px_rgba(23,21,43,0.28)]'}`}>
                      {isUser ? message.content : <AssistantMarkdown content={message.content} />}
                    </div>
                  </div>
                </div>
              );
            })}
            {messages.length === 1 && !sending && (
              <div className="ml-9 space-y-2">
                <p className="text-xs font-medium text-muted">Try asking</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Explain a topic I am learning',
                    'How do I track course progress?',
                    'How does certificate approval work?',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendContent(prompt)}
                      className="rounded-full border border-primary-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-primary transition hover:border-primary hover:bg-primary-light focus-visible:outline-primary"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {sending && (
              <div role="status" className="flex items-end gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-primary-light text-primary" aria-hidden="true"><Sparkles className="size-3.5" /></span>
                <p className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-primary-100 bg-white px-3.5 py-2.5 text-sm text-muted shadow-sm">
                  Thinking
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="size-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.2s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.1s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-primary/60" />
                  </span>
                </p>
              </div>
            )}
            {error && <p role="alert" className="ml-9 rounded-xl border border-danger/15 bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="border-t border-line bg-white p-3.5">
            <label htmlFor="assistant-message" className="sr-only">Ask a question about learning or Global360</label>
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-page/60 p-1.5 transition focus-within:border-primary/50 focus-within:ring-3 focus-within:ring-primary/10">
              <textarea
                id="assistant-message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                maxLength={2000}
                rows={2}
                placeholder="Ask a question…"
                disabled={sending}
                className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-ink placeholder:text-muted focus:outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 px-1">
              <p className="text-[10px] text-muted">Enter to send · Shift+Enter for a new line</p>
              <p className="text-[10px] text-muted">AI can make mistakes</p>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-expanded={open}
        aria-label={open ? 'Close learning assistant' : 'Open learning assistant'}
        className="ml-auto flex h-14 items-center gap-2.5 rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-[var(--shadow-pop)] transition hover:bg-primary-hover focus-visible:outline-white"
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Bot className="size-5" aria-hidden="true" />}
        <span>{open ? 'Close assistant' : 'Ask AI'}</span>
      </button>
    </div>
  );
}
