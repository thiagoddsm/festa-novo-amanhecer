'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { Shield, Menu, X, ArrowRight, Sparkles, UserCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth-context';

export default function LandingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  const navLinks = [
    { label: 'Sobre a Festa', href: '#sobre' },
    { label: 'Barracas & Cardápio', href: '#barracas' },
    { label: 'Como Funciona (Cashless)', href: '#como-funciona' },
    { label: 'Horários & Local', href: '#localizacao' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-purple-100/60 bg-white/85 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <Logo className="text-purple-600 scale-90" />
          <div className="hidden sm:flex flex-col">
            <span className="text-xs font-bold text-slate-900 tracking-tight leading-none group-hover:text-purple-600 transition-colors">
              Festa Novo Amanhecer
            </span>
            <span className="text-[10px] text-purple-600 font-semibold tracking-wide">
              Edição 2026 • Igreja Batista
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs font-medium text-slate-600 hover:text-purple-600 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right CTA: Staff / Admin Access */}
        <div className="hidden sm:flex items-center gap-2">
          {user ? (
            <Button
              asChild
              size="sm"
              className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-xs text-xs font-semibold"
            >
              <Link href={user.role === 'PDV' ? '/pos' : '/dashboard'}>
                <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                Painel da Equipe
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl border-purple-200 bg-purple-50/50 hover:bg-purple-100 text-purple-700 shadow-2xs text-xs font-semibold"
            >
              <Link href="/login">
                <Shield className="mr-1.5 h-3.5 w-3.5 text-purple-600" />
                Acesso da Equipe
              </Link>
            </Button>
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
        <div className="md:hidden border-b border-purple-100 bg-white/95 px-4 pt-2 pb-4 shadow-lg backdrop-blur-md animate-in slide-in-from-top-2">
          <nav className="flex flex-col space-y-2">
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
              <Button
                asChild
                className="w-full rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-2.5"
              >
                <Link href={user ? (user.role === 'PDV' ? '/pos' : '/dashboard') : '/login'}>
                  <Shield className="mr-1.5 h-4 w-4" />
                  {user ? 'Acessar Painel da Equipe' : 'Área da Equipe / Acesso Staff'}
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
