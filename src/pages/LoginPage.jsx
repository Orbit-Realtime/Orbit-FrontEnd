import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../api/memberApi";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { signin } = useAuth();

  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = async () => {
    if (!form.username.trim() || !form.password.trim()) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await login(form.username, form.password);
      signin(result.data.memberId, result.data.nickname);
      navigate("/chat", { replace: true });
    } catch (err) {
      const message = err.response?.data?.message;
      setError(message || "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-900">
      <div className="w-80 flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-white text-center mb-2">
          로그인
        </h1>

        <input
          type="text"
          name="username"
          placeholder="아이디"
          value={form.username}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-3 bg-neutral-800 text-white rounded-lg border border-neutral-700 outline-none focus:border-blue-500 placeholder-neutral-500"
        />

        <input
          type="password"
          name="password"
          placeholder="비밀번호"
          value={form.password}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-3 bg-neutral-800 text-white rounded-lg border border-neutral-700 outline-none focus:border-blue-500 placeholder-neutral-500"
        />

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>

        <Link
          to="/signup"
          className="text-center text-neutral-400 hover:text-white text-sm transition-colors"
        >
          계정이 없으신가요? 회원가입
        </Link>
      </div>
    </div>
  );
}
