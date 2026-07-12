import { useState, useEffect, useCallback, useMemo } from "react";
import { getSpaces } from "../api/spaceApi";

const sortSpaces = (spaces) =>
  [...spaces].sort((a, b) => {
    if (!a.createdDate && !b.createdDate) return 0;
    if (!a.createdDate) return 1;
    if (!b.createdDate) return -1;
    return new Date(b.createdDate) - new Date(a.createdDate);
  });

export function useSpaces(selectedSpaceId) {
  const [spaces, setSpaces] = useState([]);
  const [spacesError, setSpacesError] = useState(false);
  const [spacesLoaded, setSpacesLoaded] = useState(false);

  useEffect(() => {
    getSpaces()
      .then((result) => {
        setSpaces(sortSpaces(result.data ?? []));
        setSpacesError(false);
      })
      .catch(() => setSpacesError(true))
      .finally(() => setSpacesLoaded(true));
  }, []);

  // 새로 고침된(정렬된) spaces 배열을 resolve하는 Promise를 반환한다.
  // 실패 시에도 reject하지 않고 null을 resolve한다 — 기존 fire-and-forget 호출부가 unhandled rejection 없이 그대로 동작하도록 하기 위함.
  const refreshSpaces = useCallback(() => {
    return getSpaces()
      .then((result) => {
        const sorted = sortSpaces(result.data ?? []);
        setSpaces(sorted);
        setSpacesError(false);
        return sorted;
      })
      .catch(() => {
        setSpacesError(true);
        return null;
      });
  }, []);

  const removeSpace = useCallback((spaceId) => {
    setSpaces((prev) => prev.filter((r) => r.chatRoomId !== spaceId));
  }, []);

  const patchSpace = useCallback((spaceId, patch) => {
    setSpaces((prev) =>
      prev.map((r) => (r.chatRoomId === spaceId ? { ...r, ...patch } : r))
    );
  }, []);

  const selectedSpace = useMemo(
    () => spaces.find((r) => r.chatRoomId === selectedSpaceId),
    [spaces, selectedSpaceId]
  );

  return {
    spaces,
    spacesError,
    spacesLoaded,
    selectedSpace,
    refreshSpaces,
    removeSpace,
    patchSpace,
  };
}
