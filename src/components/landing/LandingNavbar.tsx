'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { Shield, Menu, X, UserCheck, BellRing } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth-context';

export default function LandingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  const navLinks = [
    { label: 'Sobre', href: '/#sobre' },
    { label: 'Barracas', href: '/#barracas' },
    { label: 'Como Funciona', href: '/#como-funciona' },
    { label: 'Horários & Local', href: '/#localizacao' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <Logo className="text-purple-600 scale-90" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-900 tracking-tight leading-none group-hover:text-purple-600 transition-colors">
              Festa Novo Amanhecer
            </span>
            <span className="text-[10px] text-purple-600 font-semibold tracking-wide">
              Igreja Batista da Manhã • 2026
            </span>
          </div>
        </Link>

        {/* Clean Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs font-medium text-slate-600 hover:text-purple-600 transition-colors py-1"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right Actions: Clean & Balanced */}
        <div className="hidden sm:flex items-center gap-3">
          <Button
            asChild
            size="sm"
            className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-xs font-bold gap-1.5 h-8.5 px-3.5"
          >
            <Link href="/igreja-batista-da-manha/pedidos">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-ping shrink-0" />
              <BellRing className="h-3.5 w-3.5 shrink-0" />
              <span>Acompanhar Pedido</span>
            </Link>
          </Button>

          {user ? (
            <Link
              href={user.role === 'PDV' ? '/pos' : '/dashboard'}
              className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-full transition-colors"
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Painel</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-purple-700 px-2 py-1 transition-colors"
              title="Acesso da Equipe / Staff"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Equipe</span>
            </Link>
          )}
        </div>

        {/* Mobile menu trigger */}
        <div className="flex sm:hidden items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="h-9 w-9 text-slate-700"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-100 bg-white/98 px-4 pt-2 pb-4 shadow-lg backdrop-blur-md">
          <nav className="flex flex-col space-y-2">
            <Link
              href="/igreja-batista-da-manha/pedidos"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 p-2.5 text-xs font-bold text-white shadow-xs"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-ping" />
              <BellRing className="h-4 w-4" />
              <span>Acompanhar Meu Pedido ao Vivo</span>
            </Link>

            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
              >
                {link.label}
              </a>
            ))}

            <div className="pt-2 border-t border-slate-100 mt-1">
              <Link
                href={user ? (user.role === 'PDV' ? '/pos' : '/dashboard') : '/login'}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-purple-700 p-2 rounded-lg bg-slate-50"
              >
                <Shield className="h-3.5 w-3.5 text-purple-600" />
                <span>{user ? 'Acessar Painel da Equipe' : 'Área da Equipe / Acesso Staff'}</span>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
