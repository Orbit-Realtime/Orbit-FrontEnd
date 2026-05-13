import { useState, useCallback } from "react";

export function useDiscussionQueue() {
  const [incomingDiscussionEvents, setIncomingDiscussionEvents] = useState([]);

  const appendDiscussionEvent = useCallback((event) => {
    setIncomingDiscussionEvents((prev) => [...prev, event]);
  }, []);

  const consumeDiscussionEvents = useCallback((ids) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    setIncomingDiscussionEvents((prev) =>
      prev.filter((e) => !idSet.has(e.discussionMessageId))
    );
  }, []);

  const clearDiscussionEvents = useCallback(() => {
    setIncomingDiscussionEvents([]);
  }, []);

  return {
    incomingDiscussionEvents,
    appendDiscussionEvent,
    consumeDiscussionEvents,
    clearDiscussionEvents,
  };
}
