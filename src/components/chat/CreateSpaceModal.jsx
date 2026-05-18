import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMembers } from "../../api/memberApi";
import { createSpace } from "../../api/spaceApi";

export default function CreateSpaceModal({ onCreated, onClose }) {
  const { auth } = useAuth();
  const [spaceName, setSpaceName] = useState("");
  const [members, setMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [membersError, setMembersError] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadMembers = useCallback(() => {
    setMembersError(false);
    setLoading(true);
    getMembers()
      .then((result) => {
        const others = (result.data ?? []).filter(
          (m) => m.memberId !== auth?.memberId
        );
        setMembers(others);
      })
      .catch(() => setMembersError(true))
      .finally(() => setLoading(false));
  }, [auth?.memberId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const toggleSelect = (memberId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const handleCreate = async () => {
    if (selectedIds.size === 0 || creating) return;
    setCreating(true);
    try {
      const receiverIds = [...selectedIds];
      const effectiveTitle =
        spaceName.trim() ||
        members
          .filter((m) => selectedIds.has(m.memberId))
          .map((m) => m.nickname)
          .join(", ");
      const result = await createSpace(receiverIds, effectiveTitle);
      const createdSpaceId = result?.data?.chatRoomId ?? null;
      onCreated(createdSpaceId);
    } catch (e) {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-orbit-elevated rounded-2xl w-96 max-h-[80vh] flex flex-col shadow-xl">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-orbit-border flex-shrink-0">
          <span className="font-semibold text-white">New Space</span>
          <button
            onClick={onClose}
            className="text-orbit-muted hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
            </svg>
          </button>
        </div>

        {/* Space 이름 입력 */}
        <div className="px-6 py-4 border-b border-orbit-border flex-shrink-0">
          <input
            value={spaceName}
            onChange={(e) => setSpaceName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            placeholder="Space name (optional)"
            className="w-full bg-orbit-surface2 text-white text-sm px-3 py-2.5 rounded-xl outline-none placeholder-orbit-subtle border border-orbit-border focus:border-orbit-border-strong transition-colors"
          />
        </div>

        {/* Members 라벨 */}
        <div className="px-6 py-3 flex-shrink-0">
          <span className="text-xs text-orbit-muted font-medium uppercase tracking-wide">
            Add members
          </span>
        </div>

        {/* 멤버 목록 */}
        <div className="flex-1 overflow-y-auto orbit-scrollbar min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-orbit-muted border-t-transparent rounded-full animate-spin" />
            </div>
          ) : membersError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-orbit-subtle text-sm">멤버 목록을 불러오지 못했습니다.</p>
              <button
                onClick={loadMembers}
                className="text-xs text-orbit-cyan hover:text-orbit-text transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : members.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-orbit-subtle text-sm">초대할 수 있는 멤버가 없습니다.</p>
            </div>
          ) : (
            members.map((member) => {
              const selected = selectedIds.has(member.memberId);
              return (
                <button
                  key={member.memberId}
                  onClick={() => toggleSelect(member.memberId)}
                  className={`w-full flex items-center gap-3 px-6 py-3 hover:bg-orbit-surface2 transition-colors text-left ${
                    selected ? "bg-orbit-surface2/60" : ""
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-orbit-surface2 flex items-center justify-center flex-shrink-0 text-sm font-medium text-white select-none">
                    {member.nickname[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-white flex-1 truncate">{member.nickname}</span>
                  {selected && (
                    <div className="w-5 h-5 rounded-full bg-orbit-cyan flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 24 24" className="w-3 h-3 fill-orbit-bg">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* 생성 버튼 */}
        {selectedIds.size > 0 && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-orbit-border">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full py-2.5 bg-orbit-cyan hover:bg-orbit-cyan/80 disabled:bg-orbit-surface2 disabled:text-orbit-muted disabled:cursor-not-allowed rounded-xl text-sm font-medium text-orbit-bg transition-colors"
            >
              {creating ? "생성 중..." : `Create Space (${selectedIds.size}명)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
