"use client";

import dynamic from "next/dynamic";

/** Three.js tarayıcı API'lerine ihtiyaç duyar; sahne yalnızca istemcide yüklenir. */
const Scene3D = dynamic(() => import("./Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center" role="status">
      <span className="size-9 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
      <span className="sr-only">3B sahne hazırlanıyor</span>
    </div>
  ),
});

export function CanvasContainer() {
  return (
    <div className="absolute inset-0 touch-none">
      <Scene3D />
    </div>
  );
}
