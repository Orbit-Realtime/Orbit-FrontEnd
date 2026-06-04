import UserHeader from "./UserHeader";
import SpaceList from "./SpaceList";

export default function ChatSidebar({
  connected,
  spaces,
  spacesError,
  onRetrySpaces,
  selectedSpaceId,
  onSelectSpace,
  onCreateSpace,
}) {
  return (
    <div className="flex flex-col w-64 border-r border-orbit-border bg-orbit-sidebar orbit-sidebar-bg flex-shrink-0 relative z-10">

      {/* 사용자 헤더 */}
      <UserHeader connected={connected} />

      {/* Space 목록 */}
      <div className="flex-1 overflow-hidden">
        <SpaceList
          spaces={spaces}
          spacesError={spacesError}
          onRetry={onRetrySpaces}
          selectedSpaceId={selectedSpaceId}
          onSelectSpace={onSelectSpace}
        />
      </div>

      {/* New Space 버튼 */}
      <div className="flex-shrink-0 border-t border-orbit-border px-4 py-4">
        <button
          onClick={onCreateSpace}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-orbit-border bg-orbit-surface2 hover:bg-orbit-elevated text-sm text-orbit-secondary hover:text-orbit-text transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          New Space
        </button>
      </div>
    </div>
  );
}
