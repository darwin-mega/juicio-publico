"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function OfflineNotice() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const updateNetworkState = () => setIsOffline(!navigator.onLine);

    updateNetworkState();
    window.addEventListener("online", updateNetworkState);
    window.addEventListener("offline", updateNetworkState);

    return () => {
      window.removeEventListener("online", updateNetworkState);
      window.removeEventListener("offline", updateNetworkState);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="offline-notice" role="status">
      <div className="offline-notice-copy">
        <span className="offline-notice-kicker">Sin conexion</span>
        <span className="offline-notice-text">
          Podes jugar igual en modo mesa desde este dispositivo.
        </span>
      </div>

      <Link className="offline-notice-action" href="/setup">
        Mesa
      </Link>
    </div>
  );
}
