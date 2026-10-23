'use client';

import React from 'react';
import { PDV_ICON_OPTIONS, PdvIconOption } from '@/lib/pdv-icons';
import { Check } from 'lucide-react';

interface PdvIconPickerProps {
  value?: string;
  onChange: (iconId: string) => void;
  className?: string;
}

export default function PdvIconPicker({ value, onChange, className = '' }: PdvIconPickerProps) {
  return (
    <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[280px] overflow-y-auto p-1 pr-1.5 ${className}`}>
      {PDV_ICON_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isSelected = value === opt.id;

        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`group relative flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center ${
              isSelected
                ? 'border-purple-600 bg-purple-50/50 shadow-xs ring-1 ring-purple-600/30'
                : 'border-slate-200/80 bg-white hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {isSelected && (
              <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs">
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              </span>
            )}
            <div
              className={`h-9 w-9 rounded-xl ${opt.iconBg} ${opt.iconColor} flex items-center justify-center shadow-2xs mb-1.5 transition-transform group-hover:scale-105`}
            >
              <Icon className="h-4.5 w-4.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 line-clamp-1 leading-tight">
              {opt.label.split('/')[0].trim()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
