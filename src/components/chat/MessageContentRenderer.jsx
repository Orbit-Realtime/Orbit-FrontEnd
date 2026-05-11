export default function MessageContentRenderer({ content, className = "" }) {
  return (
    <div className={`whitespace-pre-wrap break-words${className ? ` ${className}` : ""}`}>
      {content}
    </div>
  );
}
