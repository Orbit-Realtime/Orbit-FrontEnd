import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { changeNickname } from "../../api/memberApi";
import ChangePasswordModal from "./ChangePasswordModal";

export default function UserHeader({ connected }) {
  const navigate = useNavigate();
  const { auth, signout, updateNickname } = useAuth();

  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [editNickname, setEditNickname] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const nicknameInputRef = useRef(null);

  const startEditNickname = () => {
    setEditNickname(auth?.nickname ?? "");
    setIsEditingNickname(true);
    setTimeout(() => nicknameInputRef.current?.focus(), 0);
  };

  const commitNickname = async () => {
    setIsEditingNickname(false);
    const trimmed = editNickname.trim();
    if (!trimmed || trimmed === auth?.nickname) return;
    try {
      await changeNickname(trimmed);
      updateNickname(trimmed);
    } catch (e) {
      // ignore
    }
  };

  const handleNicknameKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); commitNickname(); }
    if (e.key === "Escape") { setIsEditingNickname(false); }
  };

  const handleSignout = () => {
    signout();
    navigate("/", { replace: true });
  };

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-700 flex-shrink-0">
        <div className="flex-1 min-w-0">
          {isEditingNickname ? (
            <input
              ref={nicknameInputRef}
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value)}
              onBlur={commitNickname}
              onKeyDown={handleNicknameKeyDown}
              className="w-full bg-neutral-700 text-white text-sm font-bold px-2 py-0.5 rounded outline-none border border-neutral-500"
            />
          ) : (
            <button
              onClick={startEditNickname}
              className="font-bold text-white hover:text-neutral-300 transition-colors text-left truncate w-full"
              title="클릭하여 닉네임 변경"
            >
              {auth?.nickname}
            </button>
          )}
          <p className="text-xs text-neutral-500 mt-0.5">
            {connected ? "🟢 온라인" : "🔴 오프라인"}
          </p>
        </div>
        <button
          onClick={() => setShowPasswordModal(true)}
          title="비밀번호 변경"
          className="flex-shrink-0 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
          </svg>
        </button>
        <button
          onClick={handleSignout}
          title="로그아웃"
          className="flex-shrink-0 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
          </svg>
        </button>
      </div>

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </>
  );
}
