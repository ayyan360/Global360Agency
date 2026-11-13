import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components = {
  h1: ({ children }) => <h3 className="mb-2 mt-3 text-base font-bold text-ink first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-3 text-sm font-bold text-ink first:mt-0">{children}</h3>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-sm font-semibold text-ink first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-6 text-ink">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-2 ml-1 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-1 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5 leading-6 marker:text-primary">{children}</li>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-primary-300 pl-3 text-muted">{children}</blockquote>,
  hr: () => <hr className="my-3 border-primary-100" />,
  pre: ({ children }) => <pre className="my-2 max-w-full overflow-x-auto rounded-xl bg-[#17152b] p-3 text-xs leading-5 text-white">{children}</pre>,
  code: ({ className, children }) => (
    <code className={className ? 'font-mono text-[0.92em] text-violet-100' : 'rounded-md bg-primary-50 px-1.5 py-0.5 font-mono text-[0.9em] text-primary'}>
      {children}
    </code>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="font-medium text-primary underline decoration-primary-200 underline-offset-2 hover:text-primary-hover">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-2 max-w-full overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-primary-50 text-ink">{children}</thead>,
  th: ({ children }) => <th className="border-b border-line px-2.5 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-t border-line px-2.5 py-2 align-top text-ink">{children}</td>,
};

export function AssistantMarkdown({ content }) {
  return (
    <div className="assistant-markdown max-w-full break-words text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
