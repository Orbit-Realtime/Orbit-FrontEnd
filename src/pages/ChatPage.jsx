import { useState, useCallback, useEffect, useRef } from "react";
import { useDiscussionQueue } from "../hooks/useDiscussionQueue";
import { useChatRooms } from "../hooks/useChatRooms";
import { useWebSocket } from "../socket/useWebSocket";
import { useRoomActivity } from "../socket/useRoomActivity";
import { leaveSpace, renameSpace } from "../api/spaceApi";
import { getMessageHistory } from "../api/messageApi";
import ChatRoomList from "../components/chat/ChatRoomList";
import ChatWindow from "../components/chat/ChatWindow";
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
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  const { chatRooms, roomsError, selectedRoom, refreshChatRooms, applyRoomUpdate, removeRoom, patchRoom } =
    useChatRooms(selectedRoomId);
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
  const selectedRoomIdRef = useRef(null);
  const prevConnectedRef = useRef(false);
  const isInitialConnectRef = useRef(true);
  const historyFetchIdRef = useRef(0);
  const memberLastReadRef = useRef({});

  // WebSocket 수신 메시지 처리
  const handleMessage = useCallback(
    (data) => {
      switch (data.messageType) {
        case "CHAT_MESSAGE":
          if (data.chatRoomId === selectedRoomId) {
            setMessages((prev) => [...prev, data]);
          }
          break;

        case "UPDATE_CHAT_ROOM":
          applyRoomUpdate(data);
          break;

        case "READ_EVENT": {
          if (data.chatRoomId !== selectedRoomId) break;

          const lastProcessed = memberLastReadRef.current[data.memberId] ?? null;
          if (lastProcessed !== null && data.currentLastReadChatId <= lastProcessed) break;

          memberLastReadRef.current[data.memberId] = data.currentLastReadChatId;

          setMessages((prev) =>
            prev.map((msg) => {
              const previous = data.previousLastReadChatId;
              const current = data.currentLastReadChatId;

              const inRange =
                (previous === null || msg.chatId > previous) &&
                msg.chatId <= current;

              const isReadMemberOwnMessage = msg.senderId === data.memberId;

              if (!inRange || isReadMemberOwnMessage) return msg;

              return {
                ...msg,
                unreadMemberCount: Math.max(0, msg.unreadMemberCount - 1),
              };
            })
          );

          break;
        }

        case "DISCUSSION_MESSAGE_EVENT":
          appendDiscussionEvent(data);
          break;

        case "ERROR":
          setWsError(data.message);
          break;

        default:
          break;
      }
    },
    [selectedRoomId, applyRoomUpdate, appendDiscussionEvent]
  );

  const { connected, reconnecting, sendEnterRoom, sendChatMessage, sendRoomActive, sendRoomInactive, sendDiscussionMessage } = useWebSocket(handleMessage);

  const { notifyEntered } = useRoomActivity({ selectedRoomId, connected, sendRoomActive, sendRoomInactive });

  // selectedRoomIdRef를 최신 selectedRoomId로 동기화 (reconnect effect에서 사용)
  useEffect(() => { selectedRoomIdRef.current = selectedRoomId; }, [selectedRoomId]);

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
        refreshChatRooms();

        const roomId = selectedRoomIdRef.current;
        if (roomId !== null) {
          sendEnterRoom(roomId);
          notifyEntered(roomId);

          memberLastReadRef.current = {};
          setMessages([]);
          setHistoryLoading(true);
          setHistoryError(false);
          const fetchId = ++historyFetchIdRef.current;
          getMessageHistory(roomId)
            .then((result) => {
              if (fetchId !== historyFetchIdRef.current) return;
              const { messages: msgs, lastReadMessageId, hasMore: more } = result.data;
              setMessages(msgs ?? []);
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
  }, [connected, sendEnterRoom, notifyEntered, refreshChatRooms]);

  // 채팅방 선택
  const handleSelectRoom = useCallback(
    (roomId) => {
      if (roomId === selectedRoomId) return;
      setPanelState(null);
      memberLastReadRef.current = {};
      setSelectedRoomId(roomId);
      setMessages([]);
      setLastReadMessageId(null);
      setHasMore(false);
      setOldestChatId(null);
      setIsLoadingMore(false);
      setHistoryLoading(true);
      setHistoryError(false);
      sendEnterRoom(roomId);
      // ENTER_ROOM 전송 후 useRoomActivity 내부 상태를 동기화한다.
      // ROOM_ACTIVE는 보내지 않는다 (ENTER_ROOM이 백엔드 activate를 처리함).
      notifyEntered(roomId);
      const fetchId = ++historyFetchIdRef.current;
      getMessageHistory(roomId)
        .then((result) => {
          if (fetchId !== historyFetchIdRef.current) return;
          const { messages: msgs, lastReadMessageId, hasMore: more } = result.data;
          setMessages(msgs ?? []);
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
    [selectedRoomId, sendEnterRoom, notifyEntered]
  );

  // 이전 메시지 로드
  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || !oldestChatId) return;
    setIsLoadingMore(true);
    const fetchId = historyFetchIdRef.current;
    getMessageHistory(selectedRoomId, oldestChatId)
      .then((result) => {
        if (fetchId !== historyFetchIdRef.current) return;
        const { messages: older, hasMore: more } = result.data;
        setMessages((prev) => [...(older ?? []), ...prev]);
        setHasMore(more ?? false);
        setOldestChatId(older?.[0]?.chatId ?? oldestChatId);
      })
      .catch(() => {})
      .finally(() => setIsLoadingMore(false));
  }, [hasMore, isLoadingMore, oldestChatId, selectedRoomId]);

  // 메시지 전송
  const handleSend = useCallback(
    (message) => {
      sendChatMessage(selectedRoomId, message);
    },
    [selectedRoomId, sendChatMessage]
  );

  // 채팅방 나가기
  const handleLeaveRoom = useCallback(async () => {
    if (!selectedRoomId) return;
    const roomId = selectedRoomId;
    try {
      await leaveSpace(roomId);
      setSelectedRoomId(null);
      setPanelState(null);
      removeRoom(roomId);
    } catch (e) {
      // ignore
    }
  }, [selectedRoomId, removeRoom]);

  // 채팅방 이름 변경
  const handleRenameRoom = useCallback(async (newTitle) => {
    if (!selectedRoomId || !newTitle.trim()) return;
    try {
      await renameSpace(selectedRoomId, newTitle.trim());
      patchRoom(selectedRoomId, { title: newTitle.trim() });
    } catch (e) {
      // ignore
    }
  }, [selectedRoomId, patchRoom]);

  // Space 생성 완료: modal 닫기 + 목록 갱신 + 생성된 Space 자동 선택
  const handleSpaceCreated = useCallback((roomId) => {
    setShowCreateModal(false);
    refreshChatRooms();
    if (roomId) handleSelectRoom(roomId);
  }, [refreshChatRooms, handleSelectRoom]);

  return (
    <div className="relative flex flex-col h-screen bg-neutral-900 text-white overflow-hidden">
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
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <div className="flex flex-col w-64 border-r border-neutral-700 flex-shrink-0">

          {/* 사용자 헤더 */}
          <UserHeader connected={connected} />

          {/* Space 목록 */}
          <div className="flex-1 overflow-hidden">
            <ChatRoomList
              chatRooms={chatRooms}
              roomsError={roomsError}
              onRetry={refreshChatRooms}
              selectedRoomId={selectedRoomId}
              onSelectRoom={handleSelectRoom}
            />
          </div>

          {/* New Space 버튼 */}
          <div className="flex-shrink-0 border-t border-neutral-700 px-3 py-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-sm text-white transition-colors"
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
          {selectedRoomId ? (
            <ChatWindow
              room={selectedRoom}
              messages={messages}
              lastReadMessageId={lastReadMessageId}
              onSend={handleSend}
              loading={historyLoading}
              historyError={historyError}
              onBack={() => setSelectedRoomId(null)}
              onLeave={handleLeaveRoom}
              onRename={handleRenameRoom}
              connected={connected}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={handleLoadMore}
              membersOpen={panelState?.type === "members"}
              onToggleMembers={() => setPanelState((p) => (p?.type === "members" ? null : { type: "members" }))}
              onOpenDiscussion={(msg) => {
                setPanelState({ type: "discussion", message: msg });
                clearDiscussionEvents();
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-neutral-500">
              대화를 선택하세요.
            </div>
          )}
        </div>

        {/* ── Right Panel — 멤버 목록 ── */}
        {panelState?.type === "members" && selectedRoomId && (
          <MemberPanel
            chatRoomId={selectedRoomId}
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
