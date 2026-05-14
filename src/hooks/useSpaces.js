import { useState, useEffect, useCallback, useMemo } from "react";
import { getSpaces } from "../api/spaceApi";

const sortRooms = (rooms) =>
  [...rooms].sort((a, b) => {
    if (!a.createdDate && !b.createdDate) return 0;
    if (!a.createdDate) return 1;
    if (!b.createdDate) return -1;
    return new Date(b.createdDate) - new Date(a.createdDate);
  });

export function useSpaces(selectedSpaceId) {
  const [spaces, setSpaces] = useState([]);
  const [spacesError, setSpacesError] = useState(false);

  useEffect(() => {
    getSpaces()
      .then((result) => {
        setSpaces(sortRooms(result.data ?? []));
        setSpacesError(false);
      })
      .catch(() => setSpacesError(true));
  }, []);

  const refreshSpaces = useCallback(() => {
    getSpaces()
      .then((result) => {
        setSpaces(sortRooms(result.data ?? []));
        setSpacesError(false);
      })
      .catch(() => setSpacesError(true));
  }, []);

  // UPDATE_CHAT_ROOM WebSocket 이벤트 처리.
  // roomExists === false: 새로 초대된 방은 인라인 추가 대신 전체 재조회로 처리.
  // lastChatId 역전 시 stale 이벤트 무시.
  const applySpaceUpdate = useCallback(
    (data) => {
      setSpaces((prev) => {
        const roomExists = prev.some((r) => r.chatRoomId === data.chatRoomId);
        if (!roomExists) {
          setTimeout(refreshSpaces, 0);
          return prev;
        }
        return sortRooms(
          prev.map((room) => {
            if (room.chatRoomId !== data.chatRoomId) return room;
            if (
              data.lastChatId != null &&
              room.lastChatId != null &&
              data.lastChatId < room.lastChatId
            ) {
              return room;
            }
            return {
              ...room,
              title: data.title ?? room.title,
              lastMessage: data.lastMessage,
              createdDate: data.createdDate,
              lastChatId: data.lastChatId,
              unreadMessageCount: data.unreadMessageCount,
            };
          })
        );
      });
    },
    [refreshSpaces]
  );

  const removeSpace = useCallback((roomId) => {
    setSpaces((prev) => prev.filter((r) => r.chatRoomId !== roomId));
  }, []);

  const patchSpace = useCallback((roomId, patch) => {
    setSpaces((prev) =>
      prev.map((r) => (r.chatRoomId === roomId ? { ...r, ...patch } : r))
    );
  }, []);

  const selectedSpace = useMemo(
    () => spaces.find((r) => r.chatRoomId === selectedSpaceId),
    [spaces, selectedSpaceId]
  );

  return {
    spaces,
    spacesError,
    selectedSpace,
    refreshSpaces,
    applySpaceUpdate,
    removeSpace,
    patchSpace,
  };
}
