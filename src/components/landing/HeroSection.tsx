'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Sparkles, Utensils, CreditCard, BellRing, Users, MapPin, Calendar } from 'lucide-react';

const CountdownTimer = dynamic(() => import('./CountdownTimer'), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-xl h-28 rounded-3xl bg-purple-50/60 border border-purple-100/60 animate-pulse mt-8 sm:mt-10" />
  ),
});

export default function HeroSection() {
  return (
    <section id="sobre" className="relative overflow-hidden pt-8 pb-14 sm:pt-14 sm:pb-20">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-purple-200/40 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
        {/* Event tag */}
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50/80 px-3.5 py-1 text-xs font-semibold text-purple-700 shadow-2xs mb-5 animate-in fade-in zoom-in duration-500">
          <Sparkles className="h-3.5 w-3.5 text-purple-600" />
          <span>Festa Novo Amanhecer 2026 • Igreja Batista</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.15] max-w-3xl mx-auto">
          Sabores, Alegria e Comunhão para toda a <span className="text-purple-600 underline decoration-purple-300 underline-offset-4">Família</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-4 sm:mt-5 text-sm sm:text-base md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Venha saborear os melhores pastéis, churrascos, bebidas geladas e doces artesanais. 
          Tudo com a agilidade do sistema <strong>FestaPay Cashless</strong>: sem fichas de papel e sem filas demoradas!
        </p>

        {/* CTAs */}
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-600/20 text-sm h-12 px-6"
          >
            <a href="#barracas">
              <Utensils className="mr-2 h-4 w-4" />
              Ver Barracas & Cardápio
            </a>
          </Button>

          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto rounded-2xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm h-12 px-6 shadow-xs"
          >
            <a href="#como-funciona">
              <CreditCard className="mr-2 h-4 w-4 text-purple-600" />
              Como Funciona o Cartão
            </a>
          </Button>
        </div>

        {/* Countdown Timer */}
        <CountdownTimer className="mt-8 sm:mt-10" />

        {/* Fast Key Highlights Grid */}
        <div className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto text-left">
          <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-xs">
            <div className="h-9 w-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-2.5">
              <CreditCard className="h-5 w-5" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Cartão Cashless</h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Recarregue via Pix, Cartão ou Dinheiro nos caixas.</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-xs">
            <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2.5">
              <BellRing className="h-5 w-5" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Aviso no WhatsApp</h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Você é avisado no celular quando seu lanche estiver pronto.</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-xs">
            <div className="h-9 w-9 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center mb-2.5">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Para Toda Família</h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Ambiente seguro, acolhedor e com espaço kids.</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-xs">
            <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2.5">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Entrada Gratuita</h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Traga seus amigos e parentes para celebrar conosco.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
