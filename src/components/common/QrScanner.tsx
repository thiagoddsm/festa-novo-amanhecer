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
  const [hasCameraError, setHasCameraError] = useState(false);

  const handleResult = (result: any) => {
    if (result) {
      onScan(result.getText());
      onOpenChange(false);
    }
  };

  const handleError = (error: any) => {
    console.error(error);
    setHasCameraError(true);
    // We show the error inside the dialog now, toast is optional
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
            setHasCameraError(false); // Reset error state on close
        }
    }}>
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
           {open && !hasCameraError && (
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
           {hasCameraError && (
                <div className="p-4 text-center">
                     <Alert variant="destructive">
                        <CameraOff className="h-4 w-4" />
                        <AlertTitle>Erro de Câmera</AlertTitle>
                        <AlertDescription>
                            Não foi possível acessar a câmera. Verifique as permissões no seu navegador e tente novamente.
                        </AlertDescription>
                    </Alert>
                </div>
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
