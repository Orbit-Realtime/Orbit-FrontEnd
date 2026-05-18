import { useState } from "react";
import { changePassword } from "../../api/memberApi";

export default function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError("모든 항목을 입력해주세요.");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (form.newPassword.length < 4) {
      setError("새 비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(form.currentPassword, form.newPassword);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg ?? "비밀번호 변경에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-orbit-elevated rounded-2xl p-6 w-80 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <p className="text-orbit-text font-medium">비밀번호 변경</p>
          <button
            onClick={onClose}
            className="text-orbit-muted hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-orbit-muted mb-1 block">현재 비밀번호</label>
            <input
              type="password"
              name="currentPassword"
              value={form.currentPassword}
              onChange={handleChange}
              autoComplete="current-password"
              className="w-full bg-orbit-surface2 text-orbit-text text-sm px-3 py-2 rounded-xl outline-none border border-orbit-border focus:border-orbit-border-strong placeholder-orbit-subtle"
              placeholder="현재 비밀번호"
            />
          </div>
          <div>
            <label className="text-xs text-orbit-muted mb-1 block">새 비밀번호</label>
            <input
              type="password"
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              autoComplete="new-password"
              className="w-full bg-orbit-surface2 text-orbit-text text-sm px-3 py-2 rounded-xl outline-none border border-orbit-border focus:border-orbit-border-strong placeholder-orbit-subtle"
              placeholder="새 비밀번호"
            />
          </div>
          <div>
            <label className="text-xs text-orbit-muted mb-1 block">새 비밀번호 확인</label>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              className="w-full bg-orbit-surface2 text-orbit-text text-sm px-3 py-2 rounded-xl outline-none border border-orbit-border focus:border-orbit-border-strong placeholder-orbit-subtle"
              placeholder="새 비밀번호 확인"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 w-full py-2.5 bg-orbit-cyan hover:bg-orbit-cyan/80 disabled:bg-orbit-surface2 disabled:text-orbit-muted disabled:cursor-not-allowed rounded-xl text-sm font-medium text-orbit-bg transition-colors"
          >
            {submitting ? "변경 중..." : "변경"}
          </button>
        </form>
      </div>
    </div>
  );
}
