'use client';

import { useState, useEffect } from 'react';
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
import { Camera, CameraOff, Loader2 } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Scanner } from '@yudiel/react-qr-scanner';

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (data: string) => void;
}

export default function QrScannerDialog({ open, onOpenChange, onScan }: QrScannerDialogProps) {
  const { toast } = useToast();
  const [hasCameraError, setHasCameraError] = useState<string | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleResult = (result: any) => {
    // The result object from `@yudiel/react-qr-scanner` has the text directly.
    // The old library used a `getText()` method. This is the fix.
    if (result && result.text) {
      onScan(result.text);
      onOpenChange(false); // Close the dialog after a successful scan
    }
  };

  const handleError = (error: any) => {
    console.error("Scanner Error:", error);
    let errorMessage = 'Não foi possível acessar a câmera.';
    if (error?.name === 'NotAllowedError') {
        errorMessage = 'A permissão para acessar a câmera foi negada. Verifique as configurações do seu navegador.';
    } else if (error?.name === 'NotFoundError') {
        errorMessage = 'Nenhuma câmera foi encontrada no seu dispositivo.';
    }
    setHasCameraError(errorMessage);
    setIsCameraOn(false);
    setIsStarting(false);
  };
  
  const startCamera = () => {
      setHasCameraError(null);
      setIsStarting(true);
      // Let the component handle the camera turning on after this state change.
  }

  // Reset state when dialog is closed to ensure it's clean for the next open
  useEffect(() => {
    if (!open) {
      setIsCameraOn(false);
      setHasCameraError(null);
      setIsStarting(false);
    }
  }, [open]);

  // Effect to turn on the camera after the user clicks the button
  useEffect(() => {
      if (isStarting && open && !isCameraOn) {
          // This timeout gives the UI time to show the "Iniciando..." message
          // before the browser permission prompt might freeze the UI.
          setTimeout(() => {
              setIsCameraOn(true);
          }, 100);
      }
  }, [isStarting, open, isCameraOn]);


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
        
        <div className="relative flex h-72 w-full items-center justify-center overflow-hidden rounded-md border bg-muted">
           {isCameraOn && !hasCameraError ? (
             <Scanner
                onScan={handleResult}
                onError={handleError}
                constraints={{ 
                    video: { 
                        facingMode: 'environment',
                        width: { ideal: 1920 }, // Higher resolution to hint for main camera
                        height: { ideal: 1080 }
                    } 
                }}
                styles={{
                    container: { width: '100%', height: '100%', paddingTop: 0, background: 'black' }
                }}
                onDecode={() => setIsStarting(false)} // Turn off "Iniciando..." once it starts decoding
             />
           ) : (
                <div className="flex flex-col items-center justify-center text-center p-4">
                    {hasCameraError ? (
                         <Alert variant="destructive">
                            <CameraOff className="h-4 w-4" />
                            <AlertTitle>Erro de Câmera</AlertTitle>
                            <AlertDescription>
                                {hasCameraError}
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <p className="text-muted-foreground">A câmera está desligada.</p>
                    )}
                </div>
           )}
           {isStarting && !hasCameraError && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
                   <Loader2 className="h-8 w-8 animate-spin" />
                   <p className="mt-2">Iniciando câmera...</p>
               </div>
           )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">
           {!isCameraOn && !hasCameraError ? (
                 <Button onClick={startCamera} className="w-full sm:w-auto">
                    <Camera className="mr-2 h-4 w-4" />
                    Ligar Câmera
                </Button>
            ) : (
                <Button variant="outline" onClick={() => setIsCameraOn(false)} className="w-full sm:w-auto">
                    <CameraOff className="mr-2 h-4 w-4" />
                    Desligar Câmera
                </Button>
            )}

          <Button variant="secondary" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
