'use client';

import React from 'react';
import { Wallet, Smartphone, MessageCircle, ShieldCheck, ArrowRight, Zap } from 'lucide-react';

export default function CashlessExplainer() {
  const steps = [
    {
      step: '01',
      title: 'Pegue e Carregue seu Cartão',
      desc: 'Dirija-se aos caixas do evento e coloque créditos usando PIX, Cartão (débito/crédito) ou Dinheiro. Você recebe seu cartão exclusivo na hora!',
      icon: Wallet,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      step: '02',
      title: 'Peça por Aproximação',
      desc: 'Nas barracas de comida e bebidas, basta aproximar seu cartão da maquininha. O débito é instantâneo e seu pedido vai direto para o preparo.',
      icon: Zap,
      color: 'bg-amber-100 text-amber-700',
    },
    {
      step: '03',
      title: 'Aviso de Pedido Pronto no WhatsApp',
      desc: 'Nada de ficar esperando em pé no balcão: assim que seu pastel ou espetinho estiver quentinho, você recebe um aviso no WhatsApp para retirar.',
      icon: MessageCircle,
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      step: '04',
      title: 'Segurança Total e Reembolso',
      desc: 'Transações criptografadas e seguras. Sobrou saldo no final da noite? É só passar no caixa para estorno com total transparência.',
      icon: ShieldCheck,
      color: 'bg-blue-100 text-blue-600',
    },
  ];

  return (
    <section id="como-funciona" className="py-12 sm:py-16 bg-slate-50/70 border-y border-slate-100">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold mb-3">
            <Smartphone className="h-3.5 w-3.5" />
            <span>Tecnologia FestaPay</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Como Funciona o Consumo na Festa?
          </h2>
          <p className="text-xs sm:text-sm md:text-base text-slate-600 mt-2">
            Chega de comprar fichas de papel e enfrentar duas filas! Nosso sistema 100% Cashless foi pensado para seu conforto e rapidez.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {steps.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative flex flex-col justify-between bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`h-11 w-11 rounded-2xl ${item.color} flex items-center justify-center shadow-xs`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-300">
                      PASSO {item.step}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
