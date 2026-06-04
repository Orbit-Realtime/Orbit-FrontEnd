import { useEffect, useState } from "react";

export function useWsErrorBanner() {
  const [wsError, setWsError] = useState(null);

  useEffect(() => {
    if (!wsError) return;
    const timer = setTimeout(() => setWsError(null), 4000);
    return () => clearTimeout(timer);
  }, [wsError]);

  return { wsError, setWsError };
}
