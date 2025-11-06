'use client';

import { useEffect, useRef } from 'react';
import type { Html5QrcodeScanner, QrCodeSuccessCallback, QrCodeErrorCallback } from 'html5-qrcode';

interface QrScannerProps {
  onScanSuccess: QrCodeSuccessCallback;
  onScanFailure: QrCodeErrorCallback;
}

export function QrScanner({ onScanSuccess, onScanFailure }: QrScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Dynamically import the library
    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      // Check if a scanner instance already exists to avoid re-initialization
      if (!scannerRef.current) {
        const scanner = new Html5QrcodeScanner(
          'qr-reader', // ID of the div element
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              const qrboxSize = Math.floor(minEdge * 0.8);
              return { width: qrboxSize, height: qrboxSize };
            },
            supportedScanTypes: [], // Use all supported scan types
          },
          false // verbose
        );

        scanner.render(onScanSuccess, onScanFailure);
        scannerRef.current = scanner;
      }
    });

    // Cleanup function to stop the scanner on component unmount
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear html5-qrcode scanner.", error);
        });
        scannerRef.current = null;
      }
    };
  }, [onScanSuccess, onScanFailure]);

  return <div id="qr-reader" style={{ width: '100%', minHeight: '300px' }}></div>;
}
