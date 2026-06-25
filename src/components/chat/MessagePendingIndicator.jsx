// sending 메시지가 echo/ERROR 응답을 기다리는 동안 표시하는 점 3개 애니메이션
export default function MessagePendingIndicator() {
  return (
    <span className="inline-flex items-center gap-0.5 h-3">
      <span className="sr-only">전송 중</span>
      <span aria-hidden="true" className="w-1 h-1 rounded-full bg-orbit-muted animate-pulse" />
      <span aria-hidden="true" className="w-1 h-1 rounded-full bg-orbit-muted animate-pulse [animation-delay:0.2s]" />
      <span aria-hidden="true" className="w-1 h-1 rounded-full bg-orbit-muted animate-pulse [animation-delay:0.4s]" />
    </span>
  );
}
