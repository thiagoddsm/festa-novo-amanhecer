'use client';

import React from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthProvider } from '@/hooks/use-auth-context';
import LandingNavbar from '@/components/landing/LandingNavbar';
import HeroSection from '@/components/landing/HeroSection';
import StallsShowcase from '@/components/landing/StallsShowcase';
import CashlessExplainer from '@/components/landing/CashlessExplainer';
import EventInfoSection from '@/components/landing/EventInfoSection';
import LandingFooter from '@/components/landing/LandingFooter';

export default function HomePage() {
  return (
    <FirebaseClientProvider>
      <AuthProvider>
        <div className="min-h-screen bg-white text-slate-900 selection:bg-purple-200 selection:text-purple-900 flex flex-col scroll-smooth">
          <LandingNavbar />
          <main className="flex-1">
            <HeroSection />
            <StallsShowcase />
            <CashlessExplainer />
            <EventInfoSection />
          </main>
          <LandingFooter />
        </div>
      </AuthProvider>
    </FirebaseClientProvider>
  );
}
