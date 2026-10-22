'use client';

import { useEffect, useRef, useState } from 'react';
import { CameraOff, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: string) => void;
}

// Sound feedback on successful scan
function playBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    // Harmless audio restriction ignore
  }
}

// Haptic feedback
function triggerVibration() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([100]);
    }
  } catch (e) {
    // Harmless ignore
  }
}

export function QrScanner({ onScanSuccess, onScanFailure }: QrScannerProps) {
  const [status, setStatus] = useState<'INITIALIZING' | 'SCANNING' | 'SUCCESS' | 'ERROR'>('INITIALIZING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState<number>(0);

  const containerIdRef = useRef(`qr-reader-${Math.random().toString(36).substring(2, 9)}`);
  const scannerInstanceRef = useRef<any>(null);
  const transitionPromiseRef = useRef<Promise<any> | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const scannedRef = useRef<boolean>(false);

  const stopCurrentScanner = async () => {
    // 1. Wait for any ongoing start/stop transition to complete
    if (transitionPromiseRef.current) {
      try {
        await transitionPromiseRef.current;
      } catch (e) {
        // Ignore error from aborted transition
      }
    }

    // 2. Stop and clear if running
    if (scannerInstanceRef.current) {
      try {
        const state = scannerInstanceRef.current.getState?.();
        if (state === 2 /* SCANNING */ || state === 3 /* PAUSED */) {
          const stopPromise = scannerInstanceRef.current.stop();
          transitionPromiseRef.current = stopPromise;
          await stopPromise;
        }
      } catch (err) {
        // Harmless ignore
      } finally {
        transitionPromiseRef.current = null;
      }

      try {
        scannerInstanceRef.current.clear();
      } catch (err) {
        // Harmless ignore
      }
      scannerInstanceRef.current = null;
    }
  };

  const startScanning = async (cameraIdOrConfig: any) => {
    try {
      setStatus('INITIALIZING');
      setErrorMessage(null);

      await stopCurrentScanner();

      if (!isMountedRef.current) return;

      const container = document.getElementById(containerIdRef.current);
      if (!container) return;

      const { Html5Qrcode } = await import('html5-qrcode');
      if (!isMountedRef.current) return;

      // Discover cameras if not yet done
      try {
        const availableCameras = await Html5Qrcode.getCameras();
        if (isMountedRef.current && availableCameras && availableCameras.length > 0) {
          setCameras(availableCameras);
        }
      } catch (e) {
        // Ignore camera enumeration failure
      }

      if (!isMountedRef.current) return;

      const scanner = new Html5Qrcode(containerIdRef.current);
      scannerInstanceRef.current = scanner;

      const qrConfig = {
        fps: 12,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
          return { width: Math.max(edge, 160), height: Math.max(edge, 160) };
        },
        aspectRatio: 1.0,
      };

      const handleSuccess = (decodedText: string) => {
        if (scannedRef.current) return;
        scannedRef.current = true;

        playBeep();
        triggerVibration();
        setStatus('SUCCESS');

        setTimeout(() => {
          if (isMountedRef.current) {
            onScanSuccess(decodedText.trim());
          }
        }, 300);
      };

      const handleError = (error: string) => {
        if (onScanFailure && !error.includes('No QR code found') && !error.includes('NotFoundException')) {
          onScanFailure(error);
        }
      };

      const startPromise = scanner.start(
        cameraIdOrConfig,
        qrConfig,
        handleSuccess,
        handleError
      );

      transitionPromiseRef.current = startPromise;
      await startPromise;

      if (isMountedRef.current) {
        setStatus('SCANNING');
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        const msg = String(err?.message || err || '');
        if (msg.includes('already under transition')) {
          // Benign race condition, ignore
          return;
        }

        setStatus('ERROR');
        if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
          setErrorMessage('Permissão da câmera foi negada. Permita o acesso à câmera no seu navegador.');
        } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
          setErrorMessage('Nenhuma câmera foi encontrada no seu dispositivo.');
        } else {
          setErrorMessage('Não foi possível iniciar a câmera. Verifique as permissões ou digite o código do cartão.');
        }
      }
    } finally {
      transitionPromiseRef.current = null;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    scannedRef.current = false;

    // Small timeout ensures the Dialog DOM is fully mounted
    const timer = setTimeout(() => {
      startScanning({ facingMode: 'environment' });
    }, 120);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      stopCurrentScanner();
    };
  }, []);

  const handleSwitchCamera = async () => {
    if (cameras.length < 2) return;
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    await startScanning(cameras[nextIndex].id);
  };

  const handleRetry = async () => {
    scannedRef.current = false;
    await startScanning({ facingMode: 'environment' });
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Scanner Viewport */}
      <div className="relative aspect-square w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-2xl bg-zinc-900 border-2 border-primary/20 shadow-lg">
        {/* Dynamic unique container ID */}
        <div 
          id={containerIdRef.current} 
          className="w-full h-full object-cover [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
        />

        {/* Viewfinder Overlay */}
        {(status === 'SCANNING' || status === 'SUCCESS') && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div 
              className={`relative w-44 h-44 sm:w-52 sm:h-52 rounded-2xl transition-all duration-300 ${
                status === 'SUCCESS' 
                  ? 'border-4 border-emerald-500 bg-emerald-500/20 scale-105 shadow-[0_0_24px_rgba(16,185,129,0.5)]' 
                  : 'border-2 border-white/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]'
              }`}
            >
              {/* 4 Glowing Corner Accents */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />

              {/* Animated laser line */}
              {status === 'SCANNING' && (
                <div 
                  className="absolute inset-x-2 h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_8px_hsl(var(--primary))]"
                  style={{
                    animation: 'scanLaser 2.2s ease-in-out infinite alternate',
                  }}
                />
              )}

              {/* Success Badge */}
              {status === 'SUCCESS' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-emerald-400 bg-emerald-950/60 rounded-xl backdrop-blur-xs animate-in zoom-in-75 duration-200">
                  <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
                  <span className="font-bold text-sm text-white">Cartão Lido!</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top Floating Badge */}
        {status === 'SCANNING' && (
          <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
            <span className="bg-black/70 text-white text-xs px-3 py-1 rounded-full backdrop-blur-md font-medium tracking-wide shadow-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Posicione o QR Code no quadrado
            </span>
          </div>
        )}

        {/* Initializing State */}
        {status === 'INITIALIZING' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900 text-zinc-300 p-6 text-center">
            <Loader2 className="w-9 h-9 animate-spin text-primary" />
            <p className="text-sm font-medium">Iniciando a câmera...</p>
            <p className="text-xs text-zinc-500">Se solicitado, autorize o acesso à câmera.</p>
          </div>
        )}

        {/* Error State */}
        {status === 'ERROR' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900 text-zinc-200 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
              <CameraOff className="w-6 h-6" />
            </div>
            <p className="text-xs sm:text-sm text-zinc-300 leading-snug">
              {errorMessage || 'Não foi possível acessar a câmera.'}
            </p>
            <Button size="sm" variant="outline" onClick={handleRetry} className="gap-1.5 mt-1 border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700">
              <RefreshCw className="w-3.5 h-3.5" /> Tentar Novamente
            </Button>
          </div>
        )}
      </div>

      {/* Switch Camera Button (Visible if 2+ cameras found) */}
      {cameras.length > 1 && status === 'SCANNING' && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSwitchCamera}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Alternar Câmera
        </Button>
      )}

      {/* Keyframe animation for scanning laser */}
      <style jsx>{`
        @keyframes scanLaser {
          0% { top: 10%; opacity: 0.3; }
          50% { opacity: 1; }
          100% { top: 88%; opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
