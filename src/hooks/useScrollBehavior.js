import { useEffect, useLayoutEffect, useRef, useState } from "react";

export default function useScrollBehavior({
  messages,
  loading,
  lastReadChatId,
  isLoadingMore,
  hasMore,
  onLoadMore,
}) {
  const scrollContainerRef = useRef(null);
  const bottomRef = useRef(null);
  const readMarkerRef = useRef(null);
  const scrolledRef = useRef(false);
  const prevMessagesLengthRef = useRef(0);
  const prevScrollHeightRef = useRef(0);
  const isLoadingMoreRef = useRef(isLoadingMore);
  const [newMessageCount, setNewMessageCount] = useState(0);

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

  return {
    scrollContainerRef,
    bottomRef,
    readMarkerRef,
    newMessageCount,
    handleScroll,
    scrollToBottom,
  };
}
