import { useState, useEffect, useCallback, useRef } from "react";
import { getDiscussion, createDiscussion, getDiscussionMessages } from "../../api/discussionApi";
import { formatMessageTime } from "../../utils/formatTime";
import { useAuth } from "../../context/AuthContext";
import DiscussionMessageItem from "./DiscussionMessageItem";

const STORAGE_KEY = "orbit-discussion-panel-width";
const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 280;
const MAX_WIDTH = 720;

function getInitialWidth() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return DEFAULT_WIDTH;
    const parsed = Number(stored);
    if (isNaN(parsed) || parsed < MIN_WIDTH || parsed > MAX_WIDTH) return DEFAULT_WIDTH;
    return parsed;
  } catch {
    return DEFAULT_WIDTH;
  }
}

export default function DiscussionPanel({ message, onClose, incomingDiscussionEvents, onConsumeDiscussionEvents, sendDiscussionMessage, connected }) {
  const { auth } = useAuth();
  const messageId = message.chatId;

  // ── Panel resize ──────────────────────────────────────────────────────────
  const [width, setWidth] = useState(getInitialWidth);
  const widthRef = useRef(width);
  widthRef.current = width;

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widthRef.current;
    let currentWidth = startWidth;
    let rafId = null;

    const onMouseMove = (moveEvent) => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const delta = moveEvent.clientX - startX;
        currentWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth - delta));
        setWidth(currentWidth);
        rafId = null;
      });
    };

    const onMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      try {
        localStorage.setItem(STORAGE_KEY, String(currentWidth));
      } catch {
        // localStorage 쓰기 실패 무시
      }
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  // unmount 시 body 스타일 복구 안전장치
  useEffect(() => {
    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  const [status, setStatus] = useState("loading"); // "loading" | "not_found" | "error" | "loaded"
  const [discussion, setDiscussion] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [discussionMessages, setDiscussionMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);

  const [inputContent, setInputContent] = useState("");

  // 이미 append된 discussionMessageId를 추적해 중복 append를 방지한다.
  // 컴포넌트 마운트마다 초기화되므로 panel 재오픈 시 자동 리셋된다.
  const processedMessageIdsRef = useRef(new Set());
  const syncFetchIdRef = useRef(0);
  const isComposingRef = useRef(false);
  // reconnect 감지용: null=초기 마운트, false=단절, true=연결
  const prevConnectedRef = useRef(null);

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

  const discussionId = discussion?.discussionId ?? null;

  // 서버 기준으로 메시지 목록을 replace하고 processedIds를 rebuild한다.
  // 초기 로드·reconnect re-sync 공통 사용. 에러는 호출부에서 처리한다.
  const syncDiscussionMessages = useCallback(async () => {
    if (!discussionId) return;
    const fetchId = ++syncFetchIdRef.current;
    const result = await getDiscussionMessages(discussionId);
    if (fetchId !== syncFetchIdRef.current) return;
    const messages = result.data ?? [];
    processedMessageIdsRef.current = new Set(messages.map((m) => m.discussionMessageId));
    setDiscussionMessages(messages);
  }, [discussionId]);

  // Queue에서 현재 discussionId와 일치하는 이벤트만 append한다.
  // 다른 discussionId 이벤트는 MVP 정책상 소비·폐기한다.
  // discussionMessageId 기준 중복 append를 processedMessageIdsRef로 방어한다.
  useEffect(() => {
    if (!incomingDiscussionEvents.length || !discussionId) return;

    const toAppend = incomingDiscussionEvents.filter(
      (e) =>
        e.discussionId === discussionId &&
        !processedMessageIdsRef.current.has(e.discussionMessageId)
    );

    // 처리 여부와 무관하게 queue에서 소비한다 (다른 discussion 이벤트 포함).
    onConsumeDiscussionEvents(incomingDiscussionEvents.map((e) => e.discussionMessageId));

    if (toAppend.length === 0) return;

    toAppend.forEach((e) => processedMessageIdsRef.current.add(e.discussionMessageId));
    setDiscussionMessages((prev) => [...prev, ...toAppend]);
  }, [incomingDiscussionEvents, discussionId, onConsumeDiscussionEvents]);

  useEffect(() => {
    if (!discussionId) {
      processedMessageIdsRef.current = new Set();
      setDiscussionMessages([]);
      setMessagesError(null);
      setMessagesLoading(false);
      return;
    }
    setMessagesLoading(true);
    setMessagesError(null);
    syncDiscussionMessages()
      .catch(() => {
        setMessagesError("메시지를 불러오지 못했습니다.");
      })
      .finally(() => {
        setMessagesLoading(false);
      });
  }, [discussionId, syncDiscussionMessages]);

  // reconnect 감지: status=loaded + discussionId 확정 상태에서만 re-sync 허용.
  // 조회 중·not_found·error·생성 중 상태에서는 실행하지 않는다.
  useEffect(() => {
    const wasDisconnected = prevConnectedRef.current === false;
    const isReconnected = connected === true;
    const canSync = status === "loaded" && discussion?.discussionId;

    if (wasDisconnected && isReconnected && canSync) {
      syncDiscussionMessages().catch(() => {});
    }

    prevConnectedRef.current = connected;
  }, [connected, status, discussion, syncDiscussionMessages]);

  const handleSendMessage = useCallback(() => {
    const trimmed = inputContent.trim();
    if (!trimmed || !discussion || !sendDiscussionMessage) return;
    sendDiscussionMessage(discussion.discussionId, trimmed);
    setInputContent("");
  }, [inputContent, discussion, sendDiscussionMessage]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isComposingRef.current || e.nativeEvent.isComposing) return;
      handleSendMessage();
    }
  };

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
    <div
      className="relative border-l border-neutral-700 flex flex-col flex-shrink-0 bg-neutral-900"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 z-10 cursor-col-resize hover:bg-blue-500/30 transition-colors"
        onMouseDown={handleResizeStart}
      />

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
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* 메시지 목록 */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {messagesLoading && (
                <div className="flex items-center justify-center flex-1">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!messagesLoading && messagesError && (
                <div className="flex items-center justify-center flex-1 px-4">
                  <p className="text-sm text-neutral-500 text-center">{messagesError}</p>
                </div>
              )}

              {!messagesLoading && !messagesError && discussionMessages.length === 0 && (
                <div className="flex items-center justify-center flex-1 px-4">
                  <p className="text-sm text-neutral-500 text-center">아직 Discussion 메시지가 없습니다.</p>
                </div>
              )}

              {!messagesLoading && !messagesError && discussionMessages.length > 0 && (
                <div className="flex-1 overflow-y-auto py-3 px-4 flex flex-col gap-3">
                  {discussionMessages.map((dm) => (
                    <DiscussionMessageItem
                      key={dm.discussionMessageId}
                      dm={dm}
                      isMine={dm.senderId === auth?.memberId}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 입력창 */}
            <div className="px-3 py-3 border-t border-neutral-700 flex-shrink-0">
              <div className="flex gap-2">
                <textarea
                  rows={1}
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onCompositionStart={() => { isComposingRef.current = true; }}
                  onCompositionEnd={() => { isComposingRef.current = false; }}
                  placeholder="메시지 입력..."
                  className="flex-1 min-w-0 bg-neutral-800 text-sm text-white rounded-lg px-3 py-2 outline-none border border-neutral-700 focus:border-neutral-500 resize-none"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputContent.trim()}
                  className="flex-shrink-0 px-3 py-2 bg-blue-500 hover:bg-blue-400 disabled:bg-neutral-700 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors"
                >
                  전송
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
