import { useState, useEffect, useCallback } from "react";
import { getDiscussion, createDiscussion } from "../../api/discussionApi";
import { formatMessageTime } from "../../utils/formatTime";

export default function DiscussionPanel({ message, onClose }) {
  const messageId = message.chatId;

  const [status, setStatus] = useState("loading"); // "loading" | "not_found" | "error" | "loaded"
  const [discussion, setDiscussion] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const loadDiscussion = useCallback(() => {
    setStatus("loading");
    setDiscussion(null);
    setCreateError(null);
    getDiscussion(messageId)
      .then((result) => {
        setDiscussion(result.data);
        setStatus("loaded");
      })
      .catch((err) => {
        if (err?.response?.status === 404) {
          setStatus("not_found");
        } else {
          setStatus("error");
        }
      });
  }, [messageId]);

  useEffect(() => { loadDiscussion(); }, [loadDiscussion]);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createDiscussion(messageId);
      setDiscussion(result.data);
      setStatus("loaded");
    } catch (err) {
      if (err?.response?.status === 409) {
        loadDiscussion();
      } else {
        setCreateError("Discussion 생성에 실패했습니다.");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-72 border-l border-neutral-700 flex flex-col flex-shrink-0 bg-neutral-900">

      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 flex-shrink-0">
        <span className="text-sm font-medium text-white">Discussion</span>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-white transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
          </svg>
        </button>
      </div>

      {/* Root message preview */}
      <div className="px-4 py-3 border-b border-neutral-700 flex-shrink-0 bg-neutral-800/50">
        <p className="text-xs text-neutral-400 mb-1 font-medium">{message.senderNickname}</p>
        <p className="text-sm text-neutral-300 line-clamp-3 break-words">{message.message}</p>
        <p className="text-xs text-neutral-500 mt-1">{formatMessageTime(message.createdDate)}</p>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {status === "loading" && (
          <div className="flex items-center justify-center flex-1">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {status === "not_found" && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 px-4">
            <div className="text-center">
              <p className="text-neutral-300 text-sm font-medium mb-1">Discussion 없음</p>
              <p className="text-neutral-500 text-xs">
                이 메시지에 대한 Discussion을 시작하세요.
              </p>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full py-2 bg-blue-500 hover:bg-blue-400 disabled:bg-neutral-600 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-colors"
            >
              {creating ? "생성 중..." : "Start Discussion"}
            </button>
            {createError && (
              <p className="text-xs text-red-400 text-center">{createError}</p>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 px-4">
            <p className="text-neutral-500 text-sm text-center">불러오지 못했습니다.</p>
            <button
              onClick={loadDiscussion}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}

        {status === "loaded" && discussion && (
          <div className="flex flex-col items-center justify-center flex-1 px-4 gap-2">
            <svg viewBox="0 0 24 24" className="w-8 h-8 fill-neutral-600">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
            </svg>
            <p className="text-neutral-400 text-sm text-center">Discussion이 열려 있습니다.</p>
            <p className="text-xs text-neutral-500 text-center">
              Discussion 메시지 기능이 준비 중입니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
