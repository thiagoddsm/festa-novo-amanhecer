'use client';

import React from 'react';
import { Calendar, Clock, MapPin, Sparkles, HelpCircle, Navigation, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EventInfoSection() {
  const faqs = [
    {
      q: 'A entrada na festa é gratuita?',
      a: 'Sim! A entrada é 100% gratuita para toda a comunidade, amigos e famílias. Você só paga pelo que consumir nas barracas.',
    },
    {
      q: 'Quais formas de pagamento são aceitas nos caixas?',
      a: 'Você pode recarregar seu cartão cashless nos caixas utilizando PIX, cartões de débito, crédito ou dinheiro em espécie.',
    },
    {
      q: 'E se sobrar saldo no meu cartão?',
      a: 'Você pode solicitar o reembolso do saldo restante diretamente no guichê de caixa central antes de ir embora.',
    },
    {
      q: 'Como funciona o aviso de pedido pronto no WhatsApp?',
      a: 'Ao carregar seu cartão, informe seu número de WhatsApp. Quando você fizer um pedido em qualquer barraca (como hambúrguer, pastel ou churrasco), assim que estiver pronto para retirada, enviamos uma mensagem avisando para você buscar sem esperar em filas!',
    },
  ];

  return (
    <section id="localizacao" className="py-14 sm:py-20 bg-white border-t border-slate-100">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Info Grid with exact dates, hours, and location */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-14">
          {/* Card 1: Data */}
          <div className="rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 shadow-xs text-center flex flex-col items-center justify-between">
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-3">
                <Calendar className="h-6 w-6" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">Datas do Evento</h3>
              <p className="text-sm font-bold text-purple-700 mt-1">13, 14 e 15 de Novembro</p>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Edição 2026 da Festa Novo Amanhecer. Três dias de festa para toda a família!
              </p>
            </div>
            <span className="mt-4 text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-100/70 text-purple-800">
              Sexta, Sábado e Domingo
            </span>
          </div>

          {/* Card 2: Horários */}
          <div className="rounded-3xl border border-amber-200/80 bg-amber-50/30 p-6 shadow-xs text-center flex flex-col items-center justify-between">
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">Horário de Funcionamento</h3>
              <div className="text-xs sm:text-sm font-bold text-amber-900 mt-1 space-y-0.5">
                <p>Sexta: a partir das <strong>19h00</strong></p>
                <p>Sábado e Domingo: de <strong>18h30 às 22h00</strong></p>
              </div>
              <p className="text-xs text-slate-600 mt-2 font-medium">
                Barracas abertas até o término das celebrações.
              </p>
            </div>
            <span className="mt-4 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
              Até o Término das Celebrações
            </span>
          </div>

          {/* Card 3: Localização */}
          <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50/30 p-6 shadow-xs text-center flex flex-col items-center justify-between">
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">Localização</h3>
              <p className="text-sm font-bold text-emerald-800 mt-1">Igreja Batista da Manhã</p>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Tv. Maria Alice, 121 - Mutondo, São Gonçalo - RJ
              </p>
            </div>
            <a
              href="https://maps.google.com/?q=Travessa+Maria+Alice+121+Mutondo+Sao+Goncalo+RJ"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 px-3.5 py-1.5 rounded-full transition-colors"
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>Abrir no Google Maps</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-2">
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Dúvidas Frequentes</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900">
              Perguntas e Respostas
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs"
              >
                <h4 className="text-sm sm:text-base font-bold text-slate-900">
                  {faq.q}
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
