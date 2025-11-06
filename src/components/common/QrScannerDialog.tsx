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
import { Camera, AlertCircle, Loader2, Video } from 'lucide-react';
import { QrScanner } from './QrScanner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Html5Qrcode } from 'html5-qrcode';

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (data: string) => void;
}

export default function QrScannerDialog({ open, onOpenChange, onScan }: QrScannerDialogProps) {
  const { toast } = useToast();
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open) {
      // Reset state when dialog opens
      setIsLoading(true);
      setScanError(null);
      setPermissionGranted(false);

      Html5Qrcode.getCameras()
        .then(devices => {
          if (devices && devices.length) {
            setCameras(devices);
            // Default to the first back-facing camera, or just the first camera
            const backCamera = devices.find(d => d.label.toLowerCase().includes('back'));
            setSelectedCameraId(backCamera?.id || devices[0].id);
          }
          setPermissionGranted(true);
        })
        .catch(err => {
          setScanError("Permissão da câmera negada ou nenhuma câmera encontrada. Por favor, verifique as configurações do seu navegador.");
          setPermissionGranted(false);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open]);

  const handleScanSuccess = (decodedText: string) => {
    onScan(decodedText);
    onOpenChange(false); // Close dialog on success
  };

  const handleScanFailure = (error: string) => {
    // We get a lot of "QR code not found" messages which are normal, so we don't treat them as errors.
    // We can log them for debugging if needed but won't show them to the user.
  };

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

        <div className="relative flex min-h-[300px] w-full items-center justify-center overflow-hidden rounded-md border bg-muted">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="animate-spin h-6 w-6" />
              <p>Solicitando permissão da câmera...</p>
            </div>
          )}

          {scanError && (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro no Scanner</AlertTitle>
              <AlertDescription>{scanError}</AlertDescription>
            </Alert>
          )}

          {permissionGranted && selectedCameraId && !scanError && (
             <QrScanner
                cameraId={selectedCameraId}
                onScanSuccess={handleScanSuccess}
                onScanFailure={handleScanFailure}
            />
          )}
        </div>

        {cameras.length > 1 && (
            <div className="space-y-2">
                <Label>Selecionar Câmera</Label>
                <Select value={selectedCameraId} onValueChange={setSelectedCameraId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione uma câmera" />
                    </SelectTrigger>
                    <SelectContent>
                        {cameras.map(camera => (
                            <SelectItem key={camera.id} value={camera.id}>
                                {camera.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="w-full">
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
