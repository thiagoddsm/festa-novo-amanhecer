'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { 
  Utensils, 
  CreditCard, 
  BellRing, 
  Users, 
  MapPin, 
  Calendar, 
  QrCode, 
  Youtube, 
  Clock, 
  ExternalLink,
  Edit3,
  Check,
  Heart,
  Video
} from 'lucide-react';

const CountdownTimer = dynamic(() => import('./CountdownTimer'), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-xl h-24 rounded-3xl bg-purple-50/60 border border-purple-100/60 animate-pulse mt-8" />
  ),
});

const DEFAULT_VIDEO_ID = '2exxezTA8fI';

export default function HeroSection() {
  // YouTube video state (persisted in localStorage or configurable via URL/input)
  const [videoId, setVideoId] = useState<string>(DEFAULT_VIDEO_ID);
  const [showConfig, setShowConfig] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);

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
      const paramVideo = params.get('v') || params.get('video');
      if (paramVideo) {
        const extracted = extractYoutubeId(paramVideo);
        setVideoId(extracted);
        localStorage.setItem('festapay_landing_video_id', extracted);
        return;
      }

      const saved = localStorage.getItem('festapay_landing_video_id');
      if (saved && saved.trim().length === 11) {
        setVideoId(saved.trim());
      } else {
        setVideoId(DEFAULT_VIDEO_ID);
        localStorage.setItem('festapay_landing_video_id', DEFAULT_VIDEO_ID);
      }
    }
  }, []);

  const handleSaveVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    const extracted = extractYoutubeId(urlInput);
    setVideoId(extracted);
    if (typeof window !== 'undefined') {
      localStorage.setItem('festapay_landing_video_id', extracted);
    }
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      setShowConfig(false);
    }, 1500);
  };

  return (
    <section id="sobre" className="relative overflow-hidden pt-6 pb-12 sm:pt-10 sm:pb-16">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[300px] bg-purple-200/40 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
        {/* QR Code Scanned Welcome Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50/90 px-3.5 py-1 text-xs font-semibold text-purple-700 shadow-2xs mb-4">
          <QrCode className="h-3.5 w-3.5 text-purple-600" />
          <span>Escaneou o nosso QR Code nas ruas? Seja bem-vindo à Festa Novo Amanhecer!</span>
        </div>

        {/* Main Title */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.15] max-w-3xl mx-auto">
          Sabores, Música e Comunhão para toda a{' '}
          <span className="text-purple-600 underline decoration-purple-300 underline-offset-4">
            Família
          </span>
        </h1>

        {/* Subtitle with Schedule and Location */}
        <p className="mt-3 sm:mt-4 text-sm sm:text-base md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Dias <strong>13, 14 e 15 de Novembro</strong> na Igreja Batista da Manhã (Mutondo, São Gonçalo). 
          Gastronomia de primeira, bandas ao vivo e espaço kids com a agilidade do sistema <strong>FestaPay Cashless</strong>.
        </p>

        {/* Operating Hours & Location Pills */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 px-3 py-1 rounded-full shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-purple-600" />
            <span>13, 14 e 15 de Novembro</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 px-3 py-1 rounded-full shadow-2xs">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <span>Sex: 19h às 22h | Sáb e Dom: 18h30 às 22h</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 px-3 py-1 rounded-full shadow-2xs">
            <MapPin className="h-3.5 w-3.5 text-rose-600" />
            <span>Tv. Maria Alice, 121 - Mutondo</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full text-emerald-800 shadow-2xs">
            <Heart className="h-3.5 w-3.5 text-emerald-600" />
            <span>Entrada 100% Gratuita</span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* FEATURED EXPLANATORY YOUTUBE VIDEO ON COVER              */}
        {/* ======================================================== */}
        <div id="video-festa" className="mt-7 sm:mt-8 max-w-3xl mx-auto">
          <div className="relative rounded-3xl p-1 bg-gradient-to-r from-purple-500/30 via-pink-500/20 to-amber-500/30 shadow-xl border border-purple-100">
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 text-white">
              {/* Video Bar */}
              <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-200">
                  <Youtube className="h-4 w-4 text-red-500 shrink-0" />
                  <span>Vídeo Explicativo da Festa Novo Amanhecer</span>
                </div>

                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1 bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-700"
                  title="Configurar Link do YouTube"
                >
                  <Edit3 className="h-3 w-3" />
                  <span>{showConfig ? 'Fechar' : 'Trocar Vídeo'}</span>
                </button>
              </div>

              {/* Collapsible config form */}
              {showConfig && (
                <form onSubmit={handleSaveVideo} className="bg-slate-900 border-b border-slate-800 p-3 text-left flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Cole o link do YouTube (ex: https://youtu.be/...)"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <Button type="submit" size="sm" className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold h-8">
                    {isSaved ? <><Check className="h-3 w-3 mr-1" /> Salvo!</> : 'Salvar'}
                  </Button>
                </form>
              )}

              {/* 16:9 Responsive Video Viewport */}
              <div className="relative w-full aspect-video">
                {videoId ? (
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0`}
                    title="Vídeo Oficial da Festa Novo Amanhecer 2026"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-950 via-purple-950/70 to-slate-900 text-white relative">
                    <div 
                      onClick={() => setShowConfig(true)}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transform transition-transform hover:scale-110 cursor-pointer mb-3"
                    >
                      <div className="w-0 h-0 border-y-7 border-y-transparent border-l-12 border-l-white ml-0.5" />
                    </div>

                    <h3 className="text-base sm:text-xl font-bold text-white max-w-md mb-1.5">
                      Conheça Tudo o que Vai Rolar na Festa!
                    </h3>

                    <p className="text-xs text-slate-300 max-w-md mb-3 leading-relaxed">
                      Barracas de comidas artesanais, música ao vivo, brinquedos e o sistema ágil FestaPay.
                    </p>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => setShowConfig(true)}
                        className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-xl h-8 px-3"
                      >
                        <Video className="h-3 w-3 mr-1 text-red-400" />
                        Inserir Link do YouTube
                      </Button>
                      <a
                        href="https://www.instagram.com/ibmanha/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold shadow-xs hover:opacity-95"
                      >
                        <span>@ibmanha</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Primary CTAs below video */}
        <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-2xl mx-auto flex-wrap">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-600/20 text-sm h-11 px-5"
          >
            <a href="#barracas">
              <Utensils className="mr-2 h-4 w-4" />
              Ver Todas as Barracas
            </a>
          </Button>

          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto rounded-2xl border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-800 font-bold text-sm h-11 px-5 shadow-xs flex items-center gap-2"
          >
            <a
              href="https://maps.google.com/?q=Travessa+Maria+Alice+121+Mutondo+Sao+Goncalo+RJ"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin className="mr-1 h-4 w-4 text-rose-600" />
              Como Chegar (Google Maps)
            </a>
          </Button>

          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto rounded-2xl border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 font-bold text-sm h-11 px-5 shadow-xs flex items-center gap-2"
          >
            <Link href="/igreja-batista-da-manha/pedidos">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping mr-1" />
              <BellRing className="mr-1 h-4 w-4 text-emerald-600" />
              Acompanhar Pedido ao Vivo
            </Link>
          </Button>
        </div>

        {/* Countdown Timer */}
        <CountdownTimer className="mt-8 sm:mt-10" />

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
