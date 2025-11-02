'use client';

import { cn } from '@/lib/utils';
import { CreditCard, Signal } from 'lucide-react';

export const Logo = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center gap-2 text-primary font-bold", className)} {...props}>
    <div className="relative h-8 w-8">
      <CreditCard className="absolute h-8 w-8" />
      <Signal className="absolute -right-1 -top-1 h-5 w-5 -rotate-45" />
    </div>
    <span className="text-xl tracking-tighter">FestaPay</span>
  </div>
);
