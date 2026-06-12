import { memo } from "react";
import { formatMessageTime } from "../../utils/formatTime";
import MessageContentRenderer from "./MessageContentRenderer";

function MessageItem({ message, isMine, hideNickname, onRemoveFailedMessage }) {
  const { senderNickname, message: text, unreadMemberCount, createdDate, status } = message;

  const timeStr = formatMessageTime(createdDate);
  const isSending = status === "sending";
  const isFailed = status === "failed";

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
            {isSending ? "전송 중..." : isFailed ? "전송 실패" : timeStr}
          </span>
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