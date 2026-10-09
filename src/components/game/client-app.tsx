"use client";

import dynamic from "next/dynamic";

// The game lives in the browser (saved leagues, peer connections), so skip server rendering.
export const ClientApp = dynamic(() => import("./app").then(m => m.App), {
  ssr: false,
  loading: () => <p className="py-24 text-center text-muted-foreground">Loading…</p>,
});
