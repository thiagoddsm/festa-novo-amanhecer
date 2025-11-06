'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, type QrCodeSuccessCallback, type QrCodeErrorCallback } from 'html5-qrcode';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure: (error: string) => void;
  cameraId: string;
}

const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
    const qrboxSize = Math.floor(minEdge * 0.8);
    return {
        width: qrboxSize,
        height: qrboxSize,
    };
}

export function QrScanner({ onScanSuccess, onScanFailure, cameraId }: QrScannerProps) {
  const qrCodeReaderId = "qr-reader";
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const cleanup = useCallback(() => {
    if (html5QrCodeRef.current?.isScanning) {
        html5QrCodeRef.current.stop().catch(err => {
            console.error("Falha ao parar o scanner.", err);
        });
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initialize the scanner instance if it doesn't exist
    if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(qrCodeReaderId, { verbose: false });
    }
    
    const qrCode = html5QrCodeRef.current;

    const successCallback: QrCodeSuccessCallback = (decodedText, decodedResult) => {
        cleanup(); // Stop scanning on success
        onScanSuccess(decodedText);
    };

    const errorCallback: QrCodeErrorCallback = (errorMessage) => {
        onScanFailure(errorMessage);
    };

    const config = { 
        fps: 10, 
        qrbox: qrboxFunction,
        formatsToSupport: [0], // 0 = QR_CODE
    };

    // Stop any existing scanner before starting a new one
    if (qrCode.isScanning) {
        qrCode.stop().then(() => {
             qrCode.start(cameraId, config, successCallback, errorCallback)
                .catch((err) => {
                    onScanFailure("Não foi possível iniciar o scanner na câmera selecionada.");
                });
        }).catch(err => console.error("Error stopping previous scan:", err));
    } else {
        qrCode.start(cameraId, config, successCallback, errorCallback)
            .catch((err) => {
                onScanFailure("Não foi possível iniciar o scanner. Verifique as permissões da câmera.");
            });
    }

    // Cleanup function to stop the scanner on component unmount
    return () => {
      cleanup();
    };
  }, [cameraId, onScanSuccess, onScanFailure, cleanup]);

  return <div id={qrCodeReaderId} style={{ width: '100%', height: '100%' }}></div>;
}
