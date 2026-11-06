'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Play, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  MapPin, 
  Calendar, 
  ArrowRight, 
  Settings, 
  Check, 
  Share2,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Default video: YouTube ID
const DEFAULT_YOUTUBE_ID = '2exxezTA8fI';

export default function QrCodeVideoPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Video source: could be direct MP4 (Firebase Storage) or a YouTube ID
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [isDirectVideo, setIsDirectVideo] = useState<boolean>(false);
  const [youtubeId, setYoutubeId] = useState<string>(DEFAULT_YOUTUBE_ID);
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [inputUrl, setInputUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  // Helper to determine if a URL is a direct video file (Firebase Storage, S3, MP4)
  const isDirectVideoUrl = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.includes('firebasestorage.googleapis.com') ||
      lower.endsWith('.mp4') ||
      lower.endsWith('.webm') ||
      lower.endsWith('.mov') ||
      lower.includes('.mp4?') ||
      lower.includes('blob:')
    );
  };

  // Helper to extract YouTube video ID
  const extractYoutubeId = (url: string) => {
    if (!url) return '';
    const clean = url.trim();
    if (clean.length === 11 && !clean.includes('/') && !clean.includes('.')) {
      return clean;
    }
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = clean.match(regExp);
    return (match && match[2].length === 11) ? match[2] : clean;
  };

  // Initialize from URL param or localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const paramSrc = params.get('src') || params.get('url');
      const paramYt = params.get('v') || params.get('yt');

      if (paramSrc) {
        setVideoSrc(paramSrc);
        setIsDirectVideo(true);
        localStorage.setItem('festapay_vertical_video_src', paramSrc);
        return;
      }

      if (paramYt) {
        const extracted = extractYoutubeId(paramYt);
        setYoutubeId(extracted);
        setIsDirectVideo(false);
        localStorage.setItem('festapay_vertical_video_yt', extracted);
        return;
      }

      // Check localStorage
      const savedSrc = localStorage.getItem('festapay_vertical_video_src');
      const savedYt = localStorage.getItem('festapay_vertical_video_yt');

      if (savedSrc && isDirectVideoUrl(savedSrc)) {
        setVideoSrc(savedSrc);
        setIsDirectVideo(true);
      } else if (savedYt) {
        setYoutubeId(savedYt);
        setIsDirectVideo(false);
      } else {
        setYoutubeId(DEFAULT_YOUTUBE_ID);
        setIsDirectVideo(false);
      }
    }
  }, []);

  // Attempt autoplay when direct video is mounted
  useEffect(() => {
    if (isDirectVideo && videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Autoplay failed:', err);
          setIsPlaying(false);
        });
    }
  }, [isDirectVideo, videoSrc]);

  // Handle unmute & user interaction
  const handleToggleSound = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setHasInteracted(true);

    if (isDirectVideo && videoRef.current) {
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    } else {
      setIsMuted(!isMuted);
    }
  };

  // Tap screen to toggle play/pause or unmute
  const handleScreenClick = () => {
    if (!hasInteracted && isMuted) {
      handleToggleSound();
      return;
    }

    if (isDirectVideo && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  // Track progress of direct video
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration || 1;
      setProgress((current / duration) * 100);
    }
  };

  const handleVideoEnded = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    const raw = inputUrl.trim();
    if (isDirectVideoUrl(raw)) {
      setVideoSrc(raw);
      setIsDirectVideo(true);
      localStorage.setItem('festapay_vertical_video_src', raw);
      localStorage.removeItem('festapay_vertical_video_yt');
    } else {
      const extracted = extractYoutubeId(raw);
      setYoutubeId(extracted);
      setIsDirectVideo(false);
      localStorage.setItem('festapay_vertical_video_yt', extracted);
      localStorage.removeItem('festapay_vertical_video_src');
    }
    setShowConfig(false);
    setInputUrl('');
  };

  const copyShareLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full bg-slate-950 text-white flex items-center justify-center overflow-hidden select-none">
      {/* Blurred Ambient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950 via-slate-950 to-amber-950 opacity-90 -z-10" />

      {/* 9:16 Vertical Container (Full height on mobile, phone-aspect on desktop) */}
      <div 
        onClick={handleScreenClick}
        className="relative w-full max-w-[440px] h-[100dvh] sm:h-[92vh] sm:rounded-3xl overflow-hidden bg-black shadow-2xl flex flex-col justify-between cursor-pointer border sm:border-slate-800"
      >
        {/* ======================================================== */}
        {/* VIDEO PLAYER VIEWPORT (DIRECT MP4 OR YOUTUBE SHORTS)     */}
        {/* ======================================================== */}
        <div className="absolute inset-0 w-full h-full">
          {isDirectVideo ? (
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-cover"
              playsInline
              autoPlay
              muted={isMuted}
              loop
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
            />
          ) : (
            <div className="w-full h-full relative">
              <iframe
                className="w-full h-full scale-[1.02] pointer-events-auto"
                src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=0&controls=0&loop=1&playlist=${youtubeId}&modestbranding=1&rel=0&playsinline=1`}
                title="Vídeo Festa Novo Amanhecer"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          )}
        </div>

        {/* Gradient overlays for readability */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none z-10" />
        <div className="absolute bottom-0 inset-x-0 h-64 bg-gradient-to-t from-black/95 via-black/70 to-transparent pointer-events-none z-10" />

        {/* ======================================================== */}
        {/* TOP BAR: PROGRESS + BRANDING + QUICK CONTROLS           */}
        {/* ======================================================== */}
        <div className="relative z-20 pt-3 px-4 flex flex-col gap-2.5">
          {/* Stories-like Progress Bar (active for direct video) */}
          {isDirectVideo && (
            <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            {/* Event pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-xs font-bold text-white shadow-xs">
              <Sparkles className="h-3 w-3 text-amber-400 animate-pulse" />
              <span>Festa Novo Amanhecer 2026</span>
            </div>

            {/* Quick Actions (Sound toggle, Share, Config) */}
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {isDirectVideo && (
                <button
                  onClick={handleToggleSound}
                  className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all hover:scale-105"
                  title={isMuted ? 'Ativar Som' : 'Silenciar'}
                >
                  {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
                </button>
              )}

              <button
                onClick={copyShareLink}
                className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all hover:scale-105"
                title="Compartilhar Link"
              >
                {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4" />}
              </button>

              <button
                onClick={() => setShowConfig(!showConfig)}
                className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all"
                title="Configurar Link do Vídeo (Firebase / YouTube)"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CENTER OVERLAY: TAP TO UNMUTE / PAUSE INDICATOR          */}
        {/* ======================================================== */}
        <div className="relative z-20 flex-1 flex items-center justify-center pointer-events-none">
          {isDirectVideo && isMuted && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/75 backdrop-blur-md border border-white/30 text-xs font-bold text-white shadow-xl animate-bounce">
              <VolumeX className="h-4 w-4 text-amber-400" />
              <span>Toque na tela para ativar o som 🔊</span>
            </div>
          )}

          {isDirectVideo && !isPlaying && (
            <div className="w-16 h-16 rounded-full bg-black/70 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
              <Play className="h-8 w-8 ml-1" />
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* BOTTOM SECTION: TITLE + INFO + CALL TO ACTION           */}
        {/* ======================================================== */}
        <div className="relative z-20 p-5 space-y-3.5" onClick={(e) => e.stopPropagation()}>
          {/* Key Event Badges */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-200">
            <span className="flex items-center gap-1 bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
              <Calendar className="h-3 w-3 text-purple-400" />
              13, 14 e 15 de Novembro
            </span>
            <span className="flex items-center gap-1 bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
              <MapPin className="h-3 w-3 text-rose-400" />
              Mutondo, São Gonçalo
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-1 rounded-lg">
              Entrada Gratuita
            </span>
          </div>

          {/* Heading */}
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
              Festa Novo Amanhecer 2026
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Hambúrguer na chapa, pastel, churrasco, batata frita, doces e brinquedos para as crianças na <strong>Igreja Batista da Manhã</strong>!
            </p>
          </div>

          {/* Action Buttons: Clean & Direct */}
          <div className="pt-1 flex flex-col gap-2">
            <Button
              asChild
              size="lg"
              className="w-full rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-extrabold text-sm shadow-xl shadow-purple-600/30 h-12"
            >
              <Link href="/">
                <span>Conhecer a Festa & Cardápio</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>

            <a
              href="https://maps.google.com/?q=Travessa+Maria+Alice+121+Mutondo+Sao+Goncalo+RJ"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs transition-all text-center"
            >
              <MapPin className="h-4 w-4 text-rose-400" />
              <span>Como Chegar (Tv. Maria Alice, 121 - Mutondo)</span>
            </a>
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLLAPSIBLE CONFIG MODAL: URL DO FIREBASE OU YOUTUBE     */}
        {/* ======================================================== */}
        {showConfig && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md p-6 flex flex-col justify-center animate-in fade-in"
          >
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Settings className="h-4 w-4 text-purple-400" />
                  Configurar Vídeo do QR Code
                </h3>
                <button
                  onClick={() => setShowConfig(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ✕ Fechar
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Você pode colar aqui o <strong>link direto do Firebase Storage</strong> (arquivo <code>.mp4</code>) ou o link de um vídeo/Shorts do <strong>YouTube</strong>:
              </p>

              <form onSubmit={handleSaveConfig} className="space-y-3">
                <input
                  type="text"
                  placeholder="https://firebasestorage.../video.mp4 ou https://youtu.be/..."
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConfig(false)}
                    className="text-xs text-slate-400"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
                  >
                    Salvar Vídeo
                  </Button>
                </div>
              </form>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300 flex items-center gap-1">
                  <Info className="h-3 w-3 text-purple-400" />
                  Link oficial para o QR Code:
                </div>
                <p>
                  O QR Code nas ruas deve apontar para:
                  <br />
                  <code className="text-purple-300 font-mono text-[10px]">
                    https://festanovoamanhecer.com.br/qrcode
                  </code>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
