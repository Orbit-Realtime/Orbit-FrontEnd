export default function WsErrorBanner({ wsError, onDismiss }) {
  if (!wsError) return null;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 px-4 text-xs font-medium flex-shrink-0 bg-orange-500/20 text-orange-400">
      <span>{wsError}</span>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 hover:text-white transition-colors"
        aria-label="에러 메시지 닫기"
      >
        ✕
      </button>
    </div>
  );
}
