'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, CreditCard, ArrowRight, X } from 'lucide-react';
import { QrScanner } from './QrScanner';

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (data: string) => void;
}

export default function QrScannerDialog({ open, onOpenChange, onScan }: QrScannerDialogProps) {
  const [manualCode, setManualCode] = useState('');

  const handleScanSuccess = (decodedText: string) => {
    onScan(decodedText.trim());
    onOpenChange(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setManualCode('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-5 gap-4">
        <DialogHeader className="text-left space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Camera className="w-5 h-5" />
            </div>
            Ler Cartão
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Aponte a câmera para o QR code ou digite o código abaixo.
          </DialogDescription>
        </DialogHeader>

        {/* Scanner Viewport */}
        <div className="flex flex-col items-center">
          {open && (
            <QrScanner
              onScanSuccess={handleScanSuccess}
            />
          )}
        </div>

        {/* Manual Code Fallback Input */}
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Não conseguiu ler? Digite o código:</span>
          </div>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              type="text"
              placeholder="Ex: festa-2025-..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="h-10 text-sm font-mono bg-background"
            />
            <Button 
              type="submit" 
              size="sm" 
              disabled={!manualCode.trim()} 
              className="h-10 px-3 font-semibold gap-1 shrink-0"
            >
              Usar
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>

        {/* Footer */}
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleClose} 
          className="w-full h-11 text-sm font-medium gap-1.5"
        >
          <X className="w-4 h-4" />
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
