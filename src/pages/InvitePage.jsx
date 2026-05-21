import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getSpaceByInviteCode, joinSpaceByInviteCode } from "../api/spaceApi";

export default function InvitePage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { auth } = useAuth();

  const [status, setStatus] = useState("loading");
  // "loading" | "invalid_code" | "error" | "ready"
  const [spaceInfo, setSpaceInfo] = useState(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);

  const fetchSpaceInfo = useCallback(() => {
    setStatus("loading");
    setJoinError(null);
    getSpaceByInviteCode(inviteCode)
      .then((result) => {
        setSpaceInfo(result.data);
        setStatus("ready");
      })
      .catch((e) => {
        const httpStatus = e.response?.status;
        if (httpStatus === 404) {
          setStatus("invalid_code");
        } else {
          setStatus("error");
        }
      });
  }, [inviteCode]);

  useEffect(() => {
    if (!auth) {
      navigate("/", { replace: true, state: { from: location.pathname } });
      return;
    }
    fetchSpaceInfo();
  }, [auth, fetchSpaceInfo, navigate, location.pathname]);

  const handleJoin = async () => {
    if (joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      await joinSpaceByInviteCode(inviteCode);
      navigate("/chat", { replace: true });
    } catch (e) {
      const message = e.response?.data?.message;
      setJoinError(message || "참여 중 오류가 발생했습니다.");
    } finally {
      setJoining(false);
    }
  };

  const handleGoToChat = () => {
    navigate("/chat", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center orbit-workspace">
      <div className="w-80 flex flex-col items-center gap-6 bg-orbit-elevated rounded-2xl p-8 orbit-panel-bg">

        {status === "loading" && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-orbit-muted border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {status === "invalid_code" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-orbit-surface2 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-orbit-subtle">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>
            <div className="text-center flex flex-col gap-1">
              <p className="text-orbit-text font-semibold">유효하지 않은 초대 코드</p>
              <p className="text-orbit-subtle text-sm">초대 링크가 만료됐거나 올바르지 않습니다.</p>
            </div>
            <button
              onClick={handleGoToChat}
              className="w-full py-2.5 bg-orbit-surface2 hover:bg-orbit-elevated text-orbit-secondary border border-orbit-border rounded-lg text-sm font-medium transition-colors"
            >
              홈으로
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-orbit-surface2 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-orbit-subtle">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>
            <div className="text-center flex flex-col gap-1">
              <p className="text-orbit-text font-semibold">오류가 발생했습니다.</p>
              <p className="text-orbit-subtle text-sm">잠시 후 다시 시도해주세요.</p>
            </div>
            <button
              onClick={fetchSpaceInfo}
              className="w-full py-2.5 bg-orbit-surface2 hover:bg-orbit-elevated text-orbit-secondary border border-orbit-border rounded-lg text-sm font-medium transition-colors"
            >
              다시 시도
            </button>
          </>
        )}

        {status === "ready" && spaceInfo && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-orbit-surface2 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-orbit-text select-none">
                {spaceInfo.title?.[0]?.toUpperCase() ?? "?"}
              </span>
            </div>

            <div className="text-center flex flex-col gap-1 w-full">
              <p className="text-orbit-text font-semibold text-lg truncate">{spaceInfo.title}</p>
              <p className="text-orbit-muted text-sm">{spaceInfo.memberCount}명 참여 중</p>
            </div>

            {spaceInfo.alreadyJoined ? (
              <div className="w-full flex flex-col gap-3">
                <p className="text-center text-orbit-subtle text-sm">이미 참여 중인 Space입니다.</p>
                <button
                  onClick={handleGoToChat}
                  className="w-full py-2.5 bg-orbit-surface2 hover:bg-orbit-elevated text-orbit-secondary border border-orbit-border rounded-lg text-sm font-medium transition-colors"
                >
                  Space로 이동
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col gap-3">
                {joinError && (
                  <p className="text-red-400 text-sm text-center">{joinError}</p>
                )}
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full py-2.5 bg-orbit-cyan hover:bg-orbit-cyan/80 disabled:bg-orbit-surface2 disabled:text-orbit-muted disabled:cursor-not-allowed text-orbit-bg font-semibold rounded-lg text-sm transition-colors"
                >
                  {joining ? "참여 중..." : "참여하기"}
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
