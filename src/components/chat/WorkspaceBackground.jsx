export default function WorkspaceBackground() {
  return (
    <>
      <div className="orbit-vignette" aria-hidden="true" />
      <div className="orbit-arc-overlay" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          style={{ pointerEvents: 'none' }}
        >
          {/* Arc 1: 주 궤도 — 좌상단 밖 중심, 상단(949,0)→좌측(0,594) */}
          <circle
            cx="100" cy="-300" r="900"
            fill="none" stroke="rgba(67,217,255,0.045)" strokeWidth="1"
          />
          {/* Arc 2: 역방향 궤도 — 우상단 밖 중심, 상단(534,0)→우측(1440,664) */}
          <circle
            cx="1340" cy="-150" r="820"
            fill="none" stroke="rgba(67,217,255,0.03)" strokeWidth="0.8"
          />
          {/* Arc 3: 블루 하단 궤도 — 우하단 밖 중심, 우측(1440,50)→하단(608,900) */}
          <circle
            cx="1580" cy="1020" r="980"
            fill="none" stroke="rgba(59,130,246,0.025)" strokeWidth="0.8"
          />
          {/* Arc 4: 천정 호 — 뷰포트 위 중앙 중심, 상단에 완만한 호 */}
          <circle
            cx="720" cy="-580" r="660"
            fill="none" stroke="rgba(67,217,255,0.02)" strokeWidth="0.6"
          />
        </svg>
      </div>
    </>
  );
}
