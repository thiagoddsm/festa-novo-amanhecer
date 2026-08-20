
'use client';

import { useEffect, useRef } from 'react';
import type { Html5QrcodeScanner } from 'html5-qrcode';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure: (error: string) => void;
}

// This is the core scanner component that interacts with the camera
export function QrScanner({ onScanSuccess, onScanFailure }: QrScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Dynamically import the library only on the client-side
    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      if (!scannerRef.current) {
        const scanner = new Html5QrcodeScanner(
          'qr-reader', // The ID of the div to render the scanner in
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [], // Use all available scan types
          },
          false // Verbose logging
        );

        const successCallback = (decodedText: string, decodedResult: any) => {
          // Wrap in a try-catch in case onScanSuccess throws an error
          try {
            onScanSuccess(decodedText);
          } catch (e) {
            console.error('Error in onScanSuccess callback:', e);
          }
          // Stop scanning after a success
          if (scannerRef.current) {
            scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
          }
        };

        const errorCallback = (error: string) => {
          // This callback is called frequently, so we only log/handle significant errors
          // It's common for it to fire when no QR code is in view.
           onScanFailure(error);
        };
        
        // Start scanning. It will request camera permissions.
        try {
          scanner.render(successCallback, errorCallback);
        } catch (err: any) {
          console.error("Error rendering scanner:", err);
          onScanFailure(err.message || 'Failed to render scanner.');
        }
          
        scannerRef.current = scanner;
      }

      // Cleanup function to stop the scanner when the component unmounts
      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch(err => {
            console.error("Failed to clear scanner on unmount:", err);
          });
          scannerRef.current = null;
        }
      };
    }).catch(err => {
        console.error("Failed to load html5-qrcode library", err);
        onScanFailure('Failed to load scanning library.');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on component mount

  return (
    // This div is where the html5-qrcode library will mount the camera view
    <div id="qr-reader" className="w-full"></div>
  );
}

