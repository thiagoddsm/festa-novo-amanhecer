'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, type QrCodeSuccessCallback, type QrCodeErrorCallback } from 'html5-qrcode';
import { useToast } from '@/hooks/use-toast';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure: (error: string) => void;
  onTorchToggle?: (torchOn: boolean) => void;
  torchOn?: boolean;
}

export function QrScanner({ onScanSuccess, onScanFailure, onTorchToggle, torchOn }: QrScannerProps) {
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (torchOn !== undefined && qrCodeRef.current && isCameraStarted && videoRef.current) {
        // Access the video stream directly from the video element
        const videoElement = videoRef.current.querySelector('video');
        if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject as MediaStream;
            const videoTrack = stream.getVideoTracks()?.[0];
            
            if (videoTrack) {
                const capabilities = videoTrack.getCapabilities();
                if ('torch' in capabilities) {
                    videoTrack.applyConstraints({ advanced: [{ torch: torchOn }] })
                        .then(() => onTorchToggle?.(torchOn))
                        .catch(err => {
                            console.error("Error applying torch constraint:", err);
                             toast({
                                variant: 'destructive',
                                title: 'Erro na Lanterna',
                                description: 'Não foi possível controlar a lanterna.'
                            })
                        });
                } else {
                     console.warn('Torch/Flashlight not supported by this camera.');
                }
            }
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torchOn, isCameraStarted]);

  useEffect(() => {
    if (!videoRef.current) return;

    // Use the lower-level Html5Qrcode class
    const html5QrCode = new Html5Qrcode(videoRef.current.id, { verbose: false });
    qrCodeRef.current = html5QrCode;

    const successCallback: QrCodeSuccessCallback = (decodedText) => {
      onScanSuccess(decodedText);
    };

    const errorCallback: QrCodeErrorCallback = (error) => {
      // Don't spam failures
    };

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };
    
    // Start scanning
    html5QrCode.start(
        { facingMode: 'environment' }, // Default to back camera
        config,
        successCallback,
        errorCallback
    ).then(() => {
        setIsCameraStarted(true);
    }).catch(err => {
        console.error("Camera start error:", err);
        // Fallback for devices that don't support 'environment'
        if (String(err).includes('OverconstrainedError')) {
             html5QrCode.start(
                { }, // Let the browser decide which camera
                config,
                successCallback,
                errorCallback
             ).then(() => setIsCameraStarted(true))
             .catch(finalErr => onScanFailure(finalErr.message || 'Não foi possível iniciar a câmera.'));
        } else {
             onScanFailure(err.message || 'Não foi possível iniciar a câmera.');
        }
    });

    // Cleanup on unmount
    return () => {
      setIsCameraStarted(false);
      if (qrCodeRef.current?.isScanning) {
        qrCodeRef.current.stop().catch(err => console.error("Failed to stop QR scanner", err));
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div id="qr-reader-element" ref={videoRef} className="w-full"></div>;
}
