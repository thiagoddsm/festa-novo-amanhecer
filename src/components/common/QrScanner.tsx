'use client';

import { useEffect, useRef } from 'react';
import { Html5Qrcode, type QrCodeSuccessCallback, type QrCodeErrorCallback } from 'html5-qrcode';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure: (error: string) => void;
  /**
   * This prop is retained for potential future use but is not actively used
   * in this simplified implementation.
   */
  cameraId?: string;
}

const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
    const qrboxSize = Math.floor(minEdge * 0.8);
    return {
        width: qrboxSize,
        height: qrboxSize,
    };
}


export function QrScanner({ onScanSuccess, onScanFailure }: QrScannerProps) {
  const qrCodeReaderId = "qr-reader";
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    // Ensure this runs only on the client
    if (typeof window === 'undefined') {
        return;
    }
      
    // If an instance already exists, it might have been from a previous render.
    // We make sure to clear it before starting a new one.
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.clear().catch(err => {
            console.error("Failed to clear previous scanner instance", err);
        });
    }

    const html5QrCode = new Html5Qrcode(qrCodeReaderId, { verbose: false });
    html5QrCodeRef.current = html5QrCode;

    const successCallback: QrCodeSuccessCallback = (decodedText, decodedResult) => {
        onScanSuccess(decodedText);
        // Stop scanning after a successful scan
        if (html5QrCodeRef.current?.isScanning) {
             html5QrCodeRef.current.stop().catch(err => console.error("Failed to stop scanner after success", err));
        }
    };

    const errorCallback: QrCodeErrorCallback = (errorMessage) => {
        // We only pass "real" errors, not "QR code not found" messages.
        if (!errorMessage.toLowerCase().includes('qr code not found')) {
            onScanFailure(errorMessage);
        }
    };

    // Configuration for the scanner
    const config = { 
        fps: 10, 
        qrbox: qrboxFunction,
        // Only decode QR codes, ignore other formats
        formatsToSupport: [0], // 0 corresponds to QR_CODE
    };
    
    // Start scanning
    html5QrCode.start(
        { facingMode: "environment" }, // Prefer the rear camera
        config,
        successCallback,
        errorCallback
    ).catch((err) => {
        onScanFailure("Não foi possível iniciar o scanner. Verifique as permissões da câmera.");
    });
    
    // Cleanup function to stop the scanner on component unmount
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(err => {
          // This error can happen if the component unmounts quickly.
          // It's generally safe to ignore in this cleanup phase.
          console.log("Scanner stopped.");
        });
      }
    };
  }, [onScanSuccess, onScanFailure]);

  return <div id={qrCodeReaderId} className="w-full h-full"></div>;
}
