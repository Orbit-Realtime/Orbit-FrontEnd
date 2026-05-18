import { useState, memo } from "react";
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

const REMARK_PLUGINS = [remarkGfm];
const COLLAPSE_LINE_THRESHOLD = 25;
const COLLAPSE_CHAR_THRESHOLD = 1200;
const COLLAPSED_MAX_HEIGHT = "320px";

// fenced code block 전용 컴포넌트 — 언어 라벨 + copy 버튼 + syntax highlight
function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const lineCount = code.split("\n").length;
  const charCount = code.length;
  const isLong = lineCount > COLLAPSE_LINE_THRESHOLD || charCount > COLLAPSE_CHAR_THRESHOLD;
  const [collapsed, setCollapsed] = useState(isLong);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-1.5 rounded overflow-hidden text-xs border border-orbit-border">
      {/* header: 언어 라벨 + copy 버튼 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#21252b] select-none">
        <span className="font-mono text-orbit-muted">{language || "text"}</span>
        <button
          onClick={handleCopy}
          className="text-orbit-muted hover:text-white text-xs transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {/* 코드 영역 래퍼 — collapsed 시 max-height + overflow-hidden */}
      <div
        className={`relative ${collapsed ? "overflow-hidden" : "overflow-visible"}`}
        style={{ maxHeight: collapsed ? COLLAPSED_MAX_HEIGHT : "none" }}
      >
        {/* SyntaxHighlighter는 항상 렌더 — 펼칠 때 Prism 재파싱 없음 */}
        <SyntaxHighlighter
          language={language || "text"}
          style={oneDark}
          PreTag="div"
          customStyle={{ margin: 0, borderRadius: 0, fontSize: "0.75rem", overflowX: "auto", whiteSpace: "pre", wordBreak: "normal", overflowWrap: "normal" }}
        >
          {code}
        </SyntaxHighlighter>
        {/* fade overlay — collapsed 상태에서만 표시 */}
        {collapsed && (
          <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-[#282c34] to-transparent pointer-events-none" />
        )}
      </div>
      {/* 토글 버튼 — 긴 코드블럭에만 표시 */}
      {isLong && (
        <div className="flex justify-center py-1 bg-[#21252b] border-t border-orbit-border select-none">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-orbit-muted hover:text-white text-xs transition-colors"
          >
            {collapsed
              ? lineCount > COLLAPSE_LINE_THRESHOLD
                ? `▾ 펼치기 (${lineCount}줄)`
                : `▾ 펼치기 (${charCount}자)`
              : "▴ 접기"}
          </button>
        </div>
      )}
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
      <span className="text-orbit-muted cursor-not-allowed no-underline break-all"
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
      <code className="bg-white/[0.08] border border-white/[0.12] rounded px-1 py-0.5 font-mono text-xs" {...props}>
        {children}
      </code>
    );
  },
  // pre가 자식이 code 요소이면 CodeBlock으로 대체한다.
  // 언어 없는 code block도 CodeBlock으로 렌더링한다.
  pre: ({ node, children }) => {
    const child = Array.isArray(children) ? children[0] : children;
    if (child && typeof child === "object" && node?.children?.[0]?.tagName === "code") {
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

function MessageContentRenderer({ content, className = "" }) {
  return (
    <div className={`whitespace-pre-wrap break-words${className ? ` ${className}` : ""}`}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MessageContentRenderer);
