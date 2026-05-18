import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { getSpaceMembers, inviteMembers } from "../../api/spaceApi";
import { getMembers } from "../../api/memberApi";

export default function MemberPanel({ spaceId, onClose }) {
  const { auth } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [invitableMembers, setInvitableMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [inviting, setInviting] = useState(false);

  const loadMembers = useCallback(() => {
    setLoading(true);
    getSpaceMembers(spaceId)
      .then((r) => setMembers(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [spaceId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const openInvite = async () => {
    try {
      const r = await getMembers();
      const roomMemberIds = new Set(members.map((m) => m.memberId));
      const invitable = (r.data ?? []).filter(
        (m) => !roomMemberIds.has(m.memberId) && m.memberId !== auth?.memberId
      );
      setInvitableMembers(invitable);
      setSelectedIds(new Set());
      setShowInvite(true);
    } catch (e) {
      // ignore
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleInvite = async () => {
    if (selectedIds.size === 0 || inviting) return;
    setInviting(true);
    try {
      await inviteMembers(spaceId, [...selectedIds]);
      setShowInvite(false);
      setSelectedIds(new Set());
      loadMembers();
    } catch (e) {
      // ignore
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="w-60 border-l border-orbit-border flex flex-col flex-shrink-0 bg-orbit-sidebar orbit-panel-bg">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-orbit-border">
        <span className="text-sm font-medium text-white">
          {showInvite ? "멤버 초대" : `멤버 ${members.length}명`}
        </span>
        <button
          onClick={showInvite ? () => setShowInvite(false) : onClose}
          className="text-orbit-muted hover:text-white transition-colors"
        >
          {showInvite ? (
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
            </svg>
          )}
        </button>
      </div>

      {/* 콘텐츠 */}
      {showInvite ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {invitableMembers.length === 0 ? (
              <p className="text-orbit-subtle text-sm text-center py-8">
                초대할 수 있는 멤버가 없습니다.
              </p>
            ) : (
              invitableMembers.map((member) => {
                const selected = selectedIds.has(member.memberId);
                return (
                  <button
                    key={member.memberId}
                    onClick={() => toggleSelect(member.memberId)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-orbit-surface2 transition-colors text-left ${
                      selected ? "bg-orbit-surface2/60" : ""
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-orbit-elevated flex items-center justify-center flex-shrink-0 text-xs font-medium text-white">
                      {member.nickname[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-white flex-1 truncate">{member.nickname}</span>
                    {selected && (
                      <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
          {selectedIds.size > 0 && (
            <div className="flex-shrink-0 px-4 py-3 border-t border-orbit-border">
              <button
                onClick={handleInvite}
                disabled={inviting}
                className="w-full py-2 bg-blue-500 hover:bg-blue-400 disabled:bg-orbit-surface2 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-colors"
              >
                {inviting ? "초대 중..." : `초대 (${selectedIds.size}명)`}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              members.map((member) => (
                <div
                  key={member.memberId}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="w-8 h-8 rounded-full bg-orbit-elevated flex items-center justify-center flex-shrink-0 text-xs font-medium text-white">
                    {member.nickname[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-white flex-1 truncate">{member.nickname}</span>
                  {member.memberId === auth?.memberId && (
                    <span className="text-xs text-orbit-subtle flex-shrink-0">나</span>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="flex-shrink-0 px-4 py-3 border-t border-orbit-border">
            <button
              onClick={openInvite}
              className="w-full py-2 bg-orbit-surface2 hover:bg-orbit-elevated rounded-xl text-sm text-white transition-colors flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              멤버 초대
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
