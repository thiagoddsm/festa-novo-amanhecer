'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  Sparkles, 
  MapPin, 
  Calendar, 
  Clock, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle, 
  Instagram, 
  Youtube, 
  ExternalLink, 
  Share2, 
  ChevronRight, 
  Eye, 
  EyeOff, 
  Search, 
  Gift, 
  Award, 
  Compass, 
  Utensils, 
  Store, 
  ArrowLeft,
  Copy,
  Check,
  Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthProvider } from '@/hooks/use-auth-context';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';

export default function VouchersCampaignPage() {
  // Revealed states for each riddle
  const [revealedRiddles, setRevealedRiddles] = useState<Record<number, boolean>>({});
  // YouTube video configuration (customizable by user on the page)
  const [youtubeUrl, setYoutubeUrl] = useState<string>('https://youtu.be/2exxezTA8fI');
  const [activeVideoId, setActiveVideoId] = useState<string>('2exxezTA8fI');
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [tempVideoInput, setTempVideoInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Helper to extract YouTube ID
  const extractYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleSetCustomVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempVideoInput.trim()) return;
    const extracted = extractYoutubeId(tempVideoInput.trim()) || tempVideoInput.trim();
    setActiveVideoId(extracted);
    setShowVideoInput(false);
  };

  const toggleRiddle = (id: number) => {
    setRevealedRiddles(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const copyPageLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const riddles = [
    {
      id: 1,
      number: 'Charada 1',
      title: 'O Primeiro Voucher',
      presenter: 'Eva Campos',
      location: 'Padaria Deu La Deu',
      neighborhood: 'Mutondo, São Gonçalo - RJ',
      clue: 'Meu cheirinho pode abrir o apetite, e por aqui muita gente começa o dia. Tem coisa quentinha saindo do forno e delícias pra acompanhar o café. Que lugar é esse?',
      hint: 'Fica bem no coração do bairro, famosa pelo pão quentinho e atendimento de tradição nas manhãs do Mutondo!'
    },
    {
      id: 2,
      number: 'Charada 2',
      title: 'O Segundo Voucher',
      presenter: 'Raphael Goulart',
      location: 'Colégio Estadual Adino Xavier',
      neighborhood: 'Mutondo, São Gonçalo - RJ',
      clue: 'É um lugar de aprendizado, onde livros, conhecimento e novas descobertas fazem parte da rotina de muita gente. Você provavelmente já passou por lá ou conhece alguém que passa todos os dias! Já sabe qual é?',
      hint: 'Uma das instituições de ensino mais tradicionais e conhecidas de todo o bairro!'
    },
    {
      id: 3,
      number: 'Charada 3',
      title: 'O Terceiro Voucher',
      presenter: 'Claudia Bacelar',
      location: 'Supermarket (Mutondo)',
      neighborhood: 'Mutondo, São Gonçalo - RJ',
      clue: 'Onde os corredores são cheios de opções, os carrinhos circulam pra lá e pra cá e a lista do que levar nunca parece terminar! Já descobriu onde é?',
      hint: 'O mercado mais movimentado do bairro, onde todo mundo vai fazer as compras do mês ou da semana!'
    }
  ];

  const videosList = [
    {
      number: 'Vídeo 1',
      title: 'Anúncio Oficial da Dinâmica',
      presenter: 'Belle Nunes',
      summary: 'Apresentação da caça ao tesouro e convite para a Festa Novo Amanhecer.'
    },
    {
      number: 'Vídeo 2',
      title: 'Relembrando as Regras & Valendo!',
      presenter: 'Belle Nunes',
      summary: 'Início oficial da busca pelos 3 vouchers no bairro e instruções para quem achar.'
    },
    {
      number: 'Vídeo 3',
      title: '1ª Charada: Padaria Deu La Deu',
      presenter: 'Eva Campos',
      summary: 'Primeira pista do pão quentinho saindo do forno e café da manhã.'
    },
    {
      number: 'Vídeo 4',
      title: '2ª Charada: Colégio Adino Xavier',
      presenter: 'Raphael Goulart',
      summary: 'Segunda pista do local de aprendizado, livros e rotina de estudantes.'
    },
    {
      number: 'Vídeo 5',
      title: '3ª Charada: Supermarket',
      presenter: 'Claudia Bacelar',
      summary: 'Terceira pista dos carrinhos, corredores e lista de compras.'
    },
    {
      number: 'Vídeo 6',
      title: 'Como Resgatar & Instruções Finais',
      presenter: 'Eva, Raphael, Claudia & Belle',
      summary: 'Regras da foto nos Stories com perfil aberto e resgate nos dias da festa.'
    }
  ];

  return (
    <FirebaseClientProvider>
      <AuthProvider>
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-amber-200 selection:text-amber-950">
          <LandingNavbar />

      <main className="flex-1 pb-16">
        {/* Top Breadcrumb & Notification Banner */}
        <section className="bg-gradient-to-r from-orange-600 via-amber-600 to-amber-500 text-white py-2.5 px-4 text-center text-xs sm:text-sm font-medium shadow-inner flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 animate-pulse shrink-0" />
          <span>
            <strong>Campanha Exclusiva:</strong> 3 Vouchers de R$ 80 espalhados pelo Mutondo!
          </span>
          <span className="hidden sm:inline opacity-80">• Siga @ibmanha no Instagram</span>
        </section>

        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-sky-900 via-sky-800 to-sky-950 text-white pt-12 pb-20 px-4 sm:px-6 lg:px-8">
          {/* Decorative Background Elements */}
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-sky-500/20 blur-3xl pointer-events-none" />

          <div className="relative max-w-5xl mx-auto">
            {/* Back link */}
            <div className="mb-6">
              <Link 
                href="/" 
                className="inline-flex items-center gap-2 text-xs font-semibold text-sky-200 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar para a Página Principal da Festa
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Heading & Key Details */}
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-300 text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
                  <Compass className="h-4 w-4 text-amber-400 animate-spin-slow" />
                  Caça ao Tesouro da IBM
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
                  Descubra a Charada e Ganhe um{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 underline decoration-amber-400/50 decoration-wavy">
                    Voucher de R$ 80
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-sky-100 max-w-2xl leading-relaxed">
                  A <strong>Igreja Batista da Manhã</strong> preparou uma dinâmica especial pelas ruas do <strong>Mutondo</strong>. Três vouchers de R$ 80 estão escondidos em pontos conhecidos do bairro esperando por você para curtir a <strong>Festa Novo Amanhecer</strong>!
                </p>

                {/* Key Badges */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 pt-1">
                  <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl text-xs font-semibold text-sky-100">
                    <Gift className="h-4 w-4 text-amber-400" />
                    3 Vouchers de R$ 80
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl text-xs font-semibold text-sky-100">
                    <MapPin className="h-4 w-4 text-rose-400" />
                    Bairro do Mutondo, SG
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl text-xs font-semibold text-sky-100">
                    <Calendar className="h-4 w-4 text-emerald-400" />
                    Festa: 13, 14 e 15 de Nov
                  </div>
                </div>

                {/* Quick CTA Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-3">
                  <a
                    href="#video-explicativo"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-bold text-sm shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.02]"
                  >
                    <Video className="h-4 w-4" />
                    Assistir ao Vídeo da Campanha
                  </a>

                  <a
                    href="#como-funciona"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm transition-all"
                  >
                    <HelpCircle className="h-4 w-4 text-sky-300" />
                    Como Funciona & Regras
                  </a>

                  <button
                    onClick={copyPageLink}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sky-200 hover:text-white font-medium text-sm transition-all"
                    title="Copiar link da página"
                  >
                    {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    <span>{copiedLink ? 'Link Copiado!' : 'Compartilhar'}</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Hero Banner Image */}
              <div className="lg:col-span-5 flex justify-center">
                <div className="relative group max-w-sm sm:max-w-md w-full">
                  <div className="absolute -inset-1.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-3xl blur-md opacity-60 group-hover:opacity-90 transition duration-500" />
                  <div className="relative rounded-2xl overflow-hidden border-2 border-amber-300/50 shadow-2xl bg-sky-950">
                    <Image
                      src="/vouchers/caca-ao-tesouro-banner.jpg"
                      alt="Mapa da Caça ao Tesouro da Festa Novo Amanhecer"
                      width={600}
                      height={750}
                      className="w-full h-auto object-cover transform transition-transform duration-500 group-hover:scale-102"
                      priority
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent p-4 text-center">
                      <span className="text-xs font-semibold text-amber-300">
                        @ibmanha • Igreja Batista da Manhã
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: Video Explicativo do YouTube */}
        <section id="video-explicativo" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-20">
          <Card className="border-2 border-amber-200/80 shadow-2xl bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-b border-amber-100 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wider">
                    <Youtube className="h-4 w-4 text-red-600" />
                    Vídeo Oficial da Campanha
                  </div>
                  <CardTitle className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    Assista à Dinâmica Explicativa
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-600">
                    Veja o anúncio dos nossos apresentadores (Belle Nunes, Eva Campos, Raphael Goulart e Claudia Bacelar).
                  </CardDescription>
                </div>

                {/* Button to customize YouTube link if needed */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVideoInput(!showVideoInput)}
                  className="self-start sm:self-center text-xs font-semibold border-amber-200 hover:bg-amber-50 text-amber-900"
                >
                  <Video className="h-3.5 w-3.5 mr-1 text-red-600" />
                  {showVideoInput ? 'Fechar Edição' : 'Configurar Vídeo do YouTube'}
                </Button>
              </div>

              {/* Collapsible input to update YouTube URL */}
              {showVideoInput && (
                <form onSubmit={handleSetCustomVideo} className="mt-4 pt-4 border-t border-amber-200/60 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Cole aqui o link ou ID do YouTube (ex: https://youtu.be/...)"
                    value={tempVideoInput}
                    onChange={(e) => setTempVideoInput(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <Button type="submit" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold">
                    Aplicar Vídeo
                  </Button>
                </form>
              )}
            </CardHeader>

            <CardContent className="p-6 sm:p-8">
              {/* Responsive Video Container */}
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner group">
                {activeVideoId ? (
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube-nocookie.com/embed/${activeVideoId}?autoplay=0&rel=0`}
                    title="Vídeo Explicativo - Caça ao Tesouro da Festa Novo Amanhecer"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  /* Elegant Video Stand-in with play trigger and script guide */
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-sky-950 via-slate-900 to-sky-900 text-white relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-600/30 transform transition-transform group-hover:scale-110 cursor-pointer mb-4">
                      <div className="w-0 h-0 border-y-8 border-y-transparent border-l-14 border-l-white ml-1" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                      Vídeo Oficial: Caça ao Tesouro & Charadas da IBM
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-lg mb-4">
                      Acompanhe todos os detalhes da dinâmica e as regras com Belle Nunes, Eva Campos, Raphael Goulart e Claudia Bacelar.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <a
                        href="https://www.instagram.com/ibmanha/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold shadow-xs hover:opacity-95"
                      >
                        <Instagram className="h-4 w-4" />
                        Ver Vídeos nos Stories @ibmanha
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowVideoInput(true)}
                        className="text-xs font-semibold bg-white/20 hover:bg-white/30 text-white"
                      >
                        Inserir ID do YouTube
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Chapters / Script Overview */}
              <div className="mt-8">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Roteiro Completo da Série de Vídeos da Campanha
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {videosList.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 hover:bg-amber-50/40 hover:border-amber-200 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-amber-700 mb-1">
                        <span>{item.number}</span>
                        <span className="text-[11px] font-medium text-slate-500">{item.presenter}</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-900 mb-1">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-600 line-clamp-2">
                        {item.summary}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 2: O Voucher de R$ 80 & Onde Usar */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-bold mb-2">
              Seu Prêmio Garantido
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              O que é o Voucher de R$ 80?
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              Cada voucher dá direito a <strong>R$ 80,00 de crédito</strong> carregados diretamente no seu cartão cashless para gastar em qualquer barraca da Festa Novo Amanhecer.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Voucher Graphic Card */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="relative w-full max-w-md group">
                <div className="absolute -inset-2 bg-gradient-to-r from-orange-500 to-amber-400 rounded-3xl blur-lg opacity-40 group-hover:opacity-70 transition duration-500" />
                <div className="relative rounded-2xl overflow-hidden border-2 border-orange-200 bg-white shadow-xl">
                  <Image
                    src="/vouchers/voucher-modelo.png"
                    alt="Modelo Oficial do Voucher de R$ 80 - Festa Novo Amanhecer"
                    width={800}
                    height={450}
                    className="w-full h-auto object-contain"
                  />
                  <div className="p-3 bg-amber-50/80 border-t border-amber-200 text-center text-xs font-semibold text-amber-900">
                    Modelo oficial do voucher que você deve encontrar e levar à festa
                  </div>
                </div>
              </div>
            </div>

            {/* What you can buy with R$ 80 */}
            <div className="lg:col-span-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Utensils className="h-5 w-5 text-amber-600" />
                Dá para comer e beber muito bem na festa!
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Com o seu voucher de R$ 80, você pode montar o seu combo favorito entre todas as barracas participantes da edição 2026:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm shrink-0">
                    🍔
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">Hambúrgueres Artesanais</h5>
                    <p className="text-[11px] text-slate-500">Smash burger, tradicional e duplo na chapa quente.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0">
                    🥟
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">Pastéis na Hora</h5>
                    <p className="text-[11px] text-slate-500">Massa crocante frita na hora com recheios fartos.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="w-8 h-8 rounded-lg bg-yellow-100 text-yellow-700 flex items-center justify-center font-bold text-sm shrink-0">
                    🍟
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">Batata Frita Turbinada</h5>
                    <p className="text-[11px] text-slate-500">Crocante, sequinha e com adicionais de dar água na boca.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm shrink-0">
                    🥩
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">Churrasco & Espetinhos</h5>
                    <p className="text-[11px] text-slate-500">Carnes nobres assadas na brasa com farofa e molho à campanha.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="w-8 h-8 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-sm shrink-0">
                    🍰
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">Doces & Sobremesas</h5>
                    <p className="text-[11px] text-slate-500">Tortas, bolos no pote, mousses, brigadeiros e açaí.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                    🥤
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">Bebidas & Refrigerantes</h5>
                    <p className="text-[11px] text-slate-500">Sucos naturais, refrigerantes em lata e água gelada.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Como Funciona o Passo a Passo */}
        <section id="como-funciona" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge className="bg-sky-100 text-sky-800 border-sky-200 font-bold mb-2">
              Passo a Passo
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Como Participar da Caça ao Tesouro
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              Siga as etapas abaixo para não perder nenhuma pista e garantir a validação do seu prêmio.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Step 1 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs relative flex flex-col justify-between hover:border-amber-400 transition-colors">
              <div>
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white font-extrabold flex items-center justify-center text-sm mb-3">
                  1
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1.5">
                  Ative as Notificações
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Siga <strong>@ibmanha</strong> no Instagram e ligue o sino dos Stories para ser o primeiro a ver os vídeos.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                <Instagram className="h-3 w-3" /> @ibmanha
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs relative flex flex-col justify-between hover:border-amber-400 transition-colors">
              <div>
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white font-extrabold flex items-center justify-center text-sm mb-3">
                  2
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1.5">
                  Decifre as 3 Charadas
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Preste atenção em cada detalhe falado por Belle, Eva, Raphael e Claudia nos vídeos.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                <Search className="h-3 w-3" /> Pistas do Mutondo
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs relative flex flex-col justify-between hover:border-amber-400 transition-colors">
              <div>
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white font-extrabold flex items-center justify-center text-sm mb-3">
                  3
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1.5">
                  Corra até o Local!
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Descobriu o local? Vá correndo e procure o voucher físico escondido no ponto comercial/escola.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Seja o mais rápido!
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs relative flex flex-col justify-between hover:border-amber-400 transition-colors">
              <div>
                <div className="w-9 h-9 rounded-xl bg-orange-600 text-white font-extrabold flex items-center justify-center text-sm mb-3">
                  4
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1.5">
                  Foto + Perfil Aberto!
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Achou? Tire uma selfie com o voucher, poste nos Stories e marque <strong>@ibmanha</strong> com perfil aberto!
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-semibold text-orange-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Perfil Público
              </div>
            </div>

            {/* Step 5 */}
            <div className="bg-gradient-to-b from-amber-50 to-orange-50 rounded-2xl p-5 border-2 border-amber-300 shadow-xs relative flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center text-sm mb-3">
                  5
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1.5">
                  Resgate na Festa!
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Leve o voucher físico original no Caixa Central nos dias 13, 14 ou 15 de novembro e gaste seus R$ 80!
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-200 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Crédito no Cartão
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: As 3 Charadas Interativas */}
        <section id="charadas" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-bold mb-2">
              Pistas Reveladas
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              As 3 Charadas dos Vouchers
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              Relembre aqui o texto de cada enigma e teste se você sabe onde cada voucher estava escondido!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {riddles.map((riddle) => {
              const isRevealed = !!revealedRiddles[riddle.id];
              return (
                <Card 
                  key={riddle.id} 
                  className={`border-2 transition-all rounded-3xl overflow-hidden flex flex-col justify-between ${
                    isRevealed ? 'border-amber-400 bg-amber-50/30 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-full">
                        {riddle.number}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Apresentado por {riddle.presenter}
                      </span>
                    </div>
                    <CardTitle className="text-lg font-extrabold text-slate-900">
                      {riddle.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-4">
                    {/* Clue text */}
                    <div className="bg-slate-100/70 p-4 rounded-2xl border border-slate-200/80 italic text-slate-700 text-xs sm:text-sm leading-relaxed">
                      &ldquo;{riddle.clue}&rdquo;
                    </div>

                    {/* Reveal Box */}
                    {isRevealed ? (
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 animate-in fade-in-50">
                        <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          Local do Voucher:
                        </div>
                        <div className="text-sm font-extrabold text-slate-900">
                          {riddle.location}
                        </div>
                        <div className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-rose-500" />
                          {riddle.neighborhood}
                        </div>
                        <p className="text-[11px] text-emerald-700 mt-2 font-medium bg-emerald-100/50 p-2 rounded-xl">
                          💡 <strong>Dica:</strong> {riddle.hint}
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
                        Clique no botão abaixo se já quiser conferir qual é o local!
                      </div>
                    )}

                    <Button
                      variant={isRevealed ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => toggleRiddle(riddle.id)}
                      className={`w-full rounded-xl text-xs font-bold gap-1.5 ${
                        isRevealed 
                          ? 'border-slate-300 text-slate-700 hover:bg-slate-100' 
                          : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-xs'
                      }`}
                    >
                      {isRevealed ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          Ocultar Resposta
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" />
                          Revelar Resposta da Charada
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Section 5: Regulamento Oficial & Condições do Voucher */}
        <section id="regras" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
          <Card className="border-2 border-slate-200 bg-white rounded-3xl shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 sm:p-8">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">
                <AlertCircle className="h-4 w-4" />
                Termos & Condições
              </div>
              <CardTitle className="text-xl sm:text-2xl font-extrabold text-slate-900">
                Regulamento Oficial da Promoção dos Vouchers
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-slate-600">
                Confira todas as diretrizes de elegibilidade, validação e uso do prêmio de R$ 80.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <strong className="text-slate-900">Período e Local de Resgate:</strong>
                    <p className="text-slate-600 mt-0.5">
                      Os vouchers só poderão ser resgatados e consumidos presencialmente durante a realização da <strong>Festa Novo Amanhecer</strong>, nas datas de <strong>13, 14 e 15 de Novembro de 2026</strong>, no pátio da <strong>Igreja Batista da Manhã</strong> (Travessa Maria Alice, 121 - Mutondo, São Gonçalo - RJ).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <strong className="text-slate-900">Apresentação Obrigatória do Voucher Físico:</strong>
                    <p className="text-slate-600 mt-0.5">
                      Para receber os créditos de R$ 80,00, o participante deve apresentar o <strong>voucher impresso original</strong> no <strong>Caixa Central</strong> da festa. Cópias, fotos digitais impressas ou vouchers danificados sem identificação não serão aceitos.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <strong className="text-slate-900">Comprovação nos Stories do Instagram (Perfil Aberto):</strong>
                    <p className="text-slate-600 mt-0.5">
                      A pessoa que encontrar o voucher deve publicar uma foto com ele nos Stories do seu perfil no Instagram, marcando obrigatoriamente a página oficial <strong>@ibmanha</strong>. No dia da caça e da validação, o perfil deve estar configurado como <strong>público (aberto)</strong> para checagem da equipe organizadora.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </div>
                  <div>
                    <strong className="text-slate-900">Crédito no Cartão Cashless & Consumo Exclusivo:</strong>
                    <p className="text-slate-600 mt-0.5">
                      O valor de R$ 80,00 será transferido para um cartão de consumo cashless da festa. O crédito destina-se <strong>exclusivamente ao consumo de comidas, bebidas e atrações</strong> disponíveis nas barracas do evento.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    5
                  </div>
                  <div>
                    <strong className="text-slate-900">Não Conversível em Dinheiro (Sem Reembolso ou Troco em Espécie):</strong>
                    <p className="text-slate-600 mt-0.5">
                      O voucher não poderá sob nenhuma hipótese ser convertido em dinheiro em espécie, Pix, transferência bancária ou gerar troco monetário. Saldo residual não consumido durante os dias da festa expira com o encerramento do evento.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    6
                  </div>
                  <div>
                    <strong className="text-slate-900">Limite de 1 Voucher por Ganhador / Família:</strong>
                    <p className="text-slate-600 mt-0.5">
                      Para garantir a oportunidade e alegria de diferentes famílias, cada participante poderá resgatar no máximo 1 (um) dos três vouchers da campanha.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 6: Galeria de Artes Oficiais da Campanha */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-bold mb-2">
              Galeria Oficial
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Cartazes e Divulgações da Campanha
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              Confira os materiais visuais originais compartilhados nas redes da Igreja Batista da Manhã.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1 */}
            <div className="group rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs hover:shadow-lg transition-all">
              <div className="relative aspect-4/5 overflow-hidden bg-slate-100">
                <Image
                  src="/vouchers/caca-ao-tesouro-banner.jpg"
                  alt="Cartaz Caça ao Tesouro"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-3 text-center">
                <span className="text-xs font-bold text-slate-800">Mapa do Tesouro</span>
                <p className="text-[11px] text-slate-500">Cartaz oficial da dinâmica</p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="group rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs hover:shadow-lg transition-all">
              <div className="relative aspect-4/5 overflow-hidden bg-slate-100">
                <Image
                  src="/vouchers/como-vai-funcionar.jpg"
                  alt="Como vai funcionar"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-3 text-center">
                <span className="text-xs font-bold text-slate-800">Como Vai Funcionar</span>
                <p className="text-[11px] text-slate-500">Regras e passos nos Stories</p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="group rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs hover:shadow-lg transition-all">
              <div className="relative aspect-4/5 overflow-hidden bg-slate-100">
                <Image
                  src="/vouchers/datas-evento.jpg"
                  alt="Datas da Festa Novo Amanhecer"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-3 text-center">
                <span className="text-xs font-bold text-slate-800">Datas & Horários</span>
                <p className="text-[11px] text-slate-500">13, 14 e 15 de Novembro</p>
              </div>
            </div>

            {/* Card 4 */}
            <div className="group rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs hover:shadow-lg transition-all">
              <div className="relative aspect-4/5 overflow-hidden bg-slate-100">
                <Image
                  src="/vouchers/convite-festa.jpg"
                  alt="Convite da Festa Novo Amanhecer"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-3 text-center">
                <span className="text-xs font-bold text-slate-800">Convite Especial</span>
                <p className="text-[11px] text-slate-500">Três dias de comunhão e alegria</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 7: Informações da Festa & Mapa */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
          <div className="rounded-3xl bg-gradient-to-r from-sky-900 to-sky-950 text-white p-6 sm:p-10 shadow-xl border border-sky-800 relative overflow-hidden">
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold">
                  <Calendar className="h-3.5 w-3.5" />
                  Dias 13, 14 e 15 de Novembro
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Nos Vemos na Festa Novo Amanhecer!
                </h3>
                <p className="text-sm text-sky-100 max-w-xl leading-relaxed">
                  Mesmo se não encontrar os vouchers, traga toda a sua família e amigos para três noites inesquecíveis com música ao vivo, cardápio irresistível, brinquedos e alegria!
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-sky-200">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>Travessa Maria Alice, 121 - Mutondo, SG</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>Sex: 19h | Sáb e Dom: 18h30</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col gap-3">
                <a
                  href="https://maps.google.com/?q=Travessa+Maria+Alice+121+Mutondo+Sao+Goncalo+RJ"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-md transition-all"
                >
                  <MapPin className="h-4 w-4" />
                  Abrir Rota no Google Maps
                </a>

                <a
                  href="https://www.instagram.com/ibmanha/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm transition-all"
                >
                  <Instagram className="h-4 w-4" />
                  Instagram @ibmanha
                </a>

                <Link
                  href="/igreja-batista-da-manha/pedidos"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition-all"
                >
                  <Store className="h-4 w-4" />
                  Acompanhar Fila de Pedidos ao Vivo
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

          <LandingFooter />
        </div>
      </AuthProvider>
    </FirebaseClientProvider>
  );
}
