'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { Pdv } from '@/lib/definitions';
import { getPdvIconConfig } from '@/lib/pdv-icons';
import { Utensils, Sparkles, CheckCircle2, ChevronRight, Store, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// All 11 registered booths for Festa Novo Amanhecer 2026
const REGISTERED_STALLS_2026 = [
  {
    id: 'IUGieSpcoC3Abbkg72UQ',
    nome: 'Hambúrguer',
    subtitle: 'Artesanais na chapa',
    desc: 'Smash burgers e tradicionais com queijo derretido, bacon crocante e molho especial preparados na hora.',
    tag: 'Chapa Quente',
    icon: 'hamburguer',
  },
  {
    id: 'TwvZsawBvWIH0oYx9S58',
    nome: 'Pastel',
    subtitle: 'Crocantes e sequinhos',
    desc: 'Massa crocante frita na hora com recheios fartos de carne, queijo, pizza e opções doces irresistíveis.',
    tag: 'Frito na Hora',
    icon: 'pastel',
  },
  {
    id: 'sb71YAWFgTgGGTnDyTDW',
    nome: 'Batata Frita',
    subtitle: 'Porções generosas',
    desc: 'Batatas douradinhas e super crocantes, com opção de queijo cheddar e bacon picadinho.',
    tag: 'Crocância Máxima',
    icon: 'batata',
  },
  {
    id: '6t7VGqj7ogBht7PDQPcI',
    nome: 'Churrasco',
    subtitle: 'Assado na brasa',
    desc: 'Espetinhos selecionados de alcatra, frango, linguiça e pão de alho com farofa e molho à campanha.',
    tag: 'Na Brasa',
    icon: 'churrasco',
  },
  {
    id: '2NjkEzLvtDxEBhkOSlRG',
    nome: 'Pizza',
    subtitle: 'Massa artesanal',
    desc: 'Fatias quentinhas com bastante queijo derretido, molho de tomate temperado e orégano fresco.',
    tag: 'Sabor Tradicional',
    icon: 'pizza',
  },
  {
    id: '26nTwvFk5C7rQwW6iKng',
    nome: 'Cachorro Quente',
    subtitle: 'Completo e caprichado',
    desc: 'Salsicha suculenta, molho especial da casa, milho, ervilha, queijo ralado e batata palha à vontade.',
    tag: 'Receita Especial',
    icon: 'hotdog',
  },
  {
    id: 'KPh0ZhxGOfzpPrCvcbB4',
    nome: 'Massa',
    subtitle: 'Macarronada no capricho',
    desc: 'Pratos de massas frescas acompanhadas de molho bolonhesa encorpado ou molho branco cremoso.',
    tag: 'Receita de Família',
    icon: 'massa',
  },
  {
    id: 'WeIZzPUzZ8TlciJu7dhA',
    nome: 'Caldo',
    subtitle: 'Reconfortante e quentinho',
    desc: 'Caldos tradicionais servidos fumegantes com cheiro verde, queijo ralado e torradas crocantes.',
    tag: 'Quentinho',
    icon: 'caldo',
  },
  {
    id: 'UCVzH4IUj2O7Bq8EotPx',
    nome: 'Doces',
    subtitle: 'Sobremesas artesanais',
    desc: 'Bolos no pote gourmet, tortas confeitadas, pudim, brigadeiros e delícias para adoçar sua noite.',
    tag: 'Sobremesas',
    icon: 'doces',
  },
  {
    id: 'JfmJ4mWnXGEclhLvrwVt',
    nome: 'Bebidas',
    subtitle: 'Bebidas geladas',
    desc: 'Refrigerantes em lata, sucos de frutas, mate da casa e água mineral bem gelada.',
    tag: 'Geladíssimas',
    icon: 'bebidas',
  },
  {
    id: '5cQMrl4izWS2L3J4FGRP',
    nome: 'Kids',
    subtitle: 'Diversão para as crianças',
    desc: 'Espaço com brinquedos, recreação, pescaria e atividades para os pequenos se divertirem a noite toda.',
    tag: 'Espaço Infantil',
    icon: 'kids',
  },
];

export default function StallsShowcase() {
  const firestore = useFirestore();
  const [stalls, setStalls] = useState(REGISTERED_STALLS_2026);

  useEffect(() => {
    if (!firestore) return;

    // Listen to PDVs of Festa Novo Amanhecer 2026 (event: DoKmbiQ8pd3M71yTC9iA)
    const pdvQuery = query(
      collection(firestore, 'pdvs'),
      where('event_id', '==', 'DoKmbiQ8pd3M71yTC9iA')
    );

    const unsubscribe = onSnapshot(
      pdvQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const loaded = snapshot.docs
            .map((doc) => {
              const data = doc.data() as Pdv;
              const matchingDefault = REGISTERED_STALLS_2026.find(
                (d) => d.id === doc.id || d.nome.toLowerCase() === data.nome.toLowerCase()
              );

              return {
                id: doc.id,
                nome: data.nome,
                subtitle: matchingDefault?.subtitle || 'Barraca Oficial 2026',
                desc: matchingDefault?.desc || 'Ingredientes frescos e preparo cuidadoso para você e sua família.',
                tag: matchingDefault?.tag || 'Confirmada',
                icon: data.icon || matchingDefault?.icon || 'comida',
              };
            })
            // Filter out Caixa Central from gastronomic stalls list
            .filter((s) => !s.nome.toLowerCase().includes('caixa'));

          if (loaded.length > 0) {
            setStalls(loaded);
          }
        }
      },
      (err) => {
        console.warn('Using default stalls list for 2026:', err);
      }
    );

    return () => unsubscribe();
  }, [firestore]);

  return (
    <section id="barracas" className="py-14 sm:py-20 bg-slate-50/60 border-t border-slate-100">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold mb-3">
            <Utensils className="h-3.5 w-3.5" />
            <span>Praça de Alimentação & Atrações</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Barracas Gastronômicas da Festa
          </h2>
          <p className="text-xs sm:text-sm md:text-base text-slate-600 mt-2">
            Todas as <strong>11 barracas oficiais</strong> cadastradas na Festa Novo Amanhecer 2026. 
            Preparo na hora e atendimento ágil com seu cartão cashless!
          </p>
        </div>

        {/* 11 Stalls Grid - Clean, Modern & Informative (No individual items) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {stalls.map((stall) => {
            const config = getPdvIconConfig(stall.icon, stall.nome);
            const Icon = config.icon;

            return (
              <div
                key={stall.id}
                className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md hover:border-purple-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top: Icon + Tag */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className={`h-11 w-11 rounded-2xl ${config.iconBg} ${config.iconColor} flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                      {stall.tag}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <h3 className="font-extrabold text-slate-900 text-lg leading-snug group-hover:text-purple-700 transition-colors">
                    {stall.nome}
                  </h3>
                  <p className="text-xs font-semibold text-amber-700 mt-0.5">
                    {stall.subtitle}
                  </p>

                  {/* Booth Description */}
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {stall.desc}
                  </p>
                </div>

                {/* Bottom Card Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                    <CheckCircle2 className="h-3 w-3" />
                    Cartão Cashless
                  </span>

                  <Link
                    href={`/igreja-batista-da-manha/pedidos?pdv=${stall.id}`}
                    className="inline-flex items-center gap-1 font-semibold text-[11px] text-purple-600 hover:text-purple-800 transition-colors"
                  >
                    <span>Ver Fila</span>
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Operating Hours Note */}
        <div className="mt-10 p-4 sm:p-5 rounded-2xl bg-white border border-purple-100 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                Horário de Funcionamento das Barracas
              </h4>
              <p className="text-xs text-slate-600">
                A partir das <strong>19h00 na sexta-feira</strong> e das <strong>18h30 no sábado e domingo</strong>, abertas até às <strong>22h00</strong> (até o término das celebrações).
              </p>
            </div>
          </div>

          <Button
            asChild
            size="sm"
            className="rounded-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-9 px-4 shrink-0"
          >
            <Link href="/igreja-batista-da-manha/pedidos">
              <Store className="h-3.5 w-3.5 mr-1.5" />
              Acompanhar Pedidos ao Vivo
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
