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
  const [isScanning, setIsScanning] = useState(true);

  const handleScanSuccess = (decodedText: string) => {
    setIsScanning(false);
    onScan(decodedText);
    onOpenChange(false); // Close dialog on success
  };

  const handleScanFailure = (error: string) => {
    // Don't show toast for "not found" errors, but display other errors
    if (!error.toLowerCase().includes('qr code')) {
      setScanError(error);
    }
  };
  
  const handleOpenChange = (isOpen: boolean) => {
      if (!isOpen) {
          setIsScanning(false);
      } else {
          setScanError(null);
          setIsScanning(true);
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
           {isScanning && !scanError && (
            <QrScanner 
                onScanSuccess={handleScanSuccess} 
                onScanFailure={handleScanFailure}
            />
           )}
           {scanError && (
             <Alert variant="destructive" className="m-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro no Scanner</AlertTitle>
                <AlertDescription>
                    {scanError}
                </AlertDescription>
            </Alert>
           )}
            {!scanError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground -z-10">
                    <Loader2 className="animate-spin h-6 w-6" />
                    <p>Iniciando a câmera...</p>
                </div>
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
