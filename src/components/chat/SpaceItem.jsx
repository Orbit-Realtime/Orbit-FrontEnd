import { formatSpaceTime } from "../../utils/formatTime";

export default function SpaceItem({ space, isSelected, onClick }) {
  const { title, lastMessage, unreadMessageCount, createdDate } = space;

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-l-2
        ${isSelected ? "bg-orbit-surface2 border-orbit-cyan" : "border-transparent hover:bg-orbit-surface2"}`}
    >
      {/* 아바타 */}
      <div className="w-12 h-12 rounded-full bg-orbit-elevated flex-shrink-0 flex items-center justify-center text-orbit-cyan font-bold text-lg select-none">
        {title?.charAt(0) ?? "?"}
      </div>

      {/* 텍스트 영역 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-medium truncate ${isSelected ? "text-orbit-text" : "text-orbit-secondary"}`}>{title}</span>
          <span className="text-orbit-muted text-xs flex-shrink-0">
            {formatSpaceTime(createdDate)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-orbit-muted text-sm truncate">
            {lastMessage ?? "메시지 없음"}
          </span>
          {unreadMessageCount > 0 && (
            <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-orbit-cyan rounded-full text-orbit-bg text-xs font-bold flex items-center justify-center">
              {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
