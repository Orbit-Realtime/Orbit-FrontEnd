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
import { mergeMessagesById, applyReadEvent, removePendingByClientMessageId, markPendingMessageFailed, markPendingMessageSending } from "../utils/messageState";
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
  // 서버가 ENTER_ROOM_ACK로 입장을 확인한 selectedSpaceId (enteredSpaceIdRef의 상태 버전). ENTER_ROOM 전송만으로는 설정되지 않는다.
  const [enteredSpaceId, setEnteredSpaceId] = useState(null);
  // 현재 selectedSpaceId에 대한 ENTER_ROOM이 ERROR로 실패해 재시도 UI를 보여줘야 하는지. wsError(4초 후 자동 소멸)와 독립적으로 유지된다.
  const [enterRoomFailed, setEnterRoomFailed] = useState(false);

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
  // ENTER_ROOM_ACK를 수신해 서버가 입장을 확인한 selectedSpaceId
  const enteredSpaceIdRef = useRef(null);
  // ENTER_ROOM을 보냈지만 아직 ACK/ERROR 응답을 받지 못한 spaceId (중복 전송 방지 + ACK/ERROR 매칭용)
  const pendingEnterRoomSpaceIdRef = useRef(null);
  // handleMessage(useCallback)가 useSpaceActivity보다 먼저 선언되어 notifyEntered를 직접 참조할 수 없으므로 ref로 우회한다
  const notifyEnteredRef = useRef(() => {});
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

        case "ENTER_ROOM_ACK":
          // 이미 다른 Space로 전환된 뒤 늦게 도착한 stale ACK는 무시한다
          if (data.chatRoomId !== selectedSpaceIdRef.current) break;

          pendingEnterRoomSpaceIdRef.current = null;
          enteredSpaceIdRef.current = data.chatRoomId;
          setEnteredSpaceId(data.chatRoomId);
          setEnterRoomFailed(false);
          // ENTER_ROOM이 서버에서 active 등록까지 수행하므로, ACK로 확인된 이후에만 active로 간주한다
          notifyEnteredRef.current(data.chatRoomId);
          break;

        case "ERROR": {
          console.warn("WS ERROR", {
            requestType: data.requestType,
            errorCode: data.errorCode,
            chatRoomId: data.chatRoomId,
          });

          const isEnterRoomError =
            data.requestType === "ENTER_ROOM" && data.chatRoomId === selectedSpaceIdRef.current;

          if (isEnterRoomError) {
            pendingEnterRoomSpaceIdRef.current = null;
            enteredSpaceIdRef.current = null;
            setEnteredSpaceId(null);
            // 재시도 UI 노출 — 사용자가 명시적으로 재시도하기 전까지 유지된다 (자동 재시도 없음)
            setEnterRoomFailed(true);
          }

          setWsError(data.message);

          // 서버는 비참여자도 ROOM_NOT_FOUND로 내려줄 수 있으므로, FE에서는 ROOM_NOT_FOUND/FORBIDDEN을 접근 불가 계열로 취급해
          // Space 목록을 다시 조회하고 실제로 사라졌는지 확인한다 (그 외 errorCode는 공통 처리만 적용)
          if (isEnterRoomError && (data.errorCode === "ROOM_NOT_FOUND" || data.errorCode === "FORBIDDEN")) {
            const erroredSpaceId = data.chatRoomId;

            refreshSpaces().then((refreshedSpaces) => {
              // refresh가 끝나기 전에 다른 Space로 이동했으면 이 결과는 더 이상 유효하지 않다
              if (selectedSpaceIdRef.current !== erroredSpaceId) return;
              // refresh 자체가 실패하면 접근 가능 여부를 판단할 수 없으므로 기존 재시도 UI를 그대로 둔다
              if (refreshedSpaces === null) return;

              const stillAccessible = refreshedSpaces.some((s) => s.chatRoomId === erroredSpaceId);
              if (stillAccessible) return; // 여전히 접근 가능 — enterRoomFailed=true 유지, 재시도 버튼 노출 그대로

              // 목록에서 사라짐 — 더 이상 접근할 수 없는 Space
              setSelectedSpaceId(null);
              setMessages([]);
              setPendingMessages([]);
              clearPendingTimeouts();
              setPanelState(null);
              clearDiscussionEvents();
              setEnterRoomFailed(false);
              setWsError("더 이상 접근할 수 없는 공간입니다.");
            });
          }

          break;
        }

        default:
          break;
      }
    },
    [
      applySpaceUpdate,
      appendDiscussionEvent,
      setWsError,
      setEnteredSpaceId,
      setEnterRoomFailed,
      refreshSpaces,
      clearPendingTimeouts,
      clearDiscussionEvents,
    ]
  );

  const { connected, reconnecting, sendEnterRoom, sendChatMessage, sendRoomActive, sendRoomInactive, sendDiscussionMessage } = useWebSocket(handleMessage);

  const { notifyEntered } = useSpaceActivity({ selectedSpaceId, connected, sendRoomActive, sendRoomInactive });

  // handleMessage(ENTER_ROOM_ACK)가 최신 notifyEntered를 참조하도록 매 렌더마다 동기화한다
  useEffect(() => {
    notifyEnteredRef.current = notifyEntered;
  });

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

  // ENTER_ROOM 전송 + 대기 상태 기록의 단일 진입점. 최초 전송(effect)과 사용자의 명시적 재시도(retryEnterRoom)가 공유한다.
  // 같은 spaceId로 이미 보내고 ACK/ERROR를 기다리는 중이면(ref는 동기로 즉시 반영되므로 더블클릭/중복 호출에도 안전) 재전송하지 않는다.
  const triggerEnterRoom = useCallback(
    (spaceId) => {
      if (pendingEnterRoomSpaceIdRef.current === spaceId) return;

      pendingEnterRoomSpaceIdRef.current = spaceId;
      sendEnterRoom(spaceId);
    },
    [sendEnterRoom]
  );

  // ENTER_ROOM 전송: 응답(ACK/ERROR)을 기다리지 않고 전송만 수행한다.
  // enteredSpaceId/enteredSpaceIdRef는 ENTER_ROOM_ACK 수신 시에만 설정된다 (handleMessage 참고).
  useEffect(() => {
    if (!connected) return;

    if (selectedSpaceId === null) {
      pendingEnterRoomSpaceIdRef.current = null;
      enteredSpaceIdRef.current = null;
      setEnteredSpaceId(null);
      setEnterRoomFailed(false);
      return;
    }

    if (enteredSpaceIdRef.current === selectedSpaceId) return;

    // 중복 전송 방지는 triggerEnterRoom 내부 가드가 단일하게 담당한다
    setEnterRoomFailed(false);
    triggerEnterRoom(selectedSpaceId);
  }, [connected, selectedSpaceId, triggerEnterRoom]);

  useEffect(() => {
    if (!connected) {
      pendingEnterRoomSpaceIdRef.current = null;
      enteredSpaceIdRef.current = null;
      setEnteredSpaceId(null);
      setEnterRoomFailed(false);
    }
  }, [connected]);

  // ENTER_ROOM 실패 후 사용자가 명시적으로 재시도할 때만 호출된다. 자동 재시도/타이머/백오프는 없다.
  const retryEnterRoom = useCallback(() => {
    if (!selectedSpaceId || !connected) return;
    // 같은 메시지로 다시 실패해도 4초 배너가 온전히 재노출되도록 먼저 비운다 (useWsErrorBanner는 값이 바뀔 때만 타이머를 재시작함)
    setWsError(null);
    setEnterRoomFailed(false);
    triggerEnterRoom(selectedSpaceId);
  }, [selectedSpaceId, connected, setWsError, triggerEnterRoom]);

  // Space 메시지 전송 가능 여부를 나타내는 connection state
  // offline: 네트워크 끊김 / reconnecting: 소켓 재연결 중 / synchronizing: ENTER_ROOM_ACK 대기 중 / ready: ACK 수신 완료(전송 가능)
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

  // echo 미수신 시 pending message를 "failed"로 전환하는 send timeout을 등록한다 (handleSend/handleRetryMessage 공용)
  const registerPendingTimeout = useCallback((clientMessageId) => {
    const existingTimeoutId = pendingTimeoutsRef.current.get(clientMessageId);
    if (existingTimeoutId) {
      clearTimeout(existingTimeoutId);
    }

    const timeoutId = setTimeout(() => {
      pendingTimeoutsRef.current.delete(clientMessageId);
      setPendingMessages((prev) => markPendingMessageFailed(prev, clientMessageId));
    }, MESSAGE_SEND_TIMEOUT_MS);
    pendingTimeoutsRef.current.set(clientMessageId, timeoutId);
  }, []);

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

      registerPendingTimeout(clientMessageId);

      sendChatMessage(selectedSpaceId, message, clientMessageId);
    },
    [selectedSpaceId, sendChatMessage, auth, registerPendingTimeout]
  );

  // failed pending message를 재시도: 같은 clientMessageId로 sendChatMessage를 재호출하고 status를 "sending"으로 되돌린다
  const handleRetryMessage = useCallback(
    (clientMessageId) => {
      if (connectionState !== "ready") return;

      const target = pendingMessages.find(
        (p) => p.clientMessageId === clientMessageId && p.status === "failed"
      );
      if (!target) return;

      setPendingMessages((prev) => markPendingMessageSending(prev, clientMessageId));
      registerPendingTimeout(clientMessageId);
      sendChatMessage(target.chatRoomId, target.message, clientMessageId);
    },
    [connectionState, pendingMessages, sendChatMessage, registerPendingTimeout]
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
              enterRoomFailed={enterRoomFailed}
              onRetryEnterRoom={retryEnterRoom}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={handleLoadMore}
              onRetryHistory={handleRetryHistory}
              membersOpen={membersOpen}
              onToggleMembers={handleToggleMembers}
              onOpenDiscussion={handleOpenDiscussion}
              activeDiscussionChatId={activeDiscussionChatId}
              onRemoveFailedMessage={handleRemoveFailedMessage}
              onRetryMessage={handleRetryMessage}
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
