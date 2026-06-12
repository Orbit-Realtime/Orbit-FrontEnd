import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getInviteCode } from "../../api/spaceApi";
import MessageItem from "./MessageItem";
import { formatDateDivider } from "../../utils/formatTime";
import useScrollBehavior from "../../hooks/useScrollBehavior";

export default function SpaceWindow({ space, messages, lastReadMessageId, onSend, loading, historyError, onBack, onLeave, onRename, connectionState, hasMore, isLoadingMore, onLoadMore, onRetryHistory, membersOpen, onToggleMembers, onOpenDiscussion, activeDiscussionChatId, onRemoveFailedMessage }) {
  const { auth } = useAuth();
  const textareaRef = useRef(null);
  const isComposingRef = useRef(false);
  const [text, setText] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [copyStatus, setCopyStatus] = useState("idle");
  // "idle" | "loading" | "copied" | "error"

  const {
    scrollContainerRef,
    bottomRef,
    readMarkerRef,
    newMessageCount,
    handleScroll,
    scrollToBottom,
  } = useScrollBehavior({ messages, loading, lastReadMessageId, isLoadingMore, hasMore, onLoadMore, currentUserId: auth?.memberId });

  // 방이 바뀌면 편집 상태 초기화
  useEffect(() => {
    setIsEditingTitle(false);
    setLeaveConfirm(false);
    setCopyStatus("idle");
  }, [space?.chatRoomId]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (connectionState !== "ready") return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isComposingRef.current || e.nativeEvent.isComposing) return;
      handleSend();
    }
  };

  const handleChange = (e) => {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  };

  const startEditTitle = () => {
    setEditTitle(space?.title ?? "");
    setIsEditingTitle(true);
  };

  const commitRename = () => {
    setIsEditingTitle(false);
    if (editTitle.trim() && editTitle.trim() !== space?.title) {
      onRename(editTitle.trim());
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); commitRename(); }
    if (e.key === "Escape") { setIsEditingTitle(false); }
  };

  const handleLeaveConfirm = async () => {
    setLeaveConfirm(false);
    await onLeave();
  };

  const copyToClipboard = async (text) => {
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (err) {
        console.warn("[SpaceWindow] Clipboard API 실패, fallback 시도:", err.name, err.message);
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (!success) {
      throw new Error("execCommand copy failed");
    }
  };

  const handleCopyInviteLink = async () => {
    if (copyStatus !== "idle" || !space?.chatRoomId) return;

    setCopyStatus("loading");

    try {
      const result = await getInviteCode(space.chatRoomId);
      const url = `${window.location.origin}/invite/${result.data.inviteCode}`;
      await copyToClipboard(url);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (error) {
      console.error("[SpaceWindow] 초대 링크 복사 실패:", error);
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  };

  const showDividerAfter = (msg, idx) =>
    lastReadMessageId !== null &&
    msg.chatId === lastReadMessageId &&
    idx < messages.length - 1;

  const showDateDividerBefore = (msg, idx) => {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    const prevDate = new Date(prev.createdDate);
    const currDate = new Date(msg.createdDate);
    return (
      prevDate.getFullYear() !== currDate.getFullYear() ||
      prevDate.getMonth() !== currDate.getMonth() ||
      prevDate.getDate() !== currDate.getDate()
    );
  };

  const isConsecutive = (msg, idx) =>
    idx > 0 && messages[idx - 1].senderId === msg.senderId;

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* 메인 채팅 영역 */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 상단 헤더 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-orbit-border flex-shrink-0">
          <button
            onClick={onBack}
            className="md:hidden flex-shrink-0 text-orbit-muted hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </button>

          {/* 채팅방 이름 (클릭 시 편집) */}
          {isEditingTitle ? (
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleTitleKeyDown}
              className="flex-1 bg-orbit-elevated text-white text-sm font-bold px-2 py-1 rounded outline-none border border-orbit-border-strong min-w-0"
            />
          ) : (
            <button
              onClick={startEditTitle}
              className="flex-1 text-left font-bold text-orbit-text hover:text-orbit-secondary transition-colors truncate"
              title="클릭하여 이름 변경"
            >
              {space?.title ?? ""}
            </button>
          )}

          {/* 멤버 보기 버튼 */}
          <button
            onClick={onToggleMembers}
            title="멤버 목록"
            className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
              membersOpen ? "bg-orbit-elevated text-white" : "text-orbit-muted hover:text-white hover:bg-orbit-surface2"
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </button>

          {/* 초대 링크 복사 버튼 */}
          <button
            onClick={handleCopyInviteLink}
            disabled={copyStatus === "loading"}
            title={copyStatus === "copied" ? "복사됨!" : "초대 링크 복사"}
            className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
              copyStatus === "copied"
                ? "text-orbit-cyan bg-orbit-surface2"
                : copyStatus === "error"
                ? "text-red-400 bg-orbit-surface2"
                : "text-orbit-muted hover:text-white hover:bg-orbit-surface2"
            }`}
          >
            {copyStatus === "copied" ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            ) : copyStatus === "error" ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
              </svg>
            )}
          </button>

          {/* 나가기 버튼 */}
          <button
            onClick={() => setLeaveConfirm(true)}
            title="채팅방 나가기"
            className="flex-shrink-0 p-1.5 rounded-lg text-orbit-muted hover:text-red-400 hover:bg-orbit-surface2 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
            </svg>
          </button>
        </div>

        {/* 메시지 목록 */}
        <div className="flex-1 overflow-hidden relative">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto orbit-scrollbar px-4 py-4 flex flex-col gap-2"
          >
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-orbit-muted border-t-transparent rounded-full animate-spin" />
              </div>
            ) : historyError ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <p className="text-orbit-subtle text-sm">메시지를 불러오지 못했습니다.</p>
                <button
                  onClick={onRetryHistory}
                  className="text-xs text-orbit-cyan hover:text-orbit-text transition-colors"
                >
                  다시 시도
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-orbit-subtle text-sm">
                아직 메시지가 없습니다.
              </div>
            ) : (
              <>
                {isLoadingMore && (
                  <div className="flex items-center justify-center py-3">
                    <div className="w-4 h-4 border-2 border-orbit-muted border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!hasMore && !isLoadingMore && messages.length > 0 && (
                  <div className="flex items-center gap-2 my-2">
                    <div className="flex-1 h-px bg-orbit-border" />
                    <span className="text-xs text-orbit-subtle flex-shrink-0">대화의 시작입니다</span>
                    <div className="flex-1 h-px bg-orbit-border" />
                  </div>
                )}
                {messages.map((msg, idx) => {
                  const isActiveDiscussion = msg.chatId === activeDiscussionChatId;
                  return (
                <div key={msg.chatId ?? msg.clientMessageId}>
                  {showDateDividerBefore(msg, idx) && (
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-orbit-border" />
                      <span className="text-xs text-orbit-subtle flex-shrink-0">
                        {formatDateDivider(msg.createdDate)}
                      </span>
                      <div className="flex-1 h-px bg-orbit-border" />
                    </div>
                  )}
                  <div className="group">
                    <MessageItem
                      message={msg}
                      isMine={msg.senderId === auth?.memberId}
                      hideNickname={isConsecutive(msg, idx)}
                      onRemoveFailedMessage={onRemoveFailedMessage}
                    />
                    {onOpenDiscussion && !msg.isTemporary && (
                      <div className={`mt-0.5 flex ${msg.senderId === auth?.memberId ? "justify-end" : "justify-start"}`}>
                        {msg.discussionId && msg.discussionMessageCount > 0 ? (
                          <button
                            onClick={() => onOpenDiscussion(msg)}
                            className={isActiveDiscussion
                              ? "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-orbit-cyan bg-orbit-cyan/[0.08] border border-orbit-cyan/70 shadow-[0_0_0_1px_rgba(67,217,255,0.18),0_0_12px_rgba(67,217,255,0.08)] transition-colors"
                              : "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-orbit-cyan/70 hover:text-orbit-cyan bg-orbit-surface/60 hover:bg-orbit-surface2 border border-orbit-border/50 hover:border-orbit-border transition-colors"}
                          >
                            {isActiveDiscussion && (
                              <span className="w-1.5 h-1.5 rounded-full bg-orbit-cyan/80 flex-shrink-0" />
                            )}
                            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current flex-shrink-0">
                              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                            </svg>
                            Discussion · {msg.discussionMessageCount} {msg.discussionMessageCount === 1 ? "reply" : "replies"}
                          </button>
                        ) : (
                          <button
                            onClick={() => onOpenDiscussion(msg)}
                            className="opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto transition-opacity duration-150 flex items-center gap-1 px-2 py-0.5 rounded-md text-xs text-orbit-subtle hover:text-orbit-cyan hover:bg-orbit-surface2 border border-transparent hover:border-orbit-border"
                          >
                            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current flex-shrink-0">
                              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
                            </svg>
                            Discussion
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {showDividerAfter(msg, idx) && (
                    <div ref={readMarkerRef} className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-blue-500/40" />
                      <span className="text-xs text-blue-400 flex-shrink-0">
                        여기까지 읽었습니다
                      </span>
                      <div className="flex-1 h-px bg-blue-500/40" />
                    </div>
                  )}
                </div>
                  );
                })}
              </>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 새 메시지 알림 버튼 */}
          {newMessageCount > 0 && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 bg-orbit-cyan hover:bg-orbit-cyan/80 text-orbit-bg text-xs font-medium px-3 py-2 rounded-full shadow-lg transition-colors flex items-center gap-1.5"
            >
              새 메시지 {newMessageCount}개
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current">
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
              </svg>
            </button>
          )}
        </div>

        {/* 입력창 */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-orbit-border">
          {connectionState !== "ready" && (
            <div className={`text-xs mb-2 text-center leading-snug ${
              connectionState === "offline"
                ? "text-red-400"
                : connectionState === "reconnecting"
                ? "text-yellow-400"
                : "text-orbit-cyan"
            }`}>
              {connectionState === "offline" && (
                <>
                  <p className="font-medium">오프라인 상태입니다.</p>
                  <p className="text-orbit-subtle mt-0.5">연결이 복구되면 다시 전송할 수 있습니다.</p>
                </>
              )}
              {connectionState === "reconnecting" && <p>서버와 다시 연결하는 중입니다...</p>}
              {connectionState === "synchronizing" && <p>채팅방 연결 준비 중입니다...</p>}
            </div>
          )}
          <div className={`flex items-center gap-2 bg-orbit-surface2 rounded-xl border px-4 py-2.5 transition-colors ${
            connectionState === "ready"
              ? "border-orbit-border focus-within:border-orbit-border-strong"
              : "border-orbit-border/50 opacity-70"
          }`}>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => { isComposingRef.current = true; }}
              onCompositionEnd={() => { isComposingRef.current = false; }}
              placeholder="메시지를 입력하세요"
              rows={1}
              className="flex-1 bg-transparent text-orbit-text text-sm placeholder:text-orbit-subtle resize-none outline-none max-h-32 leading-5"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || connectionState !== "ready"}
              title={connectionState !== "ready" ? "전송 불가" : undefined}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-orbit-cyan hover:bg-orbit-cyan/80 disabled:bg-orbit-elevated disabled:opacity-50 text-orbit-bg disabled:text-orbit-muted disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current -rotate-90">
                <path d="M2 21L23 12 2 3v7l15 2-15 2v7z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 나가기 확인 다이얼로그 */}
      {leaveConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-orbit-elevated rounded-2xl p-6 w-72 shadow-xl">
            <p className="text-orbit-text font-medium mb-2">채팅방 나가기</p>
            <p className="text-orbit-muted text-sm mb-6">
              채팅방을 나가면 대화 내용이 더 이상 보이지 않습니다. 나가시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setLeaveConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-orbit-surface2 hover:bg-orbit-elevated text-sm text-orbit-text transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleLeaveConfirm}
                className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-sm text-white font-medium transition-colors"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
