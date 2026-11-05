'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  Utensils, 
  CreditCard, 
  BellRing, 
  Users, 
  MapPin, 
  Calendar, 
  QrCode, 
  Youtube, 
  Video, 
  Clock, 
  Compass, 
  ChevronRight,
  ExternalLink,
  Edit3,
  Check,
  Music,
  Heart
} from 'lucide-react';

const CountdownTimer = dynamic(() => import('./CountdownTimer'), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-xl h-28 rounded-3xl bg-purple-50/60 border border-purple-100/60 animate-pulse mt-8 sm:mt-10" />
  ),
});

export default function HeroSection() {
  // YouTube video state (persisted in localStorage or configurable via URL/input)
  const [videoId, setVideoId] = useState<string>('');
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
      // 1. Check URL query params (?v=... or ?video=...)
      const params = new URLSearchParams(window.location.search);
      const paramVideo = params.get('v') || params.get('video');
      if (paramVideo) {
        const extracted = extractYoutubeId(paramVideo);
        setVideoId(extracted);
        localStorage.setItem('festapay_landing_video_id', extracted);
        return;
      }

      // 2. Check localStorage
      const saved = localStorage.getItem('festapay_landing_video_id');
      if (saved) {
        setVideoId(saved);
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
    <section id="sobre" className="relative overflow-hidden pt-8 pb-14 sm:pt-12 sm:pb-20">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-purple-200/50 via-amber-200/40 to-sky-200/50 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
        {/* Street QR Code Scanned Greeting */}
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-gradient-to-r from-purple-100/90 via-amber-100/80 to-purple-100/90 px-4 py-1.5 text-xs font-bold text-purple-900 shadow-xs mb-5 animate-in fade-in zoom-in duration-500">
          <QrCode className="h-4 w-4 text-purple-700 animate-pulse" />
          <span>Escaneou o nosso QR Code pelas ruas? Seja muito bem-vindo!</span>
        </div>

        {/* Event Sub-tag */}
        <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-700 mb-3">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>Igreja Batista da Manhã • Mutondo, São Gonçalo</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.15] max-w-4xl mx-auto">
          Festa Novo Amanhecer 2026:{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 underline decoration-purple-300 underline-offset-6">
            Sabores, Música e Alegria!
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-4 sm:mt-5 text-sm sm:text-base md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Três noites inesquecíveis para toda a família! Venha saborear os melhores hambúrgueres na chapa, pastéis quentinhos, churrasco, batata frita, doces e bebidas geladas com o sistema ágil <strong>FestaPay</strong>.
        </p>

        {/* Fast Key Info Badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3.5 py-1.5 rounded-full shadow-2xs">
            <Calendar className="h-4 w-4 text-purple-600" />
            <span>13, 14 e 15 de Novembro</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3.5 py-1.5 rounded-full shadow-2xs">
            <Clock className="h-4 w-4 text-amber-600" />
            <span>Sex: 19h | Sáb e Dom: 18h30</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3.5 py-1.5 rounded-full shadow-2xs">
            <MapPin className="h-4 w-4 text-rose-600" />
            <span>Travessa Maria Alice, 121 - Mutondo</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full text-emerald-800 shadow-2xs">
            <Heart className="h-4 w-4 text-emerald-600" />
            <span>Entrada 100% Gratuita</span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* FEATURED EXPLANATORY YOUTUBE VIDEO RIGHT ON THE COVER    */}
        {/* ======================================================== */}
        <div id="video-festa" className="mt-8 sm:mt-10 max-w-4xl mx-auto">
          <div className="relative group rounded-3xl p-1.5 sm:p-2 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 shadow-2xl">
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 text-white">
              {/* Video Player Header Bar */}
              <div className="bg-slate-900/90 backdrop-blur-xs px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <Youtube className="h-4 w-4 text-red-500 shrink-0" />
                  <span>Vídeo Explicativo da Festa Novo Amanhecer</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowConfig(!showConfig)}
                    className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1 bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700"
                    title="Configurar Link do YouTube"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>{showConfig ? 'Fechar' : 'Trocar Vídeo'}</span>
                  </button>
                </div>
              </div>

              {/* Collapsible config form */}
              {showConfig && (
                <form onSubmit={handleSaveVideo} className="bg-slate-900 border-b border-slate-800 p-3 sm:p-4 text-left flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Cole aqui o link do vídeo do YouTube (ex: https://youtu.be/... ou https://www.youtube.com/watch?v=...)"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <Button type="submit" size="sm" className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold">
                    {isSaved ? <><Check className="h-3.5 w-3.5 mr-1" /> Salvo!</> : 'Salvar Vídeo'}
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
                  /* Stand-in video preview when no specific video ID has been configured */
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-950 via-purple-950/70 to-slate-900 text-white relative">
                    <div 
                      onClick={() => setShowConfig(true)}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-600/30 transform transition-transform group-hover:scale-110 cursor-pointer mb-4"
                    >
                      <div className="w-0 h-0 border-y-8 border-y-transparent border-l-14 border-l-white ml-1" />
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-bold mb-2">
                      <Sparkles className="h-3 w-3" />
                      Assista ao Vídeo Oficial da Festa
                    </div>

                    <h3 className="text-lg sm:text-2xl font-black text-white max-w-xl mb-2">
                      Conheça Tudo o que Vai Rolar na Festa Novo Amanhecer!
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-300 max-w-lg mb-4 leading-relaxed">
                      Música ao vivo, bandas, barracas de comidas deliciosas, brinquedos para as crianças e o sistema ágil FestaPay.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => setShowConfig(true)}
                        className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-xl"
                      >
                        <Video className="h-3.5 w-3.5 mr-1 text-red-400" />
                        Inserir Link do YouTube
                      </Button>
                      <a
                        href="https://www.instagram.com/ibmanha/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold shadow-xs hover:opacity-95"
                      >
                        <span>Ver no Instagram @ibmanha</span>
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
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-3xl mx-auto flex-wrap">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-600/20 text-sm h-12 px-6"
          >
            <a href="#barracas">
              <Utensils className="mr-2 h-4 w-4" />
              Ver Barracas & Cardápio Completo
            </a>
          </Button>

          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto rounded-2xl border-rose-300 bg-rose-50/80 hover:bg-rose-100 text-rose-800 font-bold text-sm h-12 px-6 shadow-xs flex items-center gap-2"
          >
            <a
              href="https://maps.google.com/?q=Travessa+Maria+Alice+121+Mutondo+Sao+Goncalo+RJ"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin className="mr-1.5 h-4 w-4 text-rose-600" />
              Como Chegar (Google Maps / Waze)
            </a>
          </Button>

          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto rounded-2xl border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 font-bold text-sm h-12 px-6 shadow-xs flex items-center gap-2"
          >
            <Link href="/igreja-batista-da-manha/pedidos">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping mr-1" />
              <BellRing className="mr-1.5 h-4 w-4 text-emerald-600" />
              Acompanhar Pedido ao Vivo
            </Link>
          </Button>
        </div>

        {/* Countdown Timer to Event */}
        <CountdownTimer className="mt-10 sm:mt-12" />

        {/* 4 Pillars Highlights Grid */}
        <div className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto text-left">
          <div className="rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-xs hover:border-purple-200 transition-colors">
            <div className="h-9 w-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-2.5">
              <CreditCard className="h-5 w-5" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Cartão Cashless</h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Recarregue via Pix, Cartão ou Dinheiro. Sem filas demoradas.</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-xs hover:border-emerald-200 transition-colors">
            <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2.5">
              <BellRing className="h-5 w-5" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Aviso no WhatsApp</h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Você recebe mensagem no celular quando seu lanche fica pronto.</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-xs hover:border-pink-200 transition-colors">
            <div className="h-9 w-9 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center mb-2.5">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Para Toda Família</h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Música ao vivo, espaço kids seguro e ambiente abençoado.</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-xs hover:border-amber-200 transition-colors">
            <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2.5">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Entrada Gratuita</h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Traga amigos e vizinhos para celebrar com a gente no Mutondo.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
