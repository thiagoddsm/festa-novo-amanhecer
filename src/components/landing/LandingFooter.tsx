'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';
import { Shield, Heart, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth-context';

export default function LandingFooter() {
  const { user } = useAuth();

  return (
    <footer className="border-t border-slate-200 bg-white py-10 sm:py-14">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-100">
          {/* Brand */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <Logo className="text-purple-600 scale-95" />
            <p className="text-xs text-slate-500 mt-2 max-w-sm">
              Tecnologia Cashless para festas comunitárias e eventos. Consumo ágil, seguro e sem filas.
            </p>
          </div>

          {/* Quick Staff Button */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link
              href={user ? (user.role === 'PDV' ? '/pos' : '/dashboard') : '/login'}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-2xs transition-all hover:border-purple-300"
            >
              <Shield className="h-4 w-4 text-purple-600" />
              <span>{user ? 'Acessar Painel Operacional' : 'Área Restrita da Equipe & Admin'}</span>
            </Link>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 text-center sm:text-left">
          <p>
            © 2026 Festa Novo Amanhecer • Realização Igreja Batista.
          </p>
          <p className="flex items-center gap-1">
            Feito com <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500 inline" /> e tecnologia FestaPay
          </p>
        </div>
      </div>
    </footer>
  );
}
