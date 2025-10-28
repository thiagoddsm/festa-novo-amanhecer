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
import { Loader2, Camera, CameraOff, SwitchCamera } from 'lucide-react';
import QrScanner from 'react-qr-scanner';

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (data: string) => void;
}

export default function QrScannerDialog({ open, onOpenChange, onScan }: QrScannerDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hasCamera, setHasCamera] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const handleScan = (data: any) => {
    if (data) {
      onScan(data.text);
      onOpenChange(false);
    }
  };

  const handleError = (err: any) => {
    console.error(err);
    if (err?.name === 'NotAllowedError') {
         toast({
            variant: 'destructive',
            title: 'Permissão da Câmera Negada',
            description: 'Por favor, libere o acesso à câmera nas configurações do seu navegador.',
        });
    } else {
        toast({
            variant: 'destructive',
            title: 'Erro de Câmera',
            description: 'Não foi possível acessar a câmera. Tente usar a outra câmera.',
        });
    }
    setHasCamera(false);
  };
  
  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    setLoading(true);
    setHasCamera(true);
  }

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
          {loading && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
          {hasCamera ? (
             <QrScanner
                key={facingMode} // Add key to force re-initialization on camera change
                onScan={handleScan}
                onError={handleError}
                onLoad={() => setLoading(false)}
                constraints={{ audio: false, video: { facingMode: facingMode } }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
             <div className="flex flex-col items-center gap-2 text-destructive">
                <CameraOff className="h-10 w-10" />
                <p>Câmera não disponível.</p>
             </div>
          )}
        </div>
        <DialogFooter className="justify-between">
          <Button variant="outline" onClick={toggleCamera}>
            <SwitchCamera className="mr-2 h-4 w-4"/> Trocar Câmera
          </Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
