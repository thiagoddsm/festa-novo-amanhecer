'use client';

import React, { useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import type { Pdv, MenuItem } from '@/lib/definitions';
import { getPdvIconConfig } from '@/lib/pdv-icons';
import { Utensils, Sparkles, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Fallback showcase items if database is empty or loading
const DEFAULT_STALLS = [
  {
    id: '1',
    nome: 'Barraca do Pastel',
    icon: 'pastel',
    items: [
      { nome: 'Pastel de Carne', preco: 'R$ 10,00', desc: 'Carne moída temperada e massa crocante' },
      { nome: 'Pastel de Queijo', preco: 'R$ 10,00', desc: 'Mussarela derretida com orégano' },
      { nome: 'Pastel de Pizza', preco: 'R$ 12,00', desc: 'Queijo, presunto, tomate e orégano' },
      { nome: 'Pastel de Nutella c/ Banana', preco: 'R$ 12,00', desc: 'Sobremesa irresistível' },
    ],
  },
  {
    id: '2',
    nome: 'Barraca do Churrasco',
    icon: 'churrasco',
    items: [
      { nome: 'Espetinho de Alcatra', preco: 'R$ 12,00', desc: 'Acompanha farofa temperada e vinagrete' },
      { nome: 'Espetinho de Frango c/ Bacon', preco: 'R$ 10,00', desc: 'Peito suculento enrolado no bacon' },
      { nome: 'Espetinho de Linguiça Toscana', preco: 'R$ 10,00', desc: 'Assado na brasa' },
      { nome: 'Pão de Alho Especial', preco: 'R$ 8,00', desc: 'Recheado com queijo e ervas' },
    ],
  },
  {
    id: '3',
    nome: 'Barraca de Bebidas',
    icon: 'bebidas',
    items: [
      { nome: 'Refrigerante Lata', preco: 'R$ 6,00', desc: 'Coca-Cola, Guaraná e Zero' },
      { nome: 'Água Mineral c/ ou s/ gás', preco: 'R$ 4,00', desc: 'Garrafa 500ml bem gelada' },
      { nome: 'Suco Natural', preco: 'R$ 8,00', desc: 'Laranja ou Uva 300ml' },
      { nome: 'Cerveja Lata', preco: 'R$ 8,00', desc: 'Pilsen geladíssima' },
    ],
  },
  {
    id: '4',
    nome: 'Barraca de Doces',
    icon: 'doces',
    items: [
      { nome: 'Bolo no Pote Gourmet', preco: 'R$ 10,00', desc: 'Chocolate com morango ou cenoura' },
      { nome: 'Churros com Doce de Leite', preco: 'R$ 8,00', desc: 'Passado no açúcar e canela' },
      { nome: 'Fatia de Pudim Tradicional', preco: 'R$ 7,00', desc: 'Com calda de caramelo' },
      { nome: 'Brigadeiro Artesanal', preco: 'R$ 4,00', desc: 'Chocolate nobre 50% cacau' },
    ],
  },
];

export default function StallsShowcase() {
  const firestore = useFirestore();
  const [stalls, setStalls] = useState<any[]>(DEFAULT_STALLS);

  useEffect(() => {
    if (!firestore) return;

    const pdvCollection = collection(firestore, 'pdvs');
    const unsubscribe = onSnapshot(pdvCollection, async (snapshot) => {
      if (snapshot.empty) return;

      const loadedStalls: any[] = [];
      for (const doc of snapshot.docs) {
        const pdvData = { id: doc.id, ...doc.data() } as Pdv;
        // Load menu items
        try {
          const menuSnap = await getDocs(collection(firestore, 'pdvs', doc.id, 'menuItems'));
          const menuItems = menuSnap.docs.map((m) => {
            const mData = m.data() as MenuItem;
            return {
              nome: mData.nome,
              preco: (mData.preco_centavos / 100).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }),
              desc: (mData.ingredientes || []).join(', '),
            };
          });

          loadedStalls.push({
            id: pdvData.id,
            nome: pdvData.nome,
            icon: pdvData.icon,
            items: menuItems.length > 0 ? menuItems : DEFAULT_STALLS[0].items,
          });
        } catch {
          loadedStalls.push({
            id: pdvData.id,
            nome: pdvData.nome,
            icon: pdvData.icon,
            items: [],
          });
        }
      }

      if (loadedStalls.length > 0) {
        setStalls(loadedStalls);
      }
    }, (err) => {
      console.warn("Using fallback stalls:", err);
    });

    return () => unsubscribe();
  }, [firestore]);

  return (
    <section id="barracas" className="py-12 sm:py-20 bg-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold mb-3">
            <Utensils className="h-3.5 w-3.5" />
            <span>Cardápio & Praça de Alimentação</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Barracas Gastronômicas da Festa
          </h2>
          <p className="text-xs sm:text-sm md:text-base text-slate-600 mt-2">
            Preparamos tudo com muito carinho para você e sua família. Confira as delícias que esperam por você:
          </p>
        </div>

        {/* Stalls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {stalls.map((stall) => {
            const config = getPdvIconConfig(stall.icon, stall.nome);
            const Icon = config.icon;

            return (
              <div
                key={stall.id}
                className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-2xl ${config.iconBg} ${config.iconColor} flex items-center justify-center shadow-xs`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg sm:text-xl">
                          {stall.nome}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                          Preparo na hora • Ingredientes selecionados
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="mt-4 space-y-3">
                    {stall.items.slice(0, 4).map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-3 text-left p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 leading-snug">
                            {item.nome}
                          </p>
                          {item.desc && (
                            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                              {item.desc}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="secondary"
                          className="shrink-0 font-mono font-bold text-xs bg-purple-50 text-purple-700 hover:bg-purple-100"
                        >
                          {item.preco}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Pagamento via Cartão da Festa
                  </span>
                  <span className="font-medium text-purple-600">
                    Aviso no WhatsApp
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
