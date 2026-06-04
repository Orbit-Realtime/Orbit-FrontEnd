import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export function usePendingInvite({ connected, spacesLoaded, spaces, onSelectSpace }) {
  const location = useLocation();
  const [pendingSelectSpaceId] = useState(
    () => location.state?.selectedSpaceId ?? null
  );
  const pendingConsumedRef = useRef(false);

  useEffect(() => {
    if (!pendingSelectSpaceId || pendingConsumedRef.current) return;
    if (!connected) return;
    if (!spacesLoaded) return;

    const exists = spaces.some((s) => s.chatRoomId === pendingSelectSpaceId);
    if (!exists) return;

    pendingConsumedRef.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    onSelectSpace(pendingSelectSpaceId);
  }, [pendingSelectSpaceId, connected, spacesLoaded, spaces, onSelectSpace]);
}
