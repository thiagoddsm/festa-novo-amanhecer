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
import { Camera, AlertCircle, Loader2 } from 'lucide-react';
import { QrScanner } from './QrScanner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (data: string) => void;
}

export default function QrScannerDialog({ open, onOpenChange, onScan }: QrScannerDialogProps) {
  const { toast } = useToast();
  const [scanError, setScanError] = useState<string | null>(null);
  
  const handleScanSuccess = (decodedText: string) => {
    onScan(decodedText);
    onOpenChange(false); // Close dialog on success
  };

  const handleScanFailure = (error: string) => {
    console.error("Scan Failure:", error);
    // Only show toast for critical errors, not for "QR code not found"
    if (!error.toLowerCase().includes('qr code') && !error.toLowerCase().includes('not found')) {
       setScanError(error);
    }
  };

  // Reset error when dialog is opened
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
        setScanError(null);
    }
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera /> Escanear QR Code
          </DialogTitle>
          <DialogDescription>
            Aponte a câmera para o QR code do cartão do cliente.
          </DialogDescription>
        </DialogHeader>
        
        <div className="relative flex min-h-[300px] w-full items-center justify-center overflow-hidden rounded-md border bg-muted">
           {open && !scanError && <QrScanner onScanSuccess={handleScanSuccess} onScanFailure={handleScanFailure} />}
           {scanError && (
             <Alert variant="destructive" className="m-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro na Câmera</AlertTitle>
                <AlertDescription>
                    {scanError}
                    <br />
                    Verifique as permissões da câmera no seu navegador e tente novamente.
                </AlertDescription>
            </Alert>
           )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="w-full">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
