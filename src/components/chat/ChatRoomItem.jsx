import { formatRoomTime } from "../../utils/formatTime";

export default function ChatRoomItem({ room, isSelected, onClick }) {
  const { title, lastMessage, unreadMessageCount, createdDate } = room;

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
        ${isSelected ? "bg-neutral-700" : "hover:bg-neutral-800"}`}
    >
      {/* 아바타 */}
      <div className="w-12 h-12 rounded-full bg-neutral-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-lg select-none">
        {title?.charAt(0) ?? "?"}
      </div>

      {/* 텍스트 영역 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-white font-medium truncate">{title}</span>
          <span className="text-neutral-500 text-xs flex-shrink-0">
            {formatRoomTime(createdDate)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-neutral-400 text-sm truncate">
            {lastMessage ?? "메시지 없음"}
          </span>
          {unreadMessageCount > 0 && (
            <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-blue-500 rounded-full text-white text-xs font-bold flex items-center justify-center">
              {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
