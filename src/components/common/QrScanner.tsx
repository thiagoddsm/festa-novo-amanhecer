'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Camera, CameraOff, SwitchCamera } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
// A stable alternative that might have different performance characteristics.
// Keeping this as an optional import if direct camera access causes issues.
// import { QrReader } from 'react-qr-reader';

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (data: string) => void;
}

export default function QrScannerDialog({ open, onOpenChange, onScan }: QrScannerDialogProps) {
  const { toast } = useToast();
  const [hasCameraPermission, setHasCameraPermission] = useState(true); // Assume true initially
  const videoRef = useRef<HTMLVideoElement>(null);

  // For this simplified version, we are not implementing a live scanner
  // to avoid dependency issues. Instead, this component will guide the user
  // to use their device's camera functionality if available.
  // The hooks for a live scanner would go here.

  useEffect(() => {
    // This effect would handle camera initialization
    // For now, it just checks for mediaDevices support.
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCameraPermission(false);
    }
  }, []);


  const handleClose = () => {
      onOpenChange(false);
  }

  // This is a placeholder for the scan result handling.
  // In a real implementation, a library would call this.
  const handleResult = (result: any) => {
    if (result) {
      onScan(result);
      handleClose();
    }
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
        
        {/*
            The QrReader component is commented out to avoid dependency conflicts.
            A more stable solution would involve a different library or a custom implementation.
        */}
        <div className="relative flex h-64 w-full items-center justify-center overflow-hidden rounded-md border bg-muted">
            <video ref={videoRef} className="w-full aspect-video rounded-md hidden" autoPlay muted />
             <div className='text-center p-4'>
                <CameraOff className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className='mt-4 text-sm text-muted-foreground'>A funcionalidade de scanner ao vivo está temporariamente desabilitada para garantir a estabilidade.</p>
                <p className='mt-2 text-sm text-muted-foreground'>Por favor, digite o código do QR code manualmente.</p>
             </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={handleClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
