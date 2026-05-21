import { useState, useEffect } from "react";
import { createSpace } from "../../api/spaceApi";

export default function CreateSpaceModal({ onCreated, onClose }) {
  const [spaceName, setSpaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      const result = await createSpace(spaceName.trim());
      const createdSpaceId = result?.data?.chatRoomId ?? null;
      onCreated(createdSpaceId);
    } catch (e) {
      const message = e.response?.data?.message;
      setError(message || "Space 생성 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); handleCreate(); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-orbit-elevated rounded-2xl w-96 flex flex-col shadow-xl">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-orbit-border flex-shrink-0">
          <span className="font-semibold text-orbit-text">New Space</span>
          <button
            onClick={onClose}
            className="text-orbit-muted hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-6 flex flex-col gap-4">
          <input
            autoFocus
            value={spaceName}
            onChange={(e) => { setSpaceName(e.target.value); setError(""); }}
            onKeyDown={handleKeyDown}
            placeholder="Space name"
            className="w-full bg-orbit-surface2 text-orbit-text text-sm px-3 py-2.5 rounded-xl outline-none placeholder-orbit-subtle border border-orbit-border focus:border-orbit-border-strong transition-colors"
          />

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full py-2.5 bg-orbit-cyan hover:bg-orbit-cyan/80 disabled:bg-orbit-surface2 disabled:text-orbit-muted disabled:cursor-not-allowed rounded-xl text-sm font-medium text-orbit-bg transition-colors"
          >
            {creating ? "생성 중..." : "Create Space"}
          </button>
        </div>

      </div>
    </div>
  );
}
