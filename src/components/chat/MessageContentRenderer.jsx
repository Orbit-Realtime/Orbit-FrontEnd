import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 모듈 수준 정의 — 렌더마다 재생성하지 않는다.
const markdownComponents = {
  p:          ({ node, children })            => <p className="mb-1 last:mb-0">{children}</p>,
  h1:         ({ node, children })            => <h1 className="text-base font-bold mt-2 mb-1 first:mt-0">{children}</h1>,
  h2:         ({ node, children })            => <h2 className="text-sm font-bold mt-1 mb-1 first:mt-0">{children}</h2>,
  h3:         ({ node, children })            => <h3 className="text-sm font-semibold mt-1 mb-0.5 first:mt-0">{children}</h3>,
  h4:         ({ node, children })            => <h4 className="text-sm font-semibold mb-0.5">{children}</h4>,
  h5:         ({ node, children })            => <h5 className="text-xs font-semibold mb-0.5">{children}</h5>,
  h6:         ({ node, children })            => <h6 className="text-xs font-medium mb-0.5">{children}</h6>,
  a:          ({ node, href, children })      => (
    <a href={href} target="_blank" rel="noopener noreferrer"
       className="underline opacity-80 hover:opacity-100 break-all">
      {children}
    </a>
  ),
  // className="language-*" 여부로 코드 블록 / 인라인 코드를 구분한다.
  code:       ({ node, className, children, ...props }) => {
    const isBlock = /language-/.test(className || "");
    if (isBlock) {
      return <code className={className} {...props}>{children}</code>;
    }
    return (
      <code className="bg-black/20 rounded px-1 py-0.5 font-mono text-xs" {...props}>
        {children}
      </code>
    );
  },
  // pre는 외부 whitespace-pre-wrap을 whitespace-pre로 재정의해 코드 줄바꿈을 막는다.
  pre:        ({ node, children })            => (
    <pre className="bg-black/25 rounded p-2 overflow-x-auto font-mono text-xs my-1 whitespace-pre">
      {children}
    </pre>
  ),
  blockquote: ({ node, children })            => (
    <blockquote className="border-l-2 border-current/50 pl-2 my-1 opacity-80">
      {children}
    </blockquote>
  ),
  ul:         ({ node, children })            => <ul className="list-disc pl-4 my-1">{children}</ul>,
  ol:         ({ node, children })            => <ol className="list-decimal pl-4 my-1">{children}</ol>,
  li:         ({ node, children })            => <li className="mb-0.5">{children}</li>,
  strong:     ({ node, children })            => <strong className="font-bold">{children}</strong>,
  em:         ({ node, children })            => <em className="italic">{children}</em>,
  hr:         ({ node })                      => <hr className="border-current/20 my-2" />,
  table:      ({ node, children })            => (
    <div className="overflow-x-auto my-1">
      <table className="border-collapse text-xs">{children}</table>
    </div>
  ),
  th:         ({ node, children })            => (
    <th className="border border-current/30 px-2 py-0.5 font-bold text-left">{children}</th>
  ),
  td:         ({ node, children })            => (
    <td className="border border-current/30 px-2 py-0.5">{children}</td>
  ),
};

export default function MessageContentRenderer({ content, className = "" }) {
  return (
    <div className={`whitespace-pre-wrap break-words${className ? ` ${className}` : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
