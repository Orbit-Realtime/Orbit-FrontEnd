import { memo } from "react";
import { formatMessageTime } from "../../utils/formatTime";
import MessageContentRenderer from "./MessageContentRenderer";

function MessageItem({ message, isMine, hideNickname }) {
  const { senderNickname, message: text, unreadMemberCount, createdDate } = message;

  const timeStr = formatMessageTime(createdDate);

  if (isMine) {
    return (
      <div className="flex justify-end items-end gap-1.5">
        <div className="flex flex-col items-end flex-shrink-0 mb-0.5 gap-0.5">
          {unreadMemberCount > 0 && (
            <span className="text-orbit-cyan text-xs font-medium leading-none">
              {unreadMemberCount}
            </span>
          )}
          <span className="text-orbit-muted text-xs leading-none">{timeStr}</span>
        </div>
        <div className="max-w-[84%] bg-orbit-surface2 rounded-xl border border-orbit-border shadow-card-orbit overflow-hidden px-3 py-2 text-orbit-text text-sm">
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