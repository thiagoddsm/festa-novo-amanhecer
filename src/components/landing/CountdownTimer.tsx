'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Sparkles } from 'lucide-react';

interface CountdownTimerProps {
  targetDate?: string | Date;
  className?: string;
}

function calculateTimeLeft(targetDate: string | Date) {
  const target = new Date(targetDate).getTime();
  const now = Date.now();
  const difference = target - now;

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((difference % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, isPast: false };
}

export default function CountdownTimer({
  targetDate = '2026-11-14T18:00:00',
  className = '',
}: CountdownTimerProps) {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPast: false,
  });

  useEffect(() => {
    setMounted(true);
    const updateCountdown = () => {
      setTimeLeft(calculateTimeLeft(targetDate));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!mounted) {
    return (
      <div className={`mx-auto max-w-xl rounded-3xl border border-purple-200/80 bg-white/95 p-4 sm:p-5 shadow-sm ${className}`}>
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-purple-700 mb-3">
          <Clock className="h-3.5 w-3.5 text-purple-600" />
          <span>CONTAGEM REGRESSIVA PARA A FESTA</span>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center">
          {['DIAS', 'HORAS', 'MINUTOS', 'SEGUNDOS'].map((label, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center justify-center rounded-2xl bg-purple-50/60 p-2 sm:p-3 border border-purple-100/60"
            >
              <span className="font-mono text-xl sm:text-3xl font-black text-slate-300 leading-none">--</span>
              <span className="text-[10px] sm:text-xs font-bold tracking-wider text-purple-400 mt-1">{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (timeLeft.isPast) {
    return (
      <div className={`mx-auto max-w-md rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-center shadow-xs ${className}`}>
        <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold text-sm sm:text-base">
          <Sparkles className="h-5 w-5 animate-bounce" />
          <span>A FESTA JÁ COMEÇOU! Os portões estão abertos!</span>
        </div>
        <p className="text-xs text-emerald-600 mt-1">Venha saborear nossas comidas e celebrar conosco.</p>
      </div>
    );
  }

  const timeBlocks = [
    { label: 'DIAS', value: timeLeft.days },
    { label: 'HORAS', value: timeLeft.hours },
    { label: 'MINUTOS', value: timeLeft.minutes },
    { label: 'SEGUNDOS', value: timeLeft.seconds },
  ];

  return (
    <div
      suppressHydrationWarning
      className={`mx-auto max-w-xl rounded-3xl border border-purple-200/80 bg-white/95 p-4 sm:p-5 shadow-sm backdrop-blur-sm ${className}`}
    >
      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-purple-700 mb-3">
        <Clock className="h-3.5 w-3.5 text-purple-600 animate-pulse" />
        <span>CONTAGEM REGRESSIVA PARA A FESTA</span>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center">
        {timeBlocks.map((block, idx) => (
          <div
            key={idx}
            className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-purple-50/80 to-purple-100/40 p-2 sm:p-3 border border-purple-100/60 shadow-2xs"
          >
            <span
              suppressHydrationWarning
              className="font-mono text-xl sm:text-3xl font-black text-slate-900 leading-none"
            >
              {String(block.value).padStart(2, '0')}
            </span>
            <span className="text-[10px] sm:text-xs font-bold tracking-wider text-purple-700 mt-1">
              {block.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
