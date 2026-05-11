import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import MessageItem from "./MessageItem";
import { formatDateDivider } from "../../utils/formatTime";

export default function ChatWindow({ room, messages, lastReadChatId, onSend, loading, historyError, onBack, onLeave, onRename, connected, hasMore, isLoadingMore, onLoadMore, membersOpen, onToggleMembers, onOpenDiscussion }) {
  const { auth } = useAuth();
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const readMarkerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const scrolledRef = useRef(false);
  const prevMessagesLengthRef = useRef(0);
  const prevScrollHeightRef = useRef(0);
  const isLoadingMoreRef = useRef(isLoadingMore);
  const isComposingRef = useRef(false);
  const [text, setText] = useState("");
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  const checkIsAtBottom = () => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  };

  const checkIsAtTop = () => {
    const el = scrollContainerRef.current;
    if (!el) return false;
    return el.scrollTop < 50;
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMessageCount(0);
  };

  const handleScroll = () => {
    if (checkIsAtBottom()) {
      setNewMessageCount(0);
    }
    if (checkIsAtTop() && hasMore && !isLoadingMore) {
      onLoadMore();
    }
  };

  useEffect(() => {
    if (loading) {
      scrolledRef.current = false;
      prevMessagesLengthRef.current = 0;
      setNewMessageCount(0);
      return;
    }
    if (messages.length === 0) return;

    if (!scrolledRef.current) {
      scrolledRef.current = true;
      prevMessagesLengthRef.current = messages.length;
      if (lastReadChatId !== null && readMarkerRef.current) {
        readMarkerRef.current.scrollIntoView({ behavior: "instant" });
      } else {
        bottomRef.current?.scrollIntoView({ behavior: "instant" });
      }
    } else if (messages.length > prevMessagesLengthRef.current) {
      const newCount = messages.length - prevMessagesLengthRef.current;
      prevMessagesLengthRef.current = messages.length;
      if (!isLoadingMoreRef.current) {
        if (checkIsAtBottom()) {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        } else {
          setNewMessageCount((prev) => prev + newCount);
        }
      }
    }
  }, [loading, messages, lastReadChatId]);

  // isLoadingMore prop을 ref에 동기화 (다른 effect 내부에서 최신값 참조용)
  useEffect(() => {
    isLoadingMoreRef.current = isLoadingMore;
  }, [isLoadingMore]);

  // load-more 시작 시 scrollHeight 캡처, 완료 시 스크롤 위치 복원
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (isLoadingMore) {
      prevScrollHeightRef.current = el.scrollHeight;
    } else if (prevScrollHeightRef.current > 0) {
      const diff = el.scrollHeight - prevScrollHeightRef.current;
      if (diff > 0) el.scrollTop += diff;
      prevScrollHeightRef.current = 0;
    }
  }, [isLoadingMore]);

  // 방이 바뀌면 편집 상태 초기화
  useEffect(() => {
    setIsEditingTitle(false);
    setLeaveConfirm(false);
  }, [room?.chatRoomId]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
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
    setEditTitle(room?.title ?? "");
    setIsEditingTitle(true);
  };

  const commitRename = () => {
    setIsEditingTitle(false);
    if (editTitle.trim() && editTitle.trim() !== room?.title) {
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

  const showDividerAfter = (msg, idx) =>
    lastReadChatId !== null &&
    msg.chatId === lastReadChatId &&
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
        <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-700 flex-shrink-0">
          <button
            onClick={onBack}
            className="md:hidden flex-shrink-0 text-neutral-400 hover:text-white transition-colors"
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
              className="flex-1 bg-neutral-700 text-white text-sm font-bold px-2 py-1 rounded outline-none border border-neutral-500 min-w-0"
            />
          ) : (
            <button
              onClick={startEditTitle}
              className="flex-1 text-left font-bold text-white hover:text-neutral-300 transition-colors truncate"
              title="클릭하여 이름 변경"
            >
              {room?.title ?? ""}
            </button>
          )}

          {/* 멤버 보기 버튼 */}
          <button
            onClick={onToggleMembers}
            title="멤버 목록"
            className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
              membersOpen ? "bg-neutral-600 text-white" : "text-neutral-400 hover:text-white hover:bg-neutral-700"
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </button>

          {/* 나가기 버튼 */}
          <button
            onClick={() => setLeaveConfirm(true)}
            title="채팅방 나가기"
            className="flex-shrink-0 p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-700 transition-colors"
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
            className="h-full overflow-y-auto px-4 py-4 flex flex-col gap-2"
          >
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : historyError ? (
              <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
                메시지를 불러오지 못했습니다.
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
                아직 메시지가 없습니다.
              </div>
            ) : (
              <>
                {isLoadingMore && (
                  <div className="flex items-center justify-center py-3">
                    <div className="w-4 h-4 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!hasMore && !isLoadingMore && messages.length > 0 && (
                  <div className="flex items-center gap-2 my-2">
                    <div className="flex-1 h-px bg-neutral-700" />
                    <span className="text-xs text-neutral-500 flex-shrink-0">대화의 시작입니다</span>
                    <div className="flex-1 h-px bg-neutral-700" />
                  </div>
                )}
                {messages.map((msg, idx) => (
                <div key={msg.chatId}>
                  {showDateDividerBefore(msg, idx) && (
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-neutral-700" />
                      <span className="text-xs text-neutral-500 flex-shrink-0">
                        {formatDateDivider(msg.createdDate)}
                      </span>
                      <div className="flex-1 h-px bg-neutral-700" />
                    </div>
                  )}
                  <div className="group">
                    <MessageItem
                      message={msg}
                      isMine={msg.senderId === auth?.memberId}
                      hideNickname={isConsecutive(msg, idx)}
                    />
                    {onOpenDiscussion && (
                      <div className={`mt-0.5 flex ${msg.senderId === auth?.memberId ? "justify-end" : "justify-start"}`}>
                        <button
                          onClick={() => onOpenDiscussion(msg)}
                          className="opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto transition-opacity duration-150 flex items-center gap-1 px-2 py-0.5 rounded text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700/50"
                        >
                          <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current flex-shrink-0">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
                          </svg>
                          Discussion
                        </button>
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
                ))}
              </>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 새 메시지 알림 버튼 */}
          {newMessageCount > 0 && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 bg-blue-500 hover:bg-blue-400 text-white text-xs font-medium px-3 py-2 rounded-full shadow-lg transition-colors flex items-center gap-1.5"
            >
              새 메시지 {newMessageCount}개
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current">
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
              </svg>
            </button>
          )}
        </div>

        {/* 입력창 */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-neutral-700">
          {!connected && (
            <p className="text-xs text-red-400 mb-2 text-center">
              연결이 끊어져 메시지를 전송할 수 없습니다.
            </p>
          )}
          <div className="flex items-end gap-2 bg-neutral-700 rounded-xl px-4 py-2.5">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => { isComposingRef.current = true; }}
              onCompositionEnd={() => { isComposingRef.current = false; }}
              placeholder={connected ? "메시지를 입력하세요" : "연결 중..."}
              disabled={!connected}
              rows={1}
              className="flex-1 bg-transparent text-white text-sm placeholder-neutral-500 resize-none outline-none max-h-32 leading-5 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || !connected}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500 hover:bg-blue-400 disabled:bg-neutral-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white rotate-90">
                <path d="M2 21L23 12 2 3v7l15 2-15 2v7z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 나가기 확인 다이얼로그 */}
      {leaveConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-neutral-800 rounded-2xl p-6 w-72 shadow-xl">
            <p className="text-white font-medium mb-2">채팅방 나가기</p>
            <p className="text-neutral-400 text-sm mb-6">
              채팅방을 나가면 대화 내용이 더 이상 보이지 않습니다. 나가시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setLeaveConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-sm text-white transition-colors"
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
