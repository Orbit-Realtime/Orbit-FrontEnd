export default function ReconnectBanner({ connected, reconnecting }) {
  if (connected) return null;
  return (
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
  );
}
