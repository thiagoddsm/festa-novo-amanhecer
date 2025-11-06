'use client';

import { useEffect, useRef } from 'react';
import { Html5Qrcode, type QrCodeSuccessCallback, type QrCodeErrorCallback } from 'html5-qrcode';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure: (error: string) => void;
  cameraId: string;
  torchOn: boolean;
}

export function QrScanner({ onScanSuccess, onScanFailure, cameraId, torchOn }: QrScannerProps) {
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  // This ref helps prevent multiple cleanup calls
  const cleanupCalled = useRef(false);

  useEffect(() => {
    if (!videoRef.current || !cameraId) return;

    // Reset cleanup flag for this new effect run
    cleanupCalled.current = false;
    
    const html5QrCode = new Html5Qrcode(videoRef.current.id, { verbose: false });
    qrCodeRef.current = html5QrCode;

    const successCallback: QrCodeSuccessCallback = (decodedText) => {
        onScanSuccess(decodedText);
    };

    const errorCallback: QrCodeErrorCallback = (error) => {
      // Don't spam failures for non-found codes
    };

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };
    
    html5QrCode.start(
        cameraId,
        config,
        successCallback,
        errorCallback
    ).then(() => {
        // Torch can be applied only after the camera starts
        if (qrCodeRef.current && qrCodeRef.current.isScanning) {
            const videoTrack = html5QrCode.getRunningTrack();
            if (videoTrack) {
                const capabilities = videoTrack.getCapabilities();
                if (capabilities.torch) {
                    videoTrack.applyConstraints({ advanced: [{ torch: torchOn }]})
                        .catch(err => console.error("Erro ao aplicar a lanterna na inicialização", err));
                }
            }
        }
    }).catch(err => {
        onScanFailure(err.message || 'Não foi possível iniciar a câmera.');
    });

    // Cleanup function to be called on unmount
    const cleanup = () => {
      if (cleanupCalled.current) return;
      cleanupCalled.current = true;

      const codeReader = qrCodeRef.current;
      if (codeReader && codeReader.isScanning) {
        codeReader.stop().catch(err => {
          console.error("Falha ao parar o leitor de QR code.", err);
        });
      }
    };

    return cleanup;

  }, [cameraId, onScanSuccess, onScanFailure]);


  // Separate effect to handle torch toggling while camera is running
  useEffect(() => {
     if (qrCodeRef.current && qrCodeRef.current.isScanning) {
        const videoTrack = qrCodeRef.current.getRunningTrack();
        if (videoTrack) {
            const capabilities = videoTrack.getCapabilities();
            if (capabilities.torch) {
                videoTrack.applyConstraints({ advanced: [{ torch: torchOn }]})
                    .catch(err => console.error("Erro ao alternar a lanterna", err));
            }
        }
     }
  }, [torchOn]);

  return <div id="qr-reader-element" ref={videoRef} className="w-full h-full"></div>;
}
