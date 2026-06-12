import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useDiscussionQueue } from "../hooks/useDiscussionQueue";
import { usePendingInvite } from "../hooks/usePendingInvite";
import { useSpaces } from "../hooks/useSpaces";
import { useWsErrorBanner } from "../hooks/useWsErrorBanner";
import { useWebSocket } from "../socket/useWebSocket";
import { useSpaceActivity } from "../socket/useSpaceActivity";
import { leaveSpace, renameSpace } from "../api/spaceApi";
import { getMessageHistory } from "../api/messageApi";
import { mergeMessagesById, applyReadEvent, removePendingByClientMessageId, markPendingMessageFailed } from "../utils/messageState";
import SpaceWindow from "../components/chat/SpaceWindow";
import MemberPanel from "../components/chat/MemberPanel";
import DiscussionPanel from "../components/chat/DiscussionPanel";
import CreateSpaceModal from "../components/chat/CreateSpaceModal";
import WorkspaceBackground from "../components/chat/WorkspaceBackground";
import ReconnectBanner from "../components/chat/ReconnectBanner";
import WsErrorBanner from "../components/chat/WsErrorBanner";
import ChatSidebar from "../components/chat/ChatSidebar";

// echo가 이 시간 내에 도착하지 않으면 pending message를 "failed"로 표시한다
const MESSAGE_SEND_TIMEOUT_MS = 10000;

export default function ChatPage() {
  const { auth } = useAuth();

  // UI 상태
  // null | { type: "members" } | { type: "discussion", message }
  const [panelState, setPanelState] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 데이터 상태 — realtime 연동 (위치 유지)
  const [selectedSpaceId, setSelectedSpaceId] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  // 현재 socket session 기준으로 ENTER_ROOM synchronization이 완료된 selectedSpaceId (enteredSpaceIdRef의 상태 버전)
  const [enteredSpaceId, setEnteredSpaceId] = useState(null);

  const { spaces, spacesError, spacesLoaded, selectedSpace, refreshSpaces, applySpaceUpdate, removeSpace, patchSpace } =
    useSpaces(selectedSpaceId);
  const [messages, setMessages] = useState([]);
  // FE에서만 존재하는 전송 중 메시지 (echo reconciliation 이전 단계, clientMessageId로 식별)
  const [pendingMessages, setPendingMessages] = useState([]);
  const [lastReadMessageId, setLastReadMessageId] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [oldestChatId, setOldestChatId] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { wsError, setWsError } = useWsErrorBanner();

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
  // 현재 socket session 기준으로 ENTER_ROOM synchronization이 완료된 selectedSpaceId
  const enteredSpaceIdRef = useRef(null);
  const historyFetchIdRef = useRef(0);
  const memberLastReadRef = useRef({});
  const countedDiscussionMessageIdsRef = useRef(new Set());
  // pending message의 send timeout 관리 (clientMessageId -> timeoutId)
  const pendingTimeoutsRef = useRef(new Map());

  // 등록된 모든 pending message timeout을 정리한다
  const clearPendingTimeouts = useCallback(() => {
    for (const timeoutId of pendingTimeoutsRef.current.values()) {
      clearTimeout(timeoutId);
    }
    pendingTimeoutsRef.current.clear();
  }, []);

  // WebSocket 수신 메시지 처리
  const handleMessage = useCallback(
    (data) => {
      switch (data.messageType) {
        case "CHAT_MESSAGE":
          if (data.chatRoomId === selectedSpaceIdRef.current) {
            const timeoutId = pendingTimeoutsRef.current.get(data.clientMessageId);
            if (timeoutId) {
              clearTimeout(timeoutId);
              pendingTimeoutsRef.current.delete(data.clientMessageId);
            }
            setPendingMessages((prev) => removePendingByClientMessageId(prev, data.clientMessageId));
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
    [applySpaceUpdate, appendDiscussionEvent, setWsError]
  );

  const { connected, reconnecting, sendEnterRoom, sendChatMessage, sendRoomActive, sendRoomInactive, sendDiscussionMessage } = useWebSocket(handleMessage);

  const { notifyEntered } = useSpaceActivity({ selectedSpaceId, connected, sendRoomActive, sendRoomInactive });

  // selectedSpaceIdRef를 최신 selectedSpaceId로 동기화 (reconnect effect에서 사용)
  useEffect(() => { selectedSpaceIdRef.current = selectedSpaceId; }, [selectedSpaceId]);

  // unmount 시 등록된 pending message timeout을 모두 정리
  useEffect(() => () => clearPendingTimeouts(), [clearPendingTimeouts]);

  // 브라우저 online/offline 상태 추적 (connectionState 계산용)
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // 재연결 시 state recovery: WebSocket이 false→true로 바뀌면 상태 재동기화
  useEffect(() => {
    if (connected && !prevConnectedRef.current) {
      if (!isInitialConnectRef.current) {
        refreshSpaces();

        const spaceId = selectedSpaceIdRef.current;
        if (spaceId !== null) {
          memberLastReadRef.current = {};
          setMessages([]);
          setPendingMessages([]);
          clearPendingTimeouts();
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
  }, [connected, refreshSpaces, clearPendingTimeouts]);

  useEffect(() => {
    if (!connected) return;

    if (selectedSpaceId === null) {
      enteredSpaceIdRef.current = null;
      setEnteredSpaceId(null);
      return;
    }

    if (enteredSpaceIdRef.current === selectedSpaceId) return;

    sendEnterRoom(selectedSpaceId);
    notifyEntered(selectedSpaceId);

    enteredSpaceIdRef.current = selectedSpaceId;
    setEnteredSpaceId(selectedSpaceId);
  }, [connected, selectedSpaceId, sendEnterRoom, notifyEntered]);

  useEffect(() => {
    if (!connected) {
      enteredSpaceIdRef.current = null;
      setEnteredSpaceId(null);
    }
  }, [connected]);

  // Space 메시지 전송 가능 여부를 나타내는 connection state
  // offline: 네트워크 끊김 / reconnecting: 소켓 재연결 중 / synchronizing: ENTER_ROOM 동기화 중 / ready: 전송 가능
  const connectionState = useMemo(() => {
    if (!online) return "offline";
    if (!connected) return "reconnecting";
    if (selectedSpaceId !== null && enteredSpaceId !== selectedSpaceId) return "synchronizing";
    return "ready";
  }, [online, connected, selectedSpaceId, enteredSpaceId]);

  // 좌측 상단 UserHeader 등 앱 전체 네트워크/소켓 상태를 나타내는 global connection state
  // (ENTER_ROOM synchronization 여부는 보지 않음)
  const globalConnectionState = useMemo(() => {
    if (!online) return "offline";
    if (!connected) return "reconnecting";
    return "online";
  }, [online, connected]);

  // 채팅방 선택
  const handleSelectSpace = useCallback(
    (spaceId) => {
      if (spaceId === selectedSpaceId) return;
      setPanelState(null);
      memberLastReadRef.current = {};
      setSelectedSpaceId(spaceId);
      setMessages([]);
      setPendingMessages([]);
      clearPendingTimeouts();
      setLastReadMessageId(null);
      setHasMore(false);
      setOldestChatId(null);
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
    },
    [selectedSpaceId, clearPendingTimeouts]
  );

  usePendingInvite({ connected, spacesLoaded, spaces, onSelectSpace: handleSelectSpace });

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
      const clientMessageId = crypto.randomUUID();

      setPendingMessages((prev) => [
        ...prev,
        {
          clientMessageId,
          chatRoomId: selectedSpaceId,
          message,
          senderId: auth?.memberId,
          senderNickname: auth?.nickname,
          createdDate: new Date().toISOString(),
          status: "sending",
          isTemporary: true,
        },
      ]);

      const timeoutId = setTimeout(() => {
        pendingTimeoutsRef.current.delete(clientMessageId);
        setPendingMessages((prev) => markPendingMessageFailed(prev, clientMessageId));
      }, MESSAGE_SEND_TIMEOUT_MS);
      pendingTimeoutsRef.current.set(clientMessageId, timeoutId);

      sendChatMessage(selectedSpaceId, message, clientMessageId);
    },
    [selectedSpaceId, sendChatMessage, auth]
  );

  // 서버 확정 메시지 + FE 전송 중 메시지를 합친 렌더링 목록
  const renderMessages = useMemo(
    () => [...messages, ...pendingMessages],
    [messages, pendingMessages]
  );

  // failed pending message를 화면에서 제거 (local-only, 서버 요청 없음)
  const handleRemoveFailedMessage = useCallback((clientMessageId) => {
    setPendingMessages((prev) => removePendingByClientMessageId(prev, clientMessageId));
  }, []);

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

  const handleOpenCreateModal = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedSpaceId(null);
  }, []);

  const handleToggleMembers = useCallback(() => {
    setPanelState((p) => (p?.type === "members" ? null : { type: "members" }));
  }, []);

  const handleOpenDiscussion = useCallback(
    (msg) => {
      setPanelState({ type: "discussion", message: msg });
      clearDiscussionEvents();
    },
    [clearDiscussionEvents]
  );

  const handleCloseMemberPanel = useCallback(() => {
    setPanelState(null);
  }, []);

  const handleCloseDiscussion = useCallback(() => {
    setPanelState(null);
    clearDiscussionEvents();
  }, [clearDiscussionEvents]);

  const membersOpen = panelState?.type === "members";
  const activeDiscussionChatId =
    panelState?.type === "discussion" ? panelState.message.chatId : null;

  return (
    <div className="orbit-workspace relative flex flex-col h-screen text-orbit-text overflow-hidden">
      <WorkspaceBackground />

      <ReconnectBanner connected={connected} reconnecting={reconnecting} />
      <WsErrorBanner wsError={wsError} onDismiss={() => setWsError(null)} />

      {/* 본문 — 3-column layout */}
      <div className="flex flex-1 overflow-hidden relative z-10">

        <ChatSidebar
          globalConnectionState={globalConnectionState}
          spaces={spaces}
          spacesError={spacesError}
          onRetrySpaces={refreshSpaces}
          selectedSpaceId={selectedSpaceId}
          onSelectSpace={handleSelectSpace}
          onCreateSpace={handleOpenCreateModal}
        />

        {/* ── Main Conversation ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedSpaceId ? (
            <SpaceWindow
              space={selectedSpace}
              messages={renderMessages}
              lastReadMessageId={lastReadMessageId}
              onSend={handleSend}
              loading={historyLoading}
              historyError={historyError}
              onBack={handleBack}
              onLeave={handleLeaveRoom}
              onRename={handleRenameRoom}
              connectionState={connectionState}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={handleLoadMore}
              onRetryHistory={handleRetryHistory}
              membersOpen={membersOpen}
              onToggleMembers={handleToggleMembers}
              onOpenDiscussion={handleOpenDiscussion}
              activeDiscussionChatId={activeDiscussionChatId}
              onRemoveFailedMessage={handleRemoveFailedMessage}
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
            onClose={handleCloseMemberPanel}
          />
        )}

        {panelState?.type === "discussion" && (
          <DiscussionPanel
            message={panelState.message}
            incomingDiscussionEvents={incomingDiscussionEvents}
            onConsumeDiscussionEvents={consumeDiscussionEvents}
            sendDiscussionMessage={sendDiscussionMessage}
            connected={connected}
            onClose={handleCloseDiscussion}
          />
        )}
      </div>

      {showCreateModal && (
        <CreateSpaceModal
          onCreated={handleSpaceCreated}
          onClose={handleCloseCreateModal}
        />
      )}

    </div>
  );
}
