import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { CANVAS_VIEW_STORAGE_KEY } from "@/components/voice-canvas/canvasViewPreference";
import "@xyflow/react/dist/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice Canvas",
  description: "A visual workspace for live agent collaboration.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const restoreCanvasView = `(function(){try{if(sessionStorage.getItem(${JSON.stringify(CANVAS_VIEW_STORAGE_KEY)})==='canvas_only'){document.documentElement.dataset.canvasView='canvas_only'}}catch(_){}})();`;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="restore-canvas-view" strategy="beforeInteractive">
          {restoreCanvasView}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
