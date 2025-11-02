'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Camera, CameraOff } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { QrScanner } from '@yudiel/react-qr-scanner';

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (data: string) => void;
}

export default function QrScannerDialog({ open, onOpenChange, onScan }: QrScannerDialogProps) {
  const { toast } = useToast();

  const handleResult = (result: any) => {
    if (result) {
      onScan(result.getText());
      onOpenChange(false);
    }
  };

  const handleError = (error: any) => {
    console.error(error);
    toast({
      variant: 'destructive',
      title: 'Erro no Scanner',
      description: error?.message || 'Não foi possível acessar a câmera.',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera /> Escanear QR Code
          </DialogTitle>
          <DialogDescription>
            Aponte a câmera para o QR code do cartão do cliente.
          </DialogDescription>
        </DialogHeader>
        
        <div className="relative flex h-64 w-full items-center justify-center overflow-hidden rounded-md border bg-muted">
           {open && (
             <QrScanner
                onDecode={handleResult}
                onError={handleError}
                constraints={{
                    facingMode: 'environment'
                }}
                styles={{
                    container: { width: '100%', height: '100%', paddingTop: 0 }
                }}
             />
           )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
