"use client";

import dynamic from "next/dynamic";

// Dynamic import so the camera-only library never lands in the SSR bundle.
// SAME import specifier as the god-page (DEC-2) so the E24-S1 next/dynamic +
// `@yudiel/react-qr-scanner` mock keeps intercepting it.
const QrScanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((m) => m.Scanner),
  { ssr: false }
);

interface CheckInScannerProps {
  onScan: (rawValue: string) => void;
  onError: () => void;
}

/**
 * Thin wrapper around the dynamic QR scanner (E24-S3). Holds the SSR-guarded
 * dynamic import in the slice and adapts the library's array `onScan` payload to
 * the single-token callback the check-in root expects — reproducing the
 * god-page's inline `onScan={(detected) => detected[0]?.rawValue && ...}` exactly.
 */
export function CheckInScanner({ onScan, onError }: CheckInScannerProps) {
  return (
    <QrScanner
      onScan={(detected: { rawValue: string }[]) => {
        if (detected[0]?.rawValue) onScan(detected[0].rawValue);
      }}
      onError={onError}
      constraints={{ facingMode: "environment" }}
    />
  );
}
