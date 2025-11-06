'use client';

import { useState, useRef, useEffect } from 'react';
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
import { Camera, AlertCircle, Loader2, Flashlight, Video } from 'lucide-react';
import { QrScanner } from './QrScanner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Html5Qrcode, type CameraDevice } from 'html5-qrcode';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (data: string) => void;
}

export default function QrScannerDialog({ open, onOpenChange, onScan }: QrScannerDialogProps) {
  const { toast } = useToast();
  const [scanError, setScanError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  useEffect(() => {
    if (open) {
        Html5Qrcode.getCameras()
            .then(devices => {
                if (devices && devices.length) {
                    setCameras(devices);
                    // Default to the first back-facing camera, or just the first camera
                    const backCamera = devices.find(d => d.label.toLowerCase().includes('back'));
                    setSelectedCameraId(backCamera?.id || devices[0].id);
                }
            })
            .catch(err => {
                setScanError("Não foi possível acessar as câmeras. Verifique as permissões.");
            });
    } else {
        // Reset state when dialog closes
        setCameras([]);
        setSelectedCameraId('');
        setScanError(null);
        setTorchOn(false);
    }
  }, [open]);

  const handleScanSuccess = (decodedText: string) => {
    onScan(decodedText);
    onOpenChange(false); // Close dialog on success
  };

  const handleScanFailure = (error: string) => {
    if (!error.toLowerCase().includes('qr code') && !error.toLowerCase().includes('not found')) {
       setScanError(error);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
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
           {open && selectedCameraId && !scanError && (
            <QrScanner 
                onScanSuccess={handleScanSuccess} 
                onScanFailure={handleScanFailure}
                cameraId={selectedCameraId}
                torchOn={torchOn}
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
            {!selectedCameraId && !scanError && (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="animate-spin h-6 w-6" />
                    <p>Procurando câmeras...</p>
                </div>
            )}
        </div>
        
        <div className="flex flex-wrap gap-2 justify-between">
           {cameras.length > 1 && (
             <Select value={selectedCameraId} onValueChange={setSelectedCameraId}>
                <SelectTrigger className="w-auto flex-grow">
                    <Video className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Selecionar câmera" />
                </SelectTrigger>
                <SelectContent>
                    {cameras.map(camera => (
                        <SelectItem key={camera.id} value={camera.id}>
                            {camera.label}
                        </SelectItem>
                    ))}
                </SelectContent>
             </Select>
           )}
            <Button 
                variant="outline"
                size="icon"
                onClick={() => setTorchOn(prev => !prev)}
                className={cn(torchOn && 'bg-yellow-300 hover:bg-yellow-400')}
                title="Ligar/Desligar Lanterna"
            >
                <Flashlight className="h-5 w-5" />
            </Button>
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
