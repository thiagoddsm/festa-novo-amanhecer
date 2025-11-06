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

  // Function to apply torch constraint
  const applyTorch = async (torch: boolean) => {
    if (qrCodeRef.current && isCameraStarted) {
      try {
        const stream = await qrCodeRef.current.getRunningTrack();
        if (stream) {
          const videoTrack = stream.getVideoTracks()[0];
          // Check if torch capability is supported
          const capabilities = videoTrack.getCapabilities();
          if ('torch' in capabilities) {
            await videoTrack.applyConstraints({
              advanced: [{ torch }],
            });
            onTorchToggle?.(torch);
          } else {
            console.warn('Torch/Flashlight not supported by this camera.');
            toast({
                variant: 'destructive',
                title: 'Lanterna não suportada',
                description: 'Este dispositivo não parece ter uma lanterna controlável.'
            })
          }
        }
      } catch (error) {
        console.error('Failed to toggle torch', error);
        onScanFailure('Falha ao controlar a lanterna.');
      }
    }
  };

  useEffect(() => {
    if (torchOn !== undefined && qrCodeRef.current && isCameraStarted) {
        // Find the currently active video track
        const videoTrack = qrCodeRef.current.getRunningTrack()?.getVideoTracks()?.[0];
        if (videoTrack) {
            const capabilities = videoTrack.getCapabilities();
             if ('torch' in capabilities) {
                videoTrack.applyConstraints({ advanced: [{ torch: torchOn }] })
                    .catch(err => console.error("Error applying torch constraint:", err));
             }
        }
    }
  }, [torchOn, isCameraStarted]);

  useEffect(() => {
    if (!videoRef.current) return;

    // Use the lower-level Html5Qrcode class
    const html5QrCode = new Html5Qrcode('qr-reader-element', { verbose: false });
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
