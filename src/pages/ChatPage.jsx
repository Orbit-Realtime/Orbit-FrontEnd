import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useDiscussionQueue } from "../hooks/useDiscussionQueue";
import { useSpaces } from "../hooks/useSpaces";
import { useWebSocket } from "../socket/useWebSocket";
import { useSpaceActivity } from "../socket/useSpaceActivity";
import { leaveSpace, renameSpace } from "../api/spaceApi";
import { getMessageHistory } from "../api/messageApi";
import { mergeMessagesById, applyReadEvent } from "../utils/messageState";
import SpaceList from "../components/chat/SpaceList";
import SpaceWindow from "../components/chat/SpaceWindow";
import MemberPanel from "../components/chat/MemberPanel";
import DiscussionPanel from "../components/chat/DiscussionPanel";
import CreateSpaceModal from "../components/chat/CreateSpaceModal";
import UserHeader from "../components/chat/UserHeader";

export default function ChatPage() {
  // UI 상태
  // null | { type: "members" } | { type: "discussion", message }
  const [panelState, setPanelState] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 데이터 상태 — realtime 연동 (위치 유지)
  const [selectedSpaceId, setSelectedSpaceId] = useState(null);

  const location = useLocation();
  const [pendingSelectSpaceId] = useState(
    () => location.state?.selectedSpaceId ?? null
  );
  const pendingConsumedRef = useRef(false);

  const { spaces, spacesError, spacesLoaded, selectedSpace, refreshSpaces, applySpaceUpdate, removeSpace, patchSpace } =
    useSpaces(selectedSpaceId);
  const [messages, setMessages] = useState([]);
  const [lastReadMessageId, setLastReadMessageId] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [oldestChatId, setOldestChatId] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [wsError, setWsError] = useState(null);

  const {
    incomingDiscussionEvents,
    appendDiscussionEvent,
    consumeDiscussionEvents,
    clearDiscussionEvents,
  } = useDiscussionQueue();

  // refs — realtime 연동 (위치 유지)
  const selectedSpaceIdRef = useRef(null);
  const prevConnectedRef = useRef(false);
  const isInitialConnectRef = useRef(true);
  const historyFetchIdRef = useRef(0);
  const memberLastReadRef = useRef({});
  const countedDiscussionMessageIdsRef = useRef(new Set());

  // WebSocket 수신 메시지 처리
  const handleMessage = useCallback(
    (data) => {
      switch (data.messageType) {
        case "CHAT_MESSAGE":
          if (data.chatRoomId === selectedSpaceIdRef.current) {
            setMessages((prev) => mergeMessagesById(prev, [data]));
          }
          break;

        case "UPDATE_CHAT_ROOM":
          applySpaceUpdate(data);
          break;

        case "READ_EVENT": {
          if (data.chatRoomId !== selectedSpaceIdRef.current) break;

          const lastProcessed = memberLastReadRef.current[data.memberId] ?? null;
          if (lastProcessed !== null && data.currentLastReadChatId <= lastProcessed) break;

          memberLastReadRef.current[data.memberId] = data.currentLastReadChatId;

          setMessages((prev) => applyReadEvent(prev, data));

          break;
        }

        case "DISCUSSION_MESSAGE_EVENT":
          if (data.spaceId !== selectedSpaceIdRef.current) break;
          appendDiscussionEvent(data);

          if (
            data.chatId &&
            data.discussionMessageId &&
            !countedDiscussionMessageIdsRef.current.has(data.discussionMessageId)
          ) {
            countedDiscussionMessageIdsRef.current.add(data.discussionMessageId);

            setMessages((prev) =>
              prev.map((msg) =>
                msg.chatId === data.chatId
                  ? {
                      ...msg,
                      discussionMessageCount: (msg.discussionMessageCount ?? 0) + 1,
                      discussionId: msg.discussionId ?? data.discussionId,
                    }
                  : msg
              )
            );
          }
          break;

        case "ERROR":
          setWsError(data.message);
          break;

        default:
          break;
      }
    },
    [applySpaceUpdate, appendDiscussionEvent]
  );

  const { connected, reconnecting, sendEnterRoom, sendChatMessage, sendRoomActive, sendRoomInactive, sendDiscussionMessage } = useWebSocket(handleMessage);

  const { notifyEntered } = useSpaceActivity({ selectedSpaceId, connected, sendRoomActive, sendRoomInactive });

  // selectedSpaceIdRef를 최신 selectedSpaceId로 동기화 (reconnect effect에서 사용)
  useEffect(() => { selectedSpaceIdRef.current = selectedSpaceId; }, [selectedSpaceId]);

  // wsError 자동 소멸 (4초)
  useEffect(() => {
    if (!wsError) return;
    const timer = setTimeout(() => setWsError(null), 4000);
    return () => clearTimeout(timer);
  }, [wsError]);

  // 재연결 시 state recovery: WebSocket이 false→true로 바뀌면 상태 재동기화
  useEffect(() => {
    if (connected && !prevConnectedRef.current) {
      if (!isInitialConnectRef.current) {
        refreshSpaces();

        const spaceId = selectedSpaceIdRef.current;
        if (spaceId !== null) {
          sendEnterRoom(spaceId);
          notifyEntered(spaceId);

          memberLastReadRef.current = {};
          setMessages([]);
          setIsLoadingMore(false);
          setHistoryLoading(true);
          setHistoryError(false);
          const fetchId = ++historyFetchIdRef.current;
          getMessageHistory(spaceId)
            .then((result) => {
              if (fetchId !== historyFetchIdRef.current) return;
              if (spaceId !== selectedSpaceIdRef.current) return;
              const { messages: msgs, lastReadMessageId, hasMore: more } = result.data;
              setMessages((prev) => mergeMessagesById(prev, msgs ?? []));
              setLastReadMessageId(lastReadMessageId ?? null);
              setHasMore(more ?? false);
              setOldestChatId(msgs?.[0]?.chatId ?? null);
              setHistoryError(false);
            })
            .catch(() => {
              if (fetchId !== historyFetchIdRef.current) return;
              setHistoryError(true);
            })
            .finally(() => {
              if (fetchId !== historyFetchIdRef.current) return;
              setHistoryLoading(false);
            });
        }
      }
      isInitialConnectRef.current = false;
    }
    prevConnectedRef.current = connected;
  }, [connected, sendEnterRoom, notifyEntered, refreshSpaces]);

  // 채팅방 선택
  const handleSelectSpace = useCallback(
    (spaceId) => {
      if (spaceId === selectedSpaceId) return;
      setPanelState(null);
      memberLastReadRef.current = {};
      setSelectedSpaceId(spaceId);
      setMessages([]);
      setLastReadMessageId(null);
      setHasMore(false);
      setOldestChatId(null);
      setIsLoadingMore(false);
      setHistoryLoading(true);
      setHistoryError(false);
      sendEnterRoom(spaceId);
      // ENTER_ROOM 전송 후 useSpaceActivity 내부 상태를 동기화한다.
      // ROOM_ACTIVE는 보내지 않는다 (ENTER_ROOM이 백엔드 activate를 처리함).
      notifyEntered(spaceId);
      const fetchId = ++historyFetchIdRef.current;
      getMessageHistory(spaceId)
        .then((result) => {
          if (fetchId !== historyFetchIdRef.current) return;
          if (spaceId !== selectedSpaceIdRef.current) return;
          const { messages: msgs, lastReadMessageId, hasMore: more } = result.data;
          setMessages((prev) => mergeMessagesById(prev, msgs ?? []));
          setLastReadMessageId(lastReadMessageId ?? null);
          setHasMore(more ?? false);
          setOldestChatId(msgs?.[0]?.chatId ?? null);
          setHistoryError(false);
        })
        .catch(() => {
          if (fetchId !== historyFetchIdRef.current) return;
          setHistoryError(true);
        })
        .finally(() => {
          if (fetchId !== historyFetchIdRef.current) return;
          setHistoryLoading(false);
        });
    },
    [selectedSpaceId, sendEnterRoom, notifyEntered]
  );

  // invite 진입 시 Space 자동 선택
  useEffect(() => {
    if (!pendingSelectSpaceId || pendingConsumedRef.current) return;
    if (!connected) return;
    if (!spacesLoaded) return;

    const exists = spaces.some((s) => s.chatRoomId === pendingSelectSpaceId);
    if (!exists) return;

    pendingConsumedRef.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    handleSelectSpace(pendingSelectSpaceId);
  }, [pendingSelectSpaceId, connected, spacesLoaded, spaces, handleSelectSpace]);

  // 이전 메시지 로드
  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || !oldestChatId) return;
    setIsLoadingMore(true);
    const fetchId = historyFetchIdRef.current;
    getMessageHistory(selectedSpaceId, oldestChatId)
      .then((result) => {
        if (fetchId !== historyFetchIdRef.current) return;
        const { messages: older, hasMore: more } = result.data;
        setMessages((prev) => [...(older ?? []), ...prev]);
        setHasMore(more ?? false);
        setOldestChatId(older?.[0]?.chatId ?? oldestChatId);
      })
      .catch(() => {})
      .finally(() => setIsLoadingMore(false));
  }, [hasMore, isLoadingMore, oldestChatId, selectedSpaceId]);

  // 메시지 history 재시도
  const handleRetryHistory = useCallback(() => {
    if (!selectedSpaceId) return;

    setHistoryLoading(true);
    setHistoryError(false);

    const fetchId = ++historyFetchIdRef.current;

    getMessageHistory(selectedSpaceId)
      .then((result) => {
        if (fetchId !== historyFetchIdRef.current) return;
        if (selectedSpaceId !== selectedSpaceIdRef.current) return;
        const { messages: msgs, lastReadMessageId, hasMore: more } = result.data;
        setMessages((prev) => mergeMessagesById(prev, msgs ?? []));
        setLastReadMessageId(lastReadMessageId ?? null);
        setHasMore(more ?? false);
        setOldestChatId(msgs?.[0]?.chatId ?? null);
        setHistoryError(false);
      })
      .catch(() => {
        if (fetchId !== historyFetchIdRef.current) return;
        setHistoryError(true);
      })
      .finally(() => {
        if (fetchId !== historyFetchIdRef.current) return;
        setHistoryLoading(false);
      });
  }, [selectedSpaceId]);

  // 메시지 전송
  const handleSend = useCallback(
    (message) => {
      sendChatMessage(selectedSpaceId, message);
    },
    [selectedSpaceId, sendChatMessage]
  );

  // 채팅방 나가기
  const handleLeaveRoom = useCallback(async () => {
    if (!selectedSpaceId) return;
    const spaceId = selectedSpaceId;
    try {
      await leaveSpace(spaceId);
      setSelectedSpaceId(null);
      setPanelState(null);
      removeSpace(spaceId);
    } catch (e) {
      // ignore
    }
  }, [selectedSpaceId, removeSpace]);

  // 채팅방 이름 변경
  const handleRenameRoom = useCallback(async (newTitle) => {
    if (!selectedSpaceId || !newTitle.trim()) return;
    try {
      await renameSpace(selectedSpaceId, newTitle.trim());
      patchSpace(selectedSpaceId, { title: newTitle.trim() });
    } catch (e) {
      // ignore
    }
  }, [selectedSpaceId, patchSpace]);

  // Space 생성 완료: modal 닫기 + 목록 갱신 + 생성된 Space 자동 선택
  const handleSpaceCreated = useCallback((spaceId) => {
    setShowCreateModal(false);
    refreshSpaces();
    if (spaceId) handleSelectSpace(spaceId);
  }, [refreshSpaces, handleSelectSpace]);

  return (
    <div className="orbit-workspace relative flex flex-col h-screen text-orbit-text overflow-hidden">
      {/* ── Background overlays ── */}
      <div className="orbit-vignette" aria-hidden="true" />
      <div className="orbit-arc-overlay" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          style={{ pointerEvents: 'none' }}
        >
          {/* Arc 1: 주 궤도 — 좌상단 밖 중심, 상단(949,0)→좌측(0,594) */}
          <circle
            cx="100" cy="-300" r="900"
            fill="none" stroke="rgba(67,217,255,0.045)" strokeWidth="1"
          />
          {/* Arc 2: 역방향 궤도 — 우상단 밖 중심, 상단(534,0)→우측(1440,664) */}
          <circle
            cx="1340" cy="-150" r="820"
            fill="none" stroke="rgba(67,217,255,0.03)" strokeWidth="0.8"
          />
          {/* Arc 3: 블루 하단 궤도 — 우하단 밖 중심, 우측(1440,50)→하단(608,900) */}
          <circle
            cx="1580" cy="1020" r="980"
            fill="none" stroke="rgba(59,130,246,0.025)" strokeWidth="0.8"
          />
          {/* Arc 4: 천정 호 — 뷰포트 위 중앙 중심, 상단에 완만한 호 */}
          <circle
            cx="720" cy="-580" r="660"
            fill="none" stroke="rgba(67,217,255,0.02)" strokeWidth="0.6"
          />
        </svg>
      </div>

      {/* 재연결 배너 */}
      {!connected && (
        <div className={`flex items-center justify-center gap-2 py-1.5 text-xs font-medium flex-shrink-0 ${
          reconnecting ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"
        }`}>
          {reconnecting ? (
            <>
              <div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin" />
              서버에 재연결 중입니다...
            </>
          ) : (
            "연결이 끊어졌습니다. 페이지를 새로고침 해주세요."
          )}
        </div>
      )}

      {/* 서버 에러 배너 */}
      {wsError && (
        <div className="flex items-center justify-between gap-2 py-1.5 px-4 text-xs font-medium flex-shrink-0 bg-orange-500/20 text-orange-400">
          <span>{wsError}</span>
          <button
            onClick={() => setWsError(null)}
            className="flex-shrink-0 hover:text-white transition-colors"
            aria-label="에러 메시지 닫기"
          >
            ✕
          </button>
        </div>
      )}

      {/* 본문 — 3-column layout */}
      <div className="flex flex-1 overflow-hidden relative z-10">

        {/* ── Sidebar ── */}
        <div className="flex flex-col w-64 border-r border-orbit-border bg-orbit-sidebar orbit-sidebar-bg flex-shrink-0 relative z-10">

          {/* 사용자 헤더 */}
          <UserHeader connected={connected} />

          {/* Space 목록 */}
          <div className="flex-1 overflow-hidden">
            <SpaceList
              spaces={spaces}
              spacesError={spacesError}
              onRetry={refreshSpaces}
              selectedSpaceId={selectedSpaceId}
              onSelectSpace={handleSelectSpace}
            />
          </div>

          {/* New Space 버튼 */}
          <div className="flex-shrink-0 border-t border-orbit-border px-4 py-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-orbit-border bg-orbit-surface2 hover:bg-orbit-elevated text-sm text-orbit-secondary hover:text-orbit-text transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              New Space
            </button>
          </div>
        </div>

        {/* ── Main Conversation ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedSpaceId ? (
            <SpaceWindow
              space={selectedSpace}
              messages={messages}
              lastReadMessageId={lastReadMessageId}
              onSend={handleSend}
              loading={historyLoading}
              historyError={historyError}
              onBack={() => setSelectedSpaceId(null)}
              onLeave={handleLeaveRoom}
              onRename={handleRenameRoom}
              connected={connected}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={handleLoadMore}
              onRetryHistory={handleRetryHistory}
              membersOpen={panelState?.type === "members"}
              onToggleMembers={() => setPanelState((p) => (p?.type === "members" ? null : { type: "members" }))}
              onOpenDiscussion={(msg) => {
                setPanelState({ type: "discussion", message: msg });
                clearDiscussionEvents();
              }}
              activeDiscussionChatId={panelState?.type === "discussion" ? panelState.message.chatId : null}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-orbit-subtle">
              대화를 선택하세요.
            </div>
          )}
        </div>

        {/* ── Right Panel — 멤버 목록 ── */}
        {panelState?.type === "members" && selectedSpaceId && (
          <MemberPanel
            spaceId={selectedSpaceId}
            onClose={() => setPanelState(null)}
          />
        )}

        {panelState?.type === "discussion" && (
          <DiscussionPanel
            message={panelState.message}
            incomingDiscussionEvents={incomingDiscussionEvents}
            onConsumeDiscussionEvents={consumeDiscussionEvents}
            sendDiscussionMessage={sendDiscussionMessage}
            connected={connected}
            onClose={() => {
              setPanelState(null);
              clearDiscussionEvents();
            }}
          />
        )}
      </div>

      {showCreateModal && (
        <CreateSpaceModal
          onCreated={handleSpaceCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}

    </div>
  );
}
