'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { 
  CreditCard, 
  Bell, 
  ChevronRight, 
  Calendar, 
  Clock, 
  MapPin, 
  Heart, 
  QrCode, 
  Users, 
  BellRing, 
  Utensils 
} from 'lucide-react';

const CountdownTimer = dynamic(() => import('./CountdownTimer'), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-xl h-24 rounded-3xl bg-purple-50/60 border border-purple-100/60 animate-pulse mt-8" />
  ),
});

const OFFICIAL_FIREBASE_VIDEO_URL = 
  'https://firebasestorage.googleapis.com/v0/b/studio-1424813022-71754.firebasestorage.app/o/Arquivos%20aleat%C3%B3rios%2FIMG_8498.MOV?alt=media&token=30bfbd64-9351-4ac2-b659-c247ed3e97b5';

const DEFAULT_VIDEO_ID = '2exxezTA8fI';

export default function HeroSection() {
  const [videoSrc, setVideoSrc] = useState<string>(OFFICIAL_FIREBASE_VIDEO_URL);
  const [isDirectVideo, setIsDirectVideo] = useState<boolean>(true);
  const [videoId, setVideoId] = useState<string>(DEFAULT_VIDEO_ID);

  // Helper to check if URL is a direct video
  const isDirectVideoUrl = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.includes('firebasestorage.googleapis.com') ||
      lower.endsWith('.mp4') ||
      lower.endsWith('.webm') ||
      lower.endsWith('.mov') ||
      lower.includes('.mp4?')
    );
  };

  // Helper to extract YouTube video ID from URL or raw ID
  const extractYoutubeId = (url: string) => {
    if (!url) return '';
    const clean = url.trim();
    if (clean.length === 11 && !clean.includes('/') && !clean.includes('.')) {
      return clean;
    }
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = clean.match(regExp);
    return (match && match[2].length === 11) ? match[2] : clean;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const paramVideo = params.get('v') || params.get('video') || params.get('src');
      if (paramVideo) {
        if (isDirectVideoUrl(paramVideo)) {
          setVideoSrc(paramVideo);
          setIsDirectVideo(true);
        } else {
          const extracted = extractYoutubeId(paramVideo);
          setVideoId(extracted);
          setIsDirectVideo(false);
        }
        return;
      }

      // Default to official Firebase Storage video
      setVideoSrc(OFFICIAL_FIREBASE_VIDEO_URL);
      setIsDirectVideo(true);
    }
  }, []);

  return (
    <section id="sobre" className="relative overflow-hidden pt-4 pb-12 sm:pt-8 sm:pb-16">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[300px] bg-purple-200/35 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="mx-auto max-w-xl md:max-w-2xl px-4 sm:px-6 text-center">
        {/* 1. QR Code Scanned Welcome Banner */}
        <div className="w-full rounded-2xl border border-purple-200/80 bg-purple-50/40 p-3 sm:p-3.5 flex items-center justify-center gap-2.5 text-center shadow-2xs mb-4 sm:mb-5">
          <QrCode className="h-4 w-4 text-purple-600 shrink-0" />
          <p className="text-xs sm:text-sm text-slate-700 leading-snug">
            Escaneou o nosso QR Code nas ruas? Seja bem-vindo à{' '}
            <strong className="text-purple-700 font-bold">Festa Novo Amanhecer!</strong>
          </p>
        </div>

        {/* 2. ACESSO RÁPIDO FESTAPAY Card */}
        <div className="rounded-3xl border border-purple-200/70 bg-white shadow-lg shadow-purple-500/5 p-3.5 sm:p-5 space-y-3 mb-5 sm:mb-6 text-left">
          {/* Card Header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-600 inline-block" />
              <span className="text-xs font-black uppercase tracking-wider text-purple-950">
                ACESSO RÁPIDO FESTAPAY
              </span>
            </div>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2.5 py-0.5">
              Ao Vivo
            </span>
          </div>

          {/* Button 1: MEU CARTÃO */}
          <Link
            href="/meu-cartao"
            className="group w-full rounded-2xl bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-600 p-3.5 sm:p-4 text-white shadow-lg shadow-purple-600/25 flex items-center justify-between transition-all hover:brightness-105 active:scale-[0.99]"
          >
            <div className="flex items-center min-w-0">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-inner">
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="ml-3 min-w-0">
                <p className="font-black text-sm sm:text-base tracking-wide uppercase text-white leading-tight">
                  MEU CARTÃO
                </p>
                <p className="text-xs sm:text-sm text-purple-100 font-medium truncate mt-0.5">
                  Ver Saldo, Compras e Pedidos
                </p>
              </div>
            </div>
            <span className="bg-white/20 group-hover:bg-white/30 text-white font-bold text-[11px] sm:text-xs px-3.5 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0 ml-2 transition-colors">
              ACESSAR <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </Link>

          {/* Button 2: Painel Geral de Filas das Barracas */}
          <Link
            href="/igreja-batista-da-manha/pedidos"
            className="group w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-3.5 sm:p-4 text-white shadow-md shadow-emerald-600/20 flex items-center justify-between transition-all hover:brightness-105 active:scale-[0.99]"
          >
            <div className="flex items-center min-w-0">
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-inner">
                <Bell className="h-5 w-5" />
              </div>
              <div className="ml-3 min-w-0">
                <p className="font-bold text-xs sm:text-sm text-white leading-tight">
                  Painel Geral de Filas das Barracas
                </p>
                <p className="text-[11px] sm:text-xs text-emerald-100 font-medium truncate mt-0.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  Status e tempo de espera em tempo real
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-white/90 shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* 3. Featured Video (Convite Oficial 2026) */}
        <div id="video-festa" className="w-full rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl relative aspect-video flex items-center justify-center text-white mb-6">
          <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full border border-white/10 tracking-wide">
            Convite Oficial 2026
          </div>
          {isDirectVideo ? (
            <video
              src={videoSrc}
              controls
              playsInline
              preload="metadata"
              className="w-full h-full object-contain"
              onError={() => {
                setIsDirectVideo(false);
                setVideoId(DEFAULT_VIDEO_ID);
              }}
            />
          ) : (
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
              title="Vídeo Oficial da Festa Novo Amanhecer 2026"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )}
        </div>

        {/* 4. Title & Description Section (underneath the video) */}
        <div className="space-y-3 mb-5">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight max-w-xl mx-auto">
            Sabores, Música e Comunhão para toda a{' '}
            <span className="text-purple-600 underline decoration-wavy decoration-purple-300 underline-offset-4">
              Família
            </span>
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
            Dias <strong>13, 14 e 15 de Novembro</strong> na Igreja Batista da Manhã (Mutondo, São Gonçalo). 
            Gastronomia de primeira, bandas ao vivo e espaço kids com a agilidade do sistema{' '}
            <strong className="text-purple-700">FestaPay Cashless</strong>.
          </p>
        </div>

        {/* 5. The 4 Info Pills (2x2 grid on mobile) */}
        <div className="grid grid-cols-2 gap-2.5 max-w-xl mx-auto text-xs sm:text-sm font-bold">
          <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-2.5 sm:p-3 text-center flex items-center justify-center gap-1.5 text-purple-900 shadow-2xs">
            <Calendar className="h-4 w-4 text-purple-600 shrink-0" />
            <span className="truncate">13, 14 e 15 de Nov</span>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-2.5 sm:p-3 text-center flex items-center justify-center gap-1.5 text-amber-900 shadow-2xs">
            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="truncate">Sex-Dom: 18h30-22h</span>
          </div>
          <a
            href="https://maps.google.com/?q=Travessa+Maria+Alice+121+Mutondo+Sao+Goncalo+RJ"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-rose-200 bg-rose-50/50 p-2.5 sm:p-3 text-center flex items-center justify-center gap-1.5 text-rose-900 shadow-2xs hover:bg-rose-100 transition-colors"
          >
            <MapPin className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="truncate">Tv. Maria Alice, 121</span>
          </a>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-2.5 sm:p-3 text-center flex items-center justify-center gap-1.5 text-emerald-800 shadow-2xs">
            <Heart className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="truncate">Entrada Gratuita</span>
          </div>
        </div>

        {/* Countdown Timer */}
        <CountdownTimer className="mt-8 sm:mt-10" />

        {/* Quick Links below */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-xl border-purple-200 text-purple-800 hover:bg-purple-50 font-semibold text-xs"
          >
            <a href="#barracas">
              <Utensils className="mr-1.5 h-3.5 w-3.5 text-purple-600" />
              Ver Todas as Barracas
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs"
          >
            <a
              href="https://maps.google.com/?q=Travessa+Maria+Alice+121+Mutondo+Sao+Goncalo+RJ"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin className="mr-1.5 h-3.5 w-3.5 text-rose-600" />
              Como Chegar no Maps
            </a>
          </Button>
        </div>

        {/* 4 Pillars Highlights Grid */}
        <div className="mt-10 sm:mt-14 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto text-left">
          <div className="rounded-2xl border border-slate-100 bg-white/95 p-3.5 shadow-xs">
            <div className="h-8 w-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-2">
              <CreditCard className="h-4 w-4" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Cartão Cashless</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Recarregue via Pix, Cartão ou Dinheiro nos caixas.</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white/95 p-3.5 shadow-xs">
            <div className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
              <BellRing className="h-4 w-4" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Aviso no WhatsApp</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Mensagem automática no celular quando o pedido fica pronto.</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white/95 p-3.5 shadow-xs">
            <div className="h-8 w-8 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center mb-2">
              <Users className="h-4 w-4" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Para Toda Família</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Música ao vivo, espaço kids e ambiente acolhedor.</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white/95 p-3.5 shadow-xs">
            <div className="h-8 w-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2">
              <Heart className="h-4 w-4" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Entrada Gratuita</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Traga amigos e parentes para celebrar conosco.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
