'use client';

import { useEffect, useRef, useState } from 'react';
import { 
  CameraOff, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  Camera, 
  Settings2, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Star 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: string) => void;
}

type CameraInfo = { id: string; label: string };

const CAMERA_STORAGE_KEY = 'festapay_camera_id';

// Lenses we never want as default (ultra-wide 0.5x, macro, depth, telephoto...)
const BAD_LENS_REGEX = /ultra|wide|0\.5|grande|macro|depth|profundidade|tele|zoom|infra|ir\b|mono/i;
const BACK_REGEX = /back|rear|traseir|environment|principal|main/i;
const FRONT_REGEX = /front|user|selfie|frontal/i;

function isFrontCamera(cam: CameraInfo) {
  return FRONT_REGEX.test(cam.label) && !BACK_REGEX.test(cam.label);
}

/**
 * Orders cameras so that index 0 is the best default for scanning QR codes:
 * main back lens (1x) > other back lenses > front camera > ultra-wide / macro.
 */
function sortCameras(cameras: CameraInfo[]): CameraInfo[] {
  const score = (cam: CameraInfo) => {
    const label = cam.label || '';
    let s = 0;
    if (BAD_LENS_REGEX.test(label)) s -= 100;
    if (isFrontCamera(cam)) s -= 30;
    else if (BACK_REGEX.test(label)) s += 50;
    // Labels like "camera2 0, facing back" (Android): prefer lowest index = main lens
    const idx = label.match(/camera2?\s*(\d+)/i);
    if (idx) s -= Number(idx[1]);
    return s;
  };
  return [...cameras].sort((a, b) => score(b) - score(a));
}

function cameraDisplayName(cam: CameraInfo) {
  if (isFrontCamera(cam)) return 'Câmera frontal';
  if (BAD_LENS_REGEX.test(cam.label)) return 'Câmera grande angular (0.5x)';
  return 'Câmera traseira';
}

function getCameraLabelDetails(cam: CameraInfo, index: number, allCameras: CameraInfo[]) {
  const raw = (cam.label || '').trim();
  const lower = raw.toLowerCase();
  
  const isFront = isFrontCamera(cam);
  const isWide = BAD_LENS_REGEX.test(lower);
  
  let friendlyName = '';
  let badge = '';
  let isBest = false;

  if (isFront) {
    friendlyName = `Câmera Frontal (Selfie)`;
  } else if (isWide) {
    friendlyName = `Câmera Grande Angular (0.5x)`;
    badge = 'Lente aberta / sem foco próximo';
  } else {
    // Check if it's the primary back lens
    if (index === 0 || lower.includes('camera2 0') || lower.includes('back 0') || lower.includes('main') || lower.includes('principal')) {
      friendlyName = `Lente Traseira Principal (1x)`;
      badge = '⭐ Recomendada';
      isBest = true;
    } else {
      friendlyName = `Lente Traseira #${index + 1}`;
    }
  }

  return {
    friendlyName,
    rawLabel: raw || `Câmera ${index + 1}`,
    badge,
    isBest
  };
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

function readSavedCameraId(): string | null {
  try {
    return localStorage.getItem(CAMERA_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveCameraId(id: string) {
  try {
    localStorage.setItem(CAMERA_STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

export function QrScanner({ onScanSuccess, onScanFailure }: QrScannerProps) {
  const [status, setStatus] = useState<'INITIALIZING' | 'SCANNING' | 'SUCCESS' | 'ERROR'>('INITIALIZING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [savedCameraId, setSavedCameraId] = useState<string | null>(null);
  const [showCameraList, setShowCameraList] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const containerIdRef = useRef(`qr-reader-${Math.random().toString(36).substring(2, 9)}`);
  const scannerInstanceRef = useRef<any>(null);
  const transitionPromiseRef = useRef<Promise<any> | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const scannedRef = useRef<boolean>(false);
  const camerasRef = useRef<CameraInfo[]>([]);
  const activeCameraIdRef = useRef<string | null>(null);

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

  /**
   * Enumerates cameras (once) and decides which one to open:
   * 1) explicit request, 2) last camera chosen by the user (saved), 3) best back camera,
   * 4) fallback to facingMode: environment.
   */
  const resolveCamera = async (Html5Qrcode: any, requestedId?: string): Promise<string | { facingMode: string }> => {
    let list = camerasRef.current;
    if (list.length === 0) {
      try {
        const found: CameraInfo[] = await Html5Qrcode.getCameras();
        if (found && found.length > 0) {
          list = sortCameras(found);
          camerasRef.current = list;
          if (isMountedRef.current) setCameras(list);
        }
      } catch (e) {
        // Ignore camera enumeration failure
      }
    }

    if (requestedId && list.some((c) => c.id === requestedId)) return requestedId;

    const saved = readSavedCameraId();
    if (saved && list.some((c) => c.id === saved)) return saved;

    if (list.length > 0) {
      // Labels are empty before permission is granted; sortCameras still keeps a stable order
      const best = list.find((c) => !BAD_LENS_REGEX.test(c.label) && !isFrontCamera(c)) || list[0];
      return best.id;
    }

    return { facingMode: 'environment' };
  };

  const startScanning = async (requestedId?: string) => {
    try {
      setStatus('INITIALIZING');
      setErrorMessage(null);

      await stopCurrentScanner();

      if (!isMountedRef.current) return;

      const container = document.getElementById(containerIdRef.current);
      if (!container) return;

      const { Html5Qrcode } = await import('html5-qrcode');
      if (!isMountedRef.current) return;

      const cameraIdOrConfig = await resolveCamera(Html5Qrcode, requestedId);
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
        const usedId = typeof cameraIdOrConfig === 'string' ? cameraIdOrConfig : null;
        activeCameraIdRef.current = usedId;
        setActiveCameraId(usedId);
        setStatus('SCANNING');

        // Camera labels only become available after permission is granted: re-sort now
        try {
          const refreshed: CameraInfo[] = await Html5Qrcode.getCameras();
          if (refreshed && refreshed.length > 0 && isMountedRef.current) {
            const sorted = sortCameras(refreshed);
            camerasRef.current = sorted;
            setCameras(sorted);
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        const msg = String(err?.message || err || '');
        if (msg.includes('already under transition')) {
          // Benign race condition, ignore
          return;
        }

        // If a saved/selected camera no longer works, forget it and retry once with the default
        if (requestedId === undefined && readSavedCameraId()) {
          try {
            localStorage.removeItem(CAMERA_STORAGE_KEY);
          } catch {
            // ignore
          }
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
    setSavedCameraId(readSavedCameraId());

    // Small timeout ensures the Dialog DOM is fully mounted
    const timer = setTimeout(() => {
      startScanning();
    }, 120);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      stopCurrentScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  
  const handleSelectCamera = async (id: string) => {
    saveCameraId(id);
    setSavedCameraId(id);
    setSaveFeedback('Câmera salva como principal para este aparelho!');
    setTimeout(() => {
      if (isMountedRef.current) setSaveFeedback(null);
    }, 3000);
    await startScanning(id);
  };

  const handleSwitchCamera = async () => {
    const list = camerasRef.current;
    if (list.length < 2) return;
    const currentIndex = Math.max(0, list.findIndex((c) => c.id === activeCameraIdRef.current));
    const next = list[(currentIndex + 1) % list.length];
    saveCameraId(next.id);
    setSavedCameraId(next.id);
    setSaveFeedback(`Alternada para ${cameraDisplayName(next)} e salva!`);
    setTimeout(() => {
      if (isMountedRef.current) setSaveFeedback(null);
    }, 2500);
    await startScanning(next.id);
  };


  const handleRetry = async () => {
    scannedRef.current = false;
    await startScanning();
  };

  const activeCamera = cameras.find((c) => c.id === activeCameraId);

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

      {/* Camera Selection & Main Camera Setting */}
      {cameras.length > 0 && status === 'SCANNING' && (
        <div className="w-full max-w-[280px] sm:max-w-[320px] mt-3 space-y-2">
          {/* Active Camera Pill & Action Trigger */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-muted/60 border border-border/80 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0 text-left">
                <span className="font-bold text-foreground text-xs truncate">
                  {activeCamera ? getCameraLabelDetails(activeCamera, cameras.findIndex(c => c.id === activeCamera.id), cameras).friendlyName : 'Câmera Ativa'}
                </span>
                <span className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                  {savedCameraId && savedCameraId === activeCameraId ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 fill-current" /> Principal salva neste celular
                    </span>
                  ) : (
                    <span>Câmera temporária (não salva)</span>
                  )}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCameraList(!showCameraList)}
              className="h-7 px-2.5 text-xs font-semibold shrink-0 gap-1 bg-background hover:bg-muted"
            >
              <Settings2 className="w-3.5 h-3.5 text-primary" />
              <span>{showCameraList ? 'Fechar' : 'Trocar'}</span>
              {showCameraList ? <ChevronUp className="w-3 h-3 opacity-60" /> : <ChevronDown className="w-3 h-3 opacity-60" />}
            </Button>
          </div>

          {/* Feedback banner when saved */}
          {saveFeedback && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium animate-in fade-in slide-in-from-top-1">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{saveFeedback}</span>
            </div>
          )}

          {/* Collapsible List of all available cameras on device */}
          {showCameraList && (
            <div className="p-2.5 rounded-xl border border-primary/20 bg-background/95 shadow-md space-y-2 animate-in fade-in zoom-in-95 text-left">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-foreground">
                  Câmeras do Aparelho:
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {cameras.length} {cameras.length === 1 ? 'encontrada' : 'encontradas'}
                </span>
              </div>

              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                {cameras.map((cam, idx) => {
                  const details = getCameraLabelDetails(cam, idx, cameras);
                  const isActive = cam.id === activeCameraId;
                  const isSaved = cam.id === savedCameraId;

                  return (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => handleSelectCamera(cam.id)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2.5 ${
                        isActive
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                          : 'border-border/60 hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold truncate">
                            {details.friendlyName}
                          </span>
                          {details.isBest && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                              Ideal QR
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {details.rawLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isSaved ? (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-current" /> Principal
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground hover:text-foreground">
                            {isActive ? 'Definir principal' : 'Usar'}
                          </span>
                        )}
                        {isActive && (
                          <Check className="w-4 h-4 text-primary" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {cameras.length > 1 && (
                <div className="pt-1 flex items-center justify-between border-t border-border/50 text-[10px] text-muted-foreground px-1">
                  <span>Toque para usar e salvar como principal.</span>
                  <button
                    type="button"
                    onClick={handleSwitchCamera}
                    className="text-primary hover:underline font-semibold flex items-center gap-1"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Próxima
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
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
