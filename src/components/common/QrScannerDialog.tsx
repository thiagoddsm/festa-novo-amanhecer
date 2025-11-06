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
import { Camera, AlertCircle } from 'lucide-react';
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
     // Ignore "QR code not found" and "NotFoundException" errors, which are frequent and expected during scanning.
     // We only care about critical errors like camera permission issues.
    if (!error.includes('No QR code found') && !error.includes('NotFoundException')) {
        console.error(`QR Scan Error: ${error}`);
        setScanError("Não foi possível ler o QR code. Tente novamente ou verifique as permissões da câmera.");
    }
  };

  // Reset error when dialog opens
  if (open && scanError) {
      setScanError(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera /> Escanear QR Code
          </DialogTitle>
          <DialogDescription>
            Aponte a câmera para o QR code do cartão do cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-md border">
            {scanError ? (
                 <Alert variant="destructive" className="m-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erro no Scanner</AlertTitle>
                    <AlertDescription>{scanError}</AlertDescription>
                </Alert>
            ) : (
                <QrScanner
                    onScanSuccess={handleScanSuccess}
                    onScanFailure={handleScanFailure}
                />
            )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="w-full">
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
