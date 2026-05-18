import { memo } from "react";
import { formatMessageTime } from "../../utils/formatTime";
import MessageContentRenderer from "./MessageContentRenderer";

function DiscussionMessageItem({ dm, isMine }) {
  const time = formatMessageTime(dm.createdDate);

  if (isMine) {
    return (
      <div className="flex justify-end min-w-0 max-w-full">
        <div className="flex flex-col items-end gap-0.5 min-w-0 max-w-full">
          <div className="max-w-[85%] min-w-0 overflow-hidden whitespace-pre-wrap [overflow-wrap:anywhere] bg-blue-600 rounded-xl rounded-tr-sm px-3 py-2 text-white text-sm border border-orbit-border shadow-card-orbit">
            <MessageContentRenderer content={dm.content} />
          </div>
          <span className="text-xs text-orbit-subtle">{time}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-0.5 min-w-0 max-w-full">
      <span className="text-xs font-medium text-orbit-secondary ml-1">{dm.senderNickname}</span>
      <div className="max-w-[85%] min-w-0 overflow-hidden whitespace-pre-wrap [overflow-wrap:anywhere] bg-orbit-surface2 rounded-xl rounded-tl-sm px-3 py-2 text-white text-sm border border-orbit-border shadow-card-orbit">
        <MessageContentRenderer content={dm.content} />
      </div>
      <span className="text-xs text-orbit-subtle ml-1">{time}</span>
    </div>
  );
}

export default memo(DiscussionMessageItem);
