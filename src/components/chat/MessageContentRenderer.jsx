import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// http/https/mailto 프로토콜만 허용. 그 외(javascript:, data: 등)는 null 반환.
// new URL()이 throw하면 상대경로 또는 잘못된 URL → 마찬가지로 null.
function sanitizeHref(href) {
  if (!href) return null;
  try {
    const { protocol } = new URL(href);
    return ["http:", "https:", "mailto:"].includes(protocol) ? href : null;
  } catch {
    return null;
  }
}

// fenced code block 전용 컴포넌트 — 언어 라벨 + copy 버튼 + syntax highlight
function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-1.5 rounded overflow-hidden text-xs border border-white/10">
      {/* header: 언어 라벨 + copy 버튼 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#21252b] select-none">
        <span className="font-mono text-neutral-400">{language || "text"}</span>
        <button
          onClick={handleCopy}
          className="text-neutral-400 hover:text-white text-xs transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {/* syntax highlight — PreTag="div"으로 pre 중첩 방지 */}
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: 0, fontSize: "0.75rem", overflowX: "auto" }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// 모듈 수준 정의 — 렌더마다 재생성하지 않는다.
const markdownComponents = {
  p:          ({ node, children })       => <p className="mb-1 last:mb-0">{children}</p>,
  h1:         ({ node, children })       => <h1 className="text-base font-bold mt-2 mb-1 first:mt-0">{children}</h1>,
  h2:         ({ node, children })       => <h2 className="text-sm font-bold mt-1 mb-1 first:mt-0">{children}</h2>,
  h3:         ({ node, children })       => <h3 className="text-sm font-semibold mt-1 mb-0.5 first:mt-0">{children}</h3>,
  h4:         ({ node, children })       => <h4 className="text-sm font-semibold mb-0.5">{children}</h4>,
  h5:         ({ node, children })       => <h5 className="text-xs font-semibold mb-0.5">{children}</h5>,
  h6:         ({ node, children })       => <h6 className="text-xs font-medium mb-0.5">{children}</h6>,
  a: ({ node, href, children }) => {
    const safe = sanitizeHref(href);
    return safe ? (
      <a href={safe} target="_blank" rel="noopener noreferrer"
         className="underline opacity-80 hover:opacity-100 break-all">
        {children}
      </a>
    ) : (
      <span className="text-neutral-400 cursor-not-allowed no-underline break-all"
            title="안전하지 않은 링크">
        {children}
      </span>
    );
  },
  // pre가 fenced code block을 완전히 인터셉트한다.
  // code는 inline code 스타일만 담당하고, fenced block은 pass-through로 pre에 위임한다.
  code: ({ node, className, children, ...props }) => {
    if (/language-/.test(className || "")) {
      return <code className={className} {...props}>{children}</code>;
    }
    return (
      <code className="bg-black/20 rounded px-1 py-0.5 font-mono text-xs" {...props}>
        {children}
      </code>
    );
  },
  // pre가 자식이 code 요소이면 CodeBlock으로 대체한다.
  // 언어 없는 code block도 CodeBlock으로 렌더링한다.
  pre: ({ node, children }) => {
    const child = Array.isArray(children) ? children[0] : children;
    if (child && typeof child === "object" && child.type === "code") {
      const { className = "", children: code } = child.props;
      const match = /language-(\w+)/.exec(className);
      return (
        <CodeBlock
          language={match ? match[1] : ""}
          code={String(code ?? "").trimEnd()}
        />
      );
    }
    // code 자식이 아닌 경우 — fallback plain pre
    return (
      <pre className="bg-black/25 rounded p-2 overflow-x-auto font-mono text-xs my-1 whitespace-pre">
        {children}
      </pre>
    );
  },
  blockquote: ({ node, children })       => (
    <blockquote className="border-l-2 border-current/50 pl-2 my-1 opacity-80">
      {children}
    </blockquote>
  ),
  ul:         ({ node, children })       => <ul className="list-disc pl-4 my-1">{children}</ul>,
  ol:         ({ node, children })       => <ol className="list-decimal pl-4 my-1">{children}</ol>,
  li:         ({ node, children })       => <li className="mb-0.5">{children}</li>,
  strong:     ({ node, children })       => <strong className="font-bold">{children}</strong>,
  em:         ({ node, children })       => <em className="italic">{children}</em>,
  hr:         ({ node })                 => <hr className="border-current/20 my-2" />,
  table:      ({ node, children })       => (
    <div className="overflow-x-auto my-1">
      <table className="border-collapse text-xs">{children}</table>
    </div>
  ),
  th:         ({ node, children })       => (
    <th className="border border-current/30 px-2 py-0.5 font-bold text-left">{children}</th>
  ),
  td:         ({ node, children })       => (
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
