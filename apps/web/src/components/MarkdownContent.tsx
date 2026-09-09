"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-3 last:mb-0 whitespace-pre-wrap">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-[var(--ink)]">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  a: ({
    href,
    children,
  }: {
    href?: string;
    children?: React.ReactNode;
  }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="cursor-pointer text-[var(--link)] underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-[var(--leading-body)]">{children}</li>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1>{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3>{children}</h3>
  ),
  code: ({
    className,
    children,
  }: {
    className?: string;
    children?: React.ReactNode;
  }) => {
    const inline = !className;
    if (inline) {
      return (
        <code className="rounded bg-black/35 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[0.85em]">
          {children}
        </code>
      );
    }
    return (
      <code className="font-[family-name:var(--font-mono)] text-[0.85em] leading-relaxed">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="mb-3 overflow-x-auto rounded-xl bg-black/40 px-3 py-2.5 last:mb-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="mb-3 border-l-2 border-[var(--line)] pl-3 text-[var(--ink-soft)] last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-[var(--line)]" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-3 overflow-x-auto last:mb-0">
      <table className="type-ui w-full min-w-[16rem] border-collapse text-left">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="border-b border-[var(--line)] text-[var(--ink-soft)]">
      {children}
    </thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody>{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="border-b border-[var(--line-soft)] last:border-0">
      {children}
    </tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-2 font-medium first:pl-0 last:pr-0">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="type-data px-3 py-2 !text-[length:var(--text-ui)] first:pl-0 last:pr-0">
      {children}
    </td>
  ),
};

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
