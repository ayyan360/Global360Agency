import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';

const GREETING = {
  role: 'assistant',
  content: "Hi! I'm your learning assistant. Ask me to explain a topic, walk through an example, or help you understand a tricky concept.",
};

export function AssistantWidget() {
  const { user, status } = useAuth();
  if (status !== 'ready' || !user) return null;
  return <AssistantChat key={user.id} />;
}

function AssistantChat() {
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
    event?.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setSending(true);

    try {
      const response = await api.post('/ai-assistant/chat', {
        messages: nextMessages.filter((message) => message.role !== 'assistant' || message !== GREETING).slice(-10),
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
          className="mb-3 flex h-[min(34rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-pop)]"
        >
          <header className="flex items-center gap-3 bg-primary px-4 py-3.5 text-white">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-white">Learning assistant</h2>
              <p className="text-xs text-white/80">Here to help you understand</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-white/90 hover:bg-white/15" aria-label="Close learning assistant">
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-page/60 p-4" aria-live="polite" aria-relevant="additions text">
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <p className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${message.role === 'user' ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md border border-line bg-white text-ink'}`}>
                  {message.content}
                </p>
              </div>
            ))}
            {sending && (
              <p role="status" className="w-fit rounded-2xl rounded-bl-md border border-line bg-white px-3.5 py-2.5 text-sm text-muted">
                Thinking…
              </p>
            )}
            {error && <p role="alert" className="rounded-xl bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="border-t border-line bg-white p-3">
            <label htmlFor="assistant-message" className="sr-only">Ask a learning question</label>
            <div className="flex items-end gap-2">
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
                placeholder="Ask about a topic…"
                disabled={sending}
                className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-line px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15 disabled:bg-page"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="size-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[11px] text-muted">Enter to send · Shift+Enter for a new line</p>
            <p className="mt-1 px-1 text-[11px] text-muted">AI responses may be inaccurate. Questions are processed by Groq.</p>
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
