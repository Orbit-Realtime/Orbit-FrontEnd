import { memo } from "react";
import { formatMessageTime } from "../../utils/formatTime";
import MessageContentRenderer from "./MessageContentRenderer";
import MessagePendingIndicator from "./MessagePendingIndicator";

function MessageItem({ message, isMine, hideNickname, onRemoveFailedMessage, onRetryMessage, canRetry }) {
  const { senderNickname, message: text, unreadMemberCount, createdDate, status, retryable } = message;

  const timeStr = formatMessageTime(createdDate);
  const isSending = status === "sending";
  const isFailed = status === "failed";
  // retryable이 명시적으로 false인 경우만 재시도를 막는다 (timeout으로 인한 failed는 retryable 필드가 없어 재시도 가능 유지)
  const canRetryThisMessage = canRetry && retryable !== false;

  if (isMine) {
    return (
      <div className="flex justify-end items-end gap-1.5">
        <div className="flex flex-col items-end flex-shrink-0 mb-0.5 gap-0.5">
          {unreadMemberCount > 0 && (
            <span className="text-orbit-cyan text-xs font-medium leading-none">
              {unreadMemberCount}
            </span>
          )}
          <span className={`text-xs leading-none ${isFailed ? "text-red-400" : "text-orbit-muted"}`}>
            {isSending ? <MessagePendingIndicator /> : isFailed ? "전송 실패" : timeStr}
          </span>
          {isFailed && onRetryMessage && (
            <button
              onClick={() => onRetryMessage(message.clientMessageId)}
              disabled={!canRetryThisMessage}
              title={
                retryable === false
                  ? "재시도할 수 없는 오류입니다."
                  : !canRetry
                  ? "연결이 준비되면 재시도할 수 있습니다."
                  : undefined
              }
              className="text-orbit-cyan/70 hover:text-orbit-cyan text-xs leading-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-orbit-cyan/70"
              aria-label="재시도"
            >
              재시도
            </button>
          )}
          {isFailed && onRemoveFailedMessage && (
            <button
              onClick={() => onRemoveFailedMessage(message.clientMessageId)}
              className="text-red-400/70 hover:text-red-400 text-xs leading-none"
              aria-label="삭제"
            >
              삭제
            </button>
          )}
        </div>
        <div
          className={`max-w-[84%] bg-orbit-surface2 rounded-xl border shadow-card-orbit overflow-hidden px-3 py-2 text-orbit-text text-sm ${
            isFailed ? "border-red-400/50" : "border-orbit-border"
          } ${isSending ? "opacity-60" : ""}`}
        >
          <MessageContentRenderer content={text} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start">
      {!hideNickname && (
        <span className="text-xs text-orbit-secondary mb-1 ml-1">{senderNickname}</span>
      )}
      <div className="flex items-end gap-1.5">
        <div className="max-w-[84%] bg-orbit-surface rounded-xl border border-orbit-border shadow-card-orbit overflow-hidden px-3 py-2 text-orbit-text text-sm">
          <MessageContentRenderer content={text} />
        </div>
        <div className="flex flex-col items-start flex-shrink-0 mb-0.5 gap-0.5">
          {unreadMemberCount > 0 && (
            <span className="text-orbit-cyan text-xs font-medium leading-none">
              {unreadMemberCount}
            </span>
          )}
          <span className="text-orbit-muted text-xs leading-none">{timeStr}</span>
        </div>
      </div>
    </div>
  );
}

export default memo(MessageItem);