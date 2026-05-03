import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMembers } from "../../api/memberApi";
import { createChatRoom } from "../../api/chatRoomApi";

export default function MemberList({ onRoomCreated }) {
  const { auth } = useAuth();
  const [members, setMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [membersError, setMembersError] = useState(false);

  const loadMembers = useCallback(() => {
    setMembersError(false);
    getMembers()
      .then((result) => {
        const others = (result.data ?? []).filter(
          (m) => m.memberId !== auth?.memberId
        );
        setMembers(others);
      })
      .catch(() => setMembersError(true));
  }, [auth?.memberId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

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
      const title = members
        .filter((m) => selectedIds.has(m.memberId))
        .map((m) => m.nickname)
        .join(", ");
      await createChatRoom(receiverIds, title);
      setSelectedIds(new Set());
      onRoomCreated();
    } catch (e) {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  if (membersError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-neutral-500 text-sm">멤버 목록을 불러오지 못했습니다.</p>
        <button
          onClick={loadMembers}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {members.map((member) => {
          const selected = selectedIds.has(member.memberId);
          return (
            <button
              key={member.memberId}
              onClick={() => toggleSelect(member.memberId)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-700 transition-colors text-left ${
                selected ? "bg-neutral-700/60" : ""
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-neutral-600 flex items-center justify-center flex-shrink-0 text-sm font-medium text-white">
                {member.nickname[0].toUpperCase()}
              </div>
              <span className="text-sm text-white flex-1">{member.nickname}</span>
              {selected && (
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex-shrink-0 px-4 py-3 border-t border-neutral-700">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:bg-neutral-600 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-colors"
          >
            {creating ? "생성 중..." : `채팅 시작 (${selectedIds.size}명)`}
          </button>
        </div>
      )}
    </div>
  );
}
