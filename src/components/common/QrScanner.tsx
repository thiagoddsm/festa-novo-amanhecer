'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, type QrCodeSuccessCallback, type QrCodeErrorCallback, type CameraDevice } from 'html5-qrcode';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure: (error: string) => void;
  cameraId: string;
  torchOn: boolean;
}

export function QrScanner({ onScanSuccess, onScanFailure, cameraId, torchOn }: QrScannerProps) {
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const cleanupCalled = useRef(false);

  // Use useCallback for cleanup to ensure it has a stable identity
  const cleanup = useCallback(() => {
    if (cleanupCalled.current) return;
    cleanupCalled.current = true;
    
    const html5QrCode = qrCodeRef.current;
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => {
            console.error("Falha ao parar o leitor de QR code.", err);
        });
    }
  }, []);

  useEffect(() => {
    if (!videoRef.current || !cameraId) return;

    // Ensure we are cleaned up before starting a new session
    cleanupCalled.current = false;
    
    // Use the lower-level Html5Qrcode class
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
        const videoTrack = html5QrCode.getRunningTrack();
        if (videoTrack) {
             const capabilities = videoTrack.getCapabilities();
             if (capabilities.torch) {
                videoTrack.applyConstraints({ advanced: [{ torch: torchOn }]})
                    .catch(err => console.error("Erro ao aplicar a lanterna", err));
             }
        }
    }).catch(err => {
        onScanFailure(err.message || 'Não foi possível iniciar a câmera.');
    });

    // Cleanup on unmount
    return () => {
        cleanup();
    };
  }, [cameraId, onScanSuccess, onScanFailure, cleanup]);


  useEffect(() => {
     if (qrCodeRef.current && qrCodeRef.current.isScanning) {
        const videoTrack = qrCodeRef.current.getRunningTrack();
        if (videoTrack) {
            const capabilities = videoTrack.getCapabilities();
            if (capabilities.torch) {
                videoTrack.applyConstraints({ advanced: [{ torch: torchOn }]});
            }
        }
     }
  }, [torchOn]);

  return <div id="qr-reader-element" ref={videoRef} className="w-full h-full"></div>;
}
