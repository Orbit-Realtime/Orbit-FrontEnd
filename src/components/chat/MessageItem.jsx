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
            <span className="text-blue-400 text-xs font-medium leading-none">
              {unreadMemberCount}
            </span>
          )}
          <span className="text-neutral-500 text-xs leading-none">{timeStr}</span>
        </div>
        <div className="max-w-[60%] bg-blue-500 rounded-2xl rounded-tr-sm px-3 py-2 text-white text-sm">
          <MessageContentRenderer content={text} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start">
      {!hideNickname && (
        <span className="text-xs text-neutral-400 mb-1 ml-1">{senderNickname}</span>
      )}
      <div className="flex items-end gap-1.5">
        <div className="max-w-[60%] bg-neutral-700 rounded-2xl rounded-tl-sm px-3 py-2 text-white text-sm">
          <MessageContentRenderer content={text} />
        </div>
        <div className="flex flex-col items-start flex-shrink-0 mb-0.5 gap-0.5">
          {unreadMemberCount > 0 && (
            <span className="text-blue-400 text-xs font-medium leading-none">
              {unreadMemberCount}
            </span>
          )}
          <span className="text-neutral-500 text-xs leading-none">{timeStr}</span>
        </div>
      </div>
    </div>
  );
}

export default memo(MessageItem);