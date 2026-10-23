'use client';

import React from 'react';
import { Calendar, Clock, MapPin, Sparkles, HelpCircle, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EventInfoSection() {
  const faqs = [
    {
      q: 'A entrada na festa é gratuita?',
      a: 'Sim! A entrada é 100% gratuita para toda a comunidade, amigos e famílias. Você só paga pelo que consumir nas barracas.',
    },
    {
      q: 'Quais formas de pagamento são aceitas nos caixas?',
      a: 'Você pode recarregar seu cartão nos caixas utilizando PIX, cartões de débito, crédito ou dinheiro em espécie.',
    },
    {
      q: 'E se sobrar saldo no meu cartão?',
      a: 'Você pode solicitar o reembolso do saldo restante diretamente no guichê de caixa antes de ir embora.',
    },
    {
      q: 'Como funciona o aviso de pedido pronto no WhatsApp?',
      a: 'Ao carregar seu cartão, informe seu número de WhatsApp. Quando você fizer um pedido em qualquer barraca (como pastel ou churrasco), assim que estiver pronto para retirada, enviamos uma mensagem avisando para você buscar sem esperar em filas!',
    },
  ];

  return (
    <section id="localizacao" className="py-12 sm:py-20 bg-slate-50/70 border-t border-slate-100">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-14">
          {/* Card 1: Data */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs text-center flex flex-col items-center">
            <div className="h-12 w-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-3">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Data do Evento</h3>
            <p className="text-sm font-semibold text-purple-600 mt-1">Edição Especial 2026</p>
            <p className="text-xs text-slate-500 mt-1">Consulte os dias e a programação com a liderança local.</p>
          </div>

          {/* Card 2: Horários */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs text-center flex flex-col items-center">
            <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
              <Clock className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Horário de Funcionamento</h3>
            <p className="text-sm font-semibold text-amber-700 mt-1">A partir das 18h00</p>
            <p className="text-xs text-slate-500 mt-1">Barracas abertas até o término das celebrações.</p>
          </div>

          {/* Card 3: Localização */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs text-center flex flex-col items-center">
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <MapPin className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Localização</h3>
            <p className="text-sm font-semibold text-emerald-700 mt-1">Igreja Batista</p>
            <p className="text-xs text-slate-500 mt-1">Pátio social com ampla infraestrutura coberta.</p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/70 text-slate-700 text-xs font-semibold mb-2">
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
                className="rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5 shadow-xs"
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
