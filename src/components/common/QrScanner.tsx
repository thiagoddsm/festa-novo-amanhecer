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

function isIosOrSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isWebKit = /WebKit/i.test(ua) && !/Chrome|CriOS|Edg/i.test(ua);
  const isIPadOS = /Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1;
  return isIOS || isIPadOS || isWebKit;
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
   * Helper that forces video elements created inside the container to have
   * playsinline / webkit-playsinline and muted so iOS Safari won't pause or black-screen it.
   */
  const ensureVideoPlaysInline = () => {
    try {
      const container = document.getElementById(containerIdRef.current);
      if (!container) return;
      const videos = container.querySelectorAll('video');
      videos.forEach((v) => {
        v.setAttribute('playsinline', 'true');
        v.setAttribute('webkit-playsinline', 'true');
        v.setAttribute('muted', 'true');
        v.muted = true;
        v.autoplay = true;
        if (v.paused) {
          v.play().catch(() => {});
        }
      });
    } catch {
      // ignore
    }
  };

  /**
   * Enumerates cameras and decides which one to open:
   * - On iOS / iPhone: Safari handles { facingMode: 'environment' } flawlessly across all lenses,
   *   whereas exact deviceId selection causes black screen in WebKit.
   * - If user explicitly selected a camera, or on Android: uses deviceId.
   */
  const resolveCamera = async (Html5Qrcode: any, requestedId?: string): Promise<string | { facingMode: string }> => {
    const isIos = isIosOrSafari();

    // If an explicit camera was requested by user clicking in the list
    if (requestedId) {
      if (requestedId === 'environment' || requestedId === 'user') {
        return { facingMode: requestedId };
      }
      return requestedId;
    }

    // For iOS by default: always use native environment facingMode (prevents black screen on rear camera)
    if (isIos) {
      const saved = readSavedCameraId();
      if (saved && saved !== 'environment' && saved !== 'user') {
        // If a deviceId was previously saved on iOS, test if it was set explicitly
        // Otherwise prefer environment facingMode
        return { facingMode: 'environment' };
      }
      return { facingMode: 'environment' };
    }

    // Android / Desktop logic:
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

    const saved = readSavedCameraId();
    if (saved && list.some((c) => c.id === saved)) return saved;

    if (list.length > 0) {
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

      // On iOS Safari, forcing aspectRatio constraint with exact deviceId causes OverconstrainedError
      // and black video surfaces. We use responsive qrbox without hardcoded aspect constraints.
      const isIos = isIosOrSafari();
      const qrConfig: any = {
        fps: 12,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
          return { width: Math.max(edge, 160), height: Math.max(edge, 160) };
        },
      };

      if (!isIos) {
        qrConfig.aspectRatio = 1.0;
      } else {
        const facing =
          typeof cameraIdOrConfig === 'object' && (cameraIdOrConfig as any).facingMode === 'user'
            ? 'user'
            : 'environment';
        qrConfig.videoConstraints = { facingMode: { ideal: facing } };
      }

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
        const usedId = typeof cameraIdOrConfig === 'string' 
          ? cameraIdOrConfig 
          : (cameraIdOrConfig as any)?.facingMode || 'environment';

        activeCameraIdRef.current = usedId;
        setActiveCameraId(usedId);
        setStatus('SCANNING');

        // Ensure iOS WebKit playsinline immediately
        ensureVideoPlaysInline();

        // IMPORTANT (iOS): never call getCameras() after the stream starts. It internally calls
        // getUserMedia({video:true}) which on iOS grabs the FRONT camera and kills the rear stream.
        try {
          if (isIosOrSafari()) throw new Error('skip-enumeration-on-ios');
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
          return;
        }

        // Fallback for iOS / Safari if a specific deviceId failed: retry once with facingMode environment
        if (requestedId && requestedId !== 'environment') {
          try {
            localStorage.removeItem(CAMERA_STORAGE_KEY);
            await startScanning('environment');
            return;
          } catch {
            // continue to error screen
          }
        }

        if (requestedId === undefined && readSavedCameraId()) {
          try {
            localStorage.removeItem(CAMERA_STORAGE_KEY);
          } catch {
            // ignore
          }
        }

        setStatus('ERROR');
        if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
          setErrorMessage('Permissão da câmera foi negada. Permita o acesso à câmera no seu navegador (Ajustes > Safari > Câmera).');
        } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
          setErrorMessage('Nenhuma câmera foi encontrada no seu dispositivo.');
        } else {
          setErrorMessage('Não foi possível iniciar a câmera traseira. Toque em "Tentar Novamente" ou digite o código do cartão.');
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
    const isIos = isIosOrSafari();
    if (isIos) {
      // On iOS: toggle between environment (back) and user (front)
      const isCurrentlyBack = activeCameraIdRef.current === 'environment' || !activeCameraIdRef.current?.includes('front');
      const targetFacing = isCurrentlyBack ? 'user' : 'environment';
      saveCameraId(targetFacing);
      setSavedCameraId(targetFacing);
      setSaveFeedback(`Alternando para câmera ${targetFacing === 'user' ? 'frontal' : 'traseira'}...`);
      setTimeout(() => {
        if (isMountedRef.current) setSaveFeedback(null);
      }, 2500);
      await startScanning(targetFacing);
      return;
    }

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
  const isIos = isIosOrSafari();

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
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-xs font-medium">Iniciando câmera traseira...</span>
          </div>
        )}

        {/* Error State */}
        {status === 'ERROR' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900 text-zinc-300 p-6 text-center">
            <div className="p-3 bg-destructive/10 rounded-full text-destructive border border-destructive/20">
              <CameraOff className="w-6 h-6" />
            </div>
            <p className="text-xs text-muted-foreground max-w-[220px]">
              {errorMessage || 'Erro ao carregar a câmera.'}
            </p>
            <Button size="sm" variant="outline" onClick={handleRetry} className="text-xs mt-1">
              Tentar Novamente
            </Button>
          </div>
        )}
      </div>

      {/* Camera Selection & Main Camera Setting */}
      {status === 'SCANNING' && (
        <div className="w-full max-w-[280px] sm:max-w-[320px] mt-2.5 space-y-1.5 text-center">
          {/* Active Camera Pill & Action Trigger */}
          <div className="flex items-center justify-between gap-1.5 bg-muted/60 border border-border/80 px-2.5 py-1.5 rounded-xl text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="p-1 rounded-md bg-primary/10 text-primary shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className="font-semibold text-foreground truncate">
                  {isIos
                    ? activeCameraId === 'user' ? 'Câmera Frontal' : 'Câmera Traseira (iPhone)'
                    : activeCamera ? getCameraLabelDetails(activeCamera, cameras.findIndex(c => c.id === activeCamera.id), cameras).friendlyName : 'Câmera Traseira'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {savedCameraId && savedCameraId === activeCameraId ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 fill-current" /> Principal salva
                    </span>
                  ) : (
                    'Câmera em uso'
                  )}
                </span>
              </div>
            </div>

            {/* Quick Switch Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSwitchCamera}
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0 border-border/80 gap-1"
              title="Trocar câmera"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Alternar</span>
            </Button>
          </div>

          {/* Feedback badge when saving camera */}
          {saveFeedback && (
            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-1 px-2.5 rounded-lg animate-in fade-in slide-in-from-top-1 duration-150 flex items-center justify-center gap-1">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{saveFeedback}</span>
            </div>
          )}

          {/* Collapsible List of all available cameras on device (Android/Desktop) */}
          {!isIos && showCameraList && (
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
