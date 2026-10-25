'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, Smartphone, CheckCircle, RefreshCw, LogOut, ShieldAlert, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import type { Pdv } from '@/lib/definitions';
import { connectPdvWhatsapp, checkPdvWhatsappStatus, disconnectPdvWhatsapp } from '@/lib/actions';
import { getPdvInstanceName } from '@/lib/whatsapp';
import { useTenant } from '@/hooks/use-tenant-context';
import QRCode from 'react-qr-code';

interface PdvWhatsappDialogProps {
  pdv: Pdv;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: () => void;
}

export default function PdvWhatsappDialog({
  pdv,
  open,
  onOpenChange,
  onStatusChange,
}: PdvWhatsappDialogProps) {
  const { toast } = useToast();
  const { currentTenant, currentEvent } = useTenant();

  const defaultSuggestedInstance = getPdvInstanceName(
    currentTenant?.name || pdv.tenant_id,
    currentEvent?.name || pdv.event_id,
    pdv.nome
  );

  const [status, setStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>(
    pdv.whatsapp?.status || 'DISCONNECTED'
  );
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>(pdv.whatsapp?.phoneNumber);
  const [instanceName, setInstanceName] = useState<string | undefined>(pdv.whatsapp?.instanceName);

  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrCodeString, setQrCodeString] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [customInstanceName, setCustomInstanceName] = useState<string>(
    pdv.whatsapp?.instanceName || defaultSuggestedInstance
  );
  const [customToken, setCustomToken] = useState<string>(
    pdv.whatsapp?.token || ''
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Sync state when pdv prop updates
  useEffect(() => {
    if (pdv.whatsapp) {
      setStatus(pdv?.whatsapp?.status || 'DISCONNECTED');
      setPhoneNumber(pdv.whatsapp.phoneNumber);
      setInstanceName(pdv.whatsapp.instanceName);
      if (pdv.whatsapp.instanceName) {
        setCustomInstanceName(pdv.whatsapp.instanceName);
      } else {
        setCustomInstanceName(defaultSuggestedInstance);
      }
      if (pdv.whatsapp.token) setCustomToken(pdv.whatsapp.token);
    } else {
      setCustomInstanceName(defaultSuggestedInstance);
    }
  }, [pdv, defaultSuggestedInstance]);

  // Clean polling on unmount or close
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopPolling();
    }
  }, [open, stopPolling]);

  // Check connection state via polling
  const startStatusPolling = useCallback(
    (targetInstance: string, targetToken?: string) => {
      stopPolling();
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await checkPdvWhatsappStatus(pdv.id, targetInstance, targetToken);
          if (res?.status === 'CONNECTED') {
            setStatus('CONNECTED');
            setPhoneNumber(res.phoneNumber);
            setQrBase64(null);
            setQrCodeString(null);
            stopPolling();
            toast({
              title: 'WhatsApp Conectado! 🎉',
              description: `A barraca ${pdv.nome} agora enviará notificações diretamente.`,
            });
            onStatusChange?.();
          } else if (res?.status === 'DISCONNECTED' && status === 'CONNECTED') {
            setStatus('DISCONNECTED');
            setPhoneNumber(undefined);
            stopPolling();
            onStatusChange?.();
          }
        } catch (e) {
          console.error('[PdvWhatsappDialog] Polling error:', e);
        }
      }, 3000);
    },
    [pdv.id, pdv.nome, status, stopPolling, toast, onStatusChange]
  );

  // Trigger Connect & Generate QR
  const handleConnect = async () => {
    setIsLoading(true);
    setQrBase64(null);
    setQrCodeString(null);
    setPairingCode(null);

    try {
      const targetInst = customInstanceName.trim() || defaultSuggestedInstance;
      const targetTok = customToken.trim() || undefined;

      const res = await connectPdvWhatsapp(pdv.id, pdv.event_id, targetInst, targetTok);
      if (res.success) {
        if (res.state === 'open') {
          setStatus('CONNECTED');
          toast({ title: 'Já conectado!', description: 'Esta barraca já possui sessão ativa.' });
          onStatusChange?.();
        } else {
          setStatus('CONNECTING');
          if (res.base64) setQrBase64(res.base64);
          if (res.code) setQrCodeString(res.code);
          if (res.pairingCode) setPairingCode(res.pairingCode);

          if (res.instanceName) {
            setInstanceName(res.instanceName);
            startStatusPolling(res.instanceName, targetTok);
          }
        }
      } else {
        setStatus('ERROR');
        toast({
          variant: 'destructive',
          title: 'Erro ao gerar QR Code',
          description: res.error || 'Não foi possível conectar à Evolution API.',
        });
      }
    } catch (err) {
      setStatus('ERROR');
      toast({
        variant: 'destructive',
        title: 'Erro de Conexão',
        description: 'Falha ao solicitar conexão com WhatsApp.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    if (!instanceName) return;
    setIsDisconnecting(true);
    try {
      const res = await disconnectPdvWhatsapp(pdv.id, instanceName);
      if (res?.status === 'success') {
        setStatus('DISCONNECTED');
        setPhoneNumber(undefined);
        setQrBase64(null);
        setQrCodeString(null);
        stopPolling();
        toast({ title: 'Desconectado', description: 'WhatsApp da barraca desconectado.' });
        onStatusChange?.();
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: res.message });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao desconectar.' });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-1">
          <DialogTitle className="flex items-center justify-center gap-2 text-base sm:text-lg">
            <MessageSquare className="h-5 w-5 text-green-600 shrink-0" />
            WhatsApp da Barraca: {pdv.nome}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-center">
            Conecte o celular do atendente para que os avisos de pedido pronto saiam diretamente por este WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 py-1">
          {/* Status Badge */}
          {status === 'CONNECTED' ? (
            <div className="flex flex-col items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg w-full text-center">
              <div className="flex items-center gap-2 text-green-700 font-semibold text-xs sm:text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                WhatsApp Conectado
              </div>
              {phoneNumber && (
                <Badge variant="outline" className="font-mono text-xs bg-white">
                  📱 +{phoneNumber}
                </Badge>
              )}
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Todas as notificações de <strong>Pedido Pronto</strong> desta barraca serão enviadas por este número.
              </p>
            </div>
          ) : status === 'CONNECTING' ? (
            <div className="flex flex-col items-center gap-2.5 w-full">
              <Badge variant="secondary" className="gap-1 animate-pulse bg-yellow-100 text-yellow-800 text-[11px]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Aguardando leitura do QR Code...
              </Badge>

              {/* QR Code Display */}
              <div className="p-2.5 bg-white border rounded-xl shadow-sm flex items-center justify-center">
                {qrBase64 ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`}
                    alt="QR Code WhatsApp"
                    className="w-44 h-44 sm:w-48 sm:h-48 object-contain"
                  />
                ) : qrCodeString ? (
                  <QRCode value={qrCodeString} size={180} />
                ) : (
                  <div className="w-44 h-44 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-7 w-7 animate-spin text-green-600" />
                    <span className="text-xs">Gerando QR Code...</span>
                  </div>
                )}
              </div>

              {pairingCode && (
                <div className="text-[11px] text-muted-foreground bg-muted/60 p-1.5 rounded-md w-full text-center">
                  Código de pareamento: <strong className="font-mono text-foreground font-bold">{pairingCode}</strong>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground text-center max-w-xs">
                Abra o WhatsApp &gt; <strong>Aparelhos Conectados</strong> &gt; <strong>Conectar Aparelho</strong> e aponte a câmera.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5 py-1 w-full">
              <div className="p-3 bg-muted/40 rounded-full">
                <Smartphone className="h-8 w-8 text-muted-foreground opacity-60" />
              </div>
              <Badge variant="outline" className="text-muted-foreground text-xs">
                🔴 WhatsApp Desconectado
              </Badge>
              <div className="text-[11px] text-muted-foreground bg-blue-50 border border-blue-200 text-blue-800 p-2.5 rounded-md flex items-start gap-2 text-left w-full">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Fallback ativo:</strong> Se esta barraca não for conectada, as mensagens serão enviadas automaticamente pelo WhatsApp central do evento.
                </span>
              </div>

              {/* Advanced Evolution Instance Config */}
              <div className="w-full text-left pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium transition-colors"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Configuração da Instância Evolution
                  {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {showAdvanced && (
                  <div className="mt-2 p-2.5 bg-muted/40 rounded-lg border space-y-2 text-xs">
                    <div>
                      <Label className="text-[11px] font-medium text-muted-foreground">Nome da Instância</Label>
                      <Input
                        value={customInstanceName}
                        onChange={(e) => setCustomInstanceName(e.target.value)}
                        placeholder={defaultSuggestedInstance}
                        className="h-8 text-xs mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-medium text-muted-foreground">Token / API Key da Instância (Opcional)</Label>
                      <Input
                        type="password"
                        value={customToken}
                        onChange={(e) => setCustomToken(e.target.value)}
                        placeholder="Deixe em branco para usar a Chave Mestra Global"
                        className="h-8 text-xs mt-1 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <DialogFooter className="shrink-0 flex flex-col sm:flex-row gap-2 pt-2 border-t mt-1 w-full sm:justify-between">
          {status === 'CONNECTED' ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="w-full sm:w-auto"
            >
              {isDisconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <LogOut className="h-4 w-4 mr-1" />
              )}
              Desconectar Celular
            </Button>
          ) : status === 'CONNECTING' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnect}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Atualizar QR Code
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={isLoading}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <MessageSquare className="h-4 w-4 mr-2" />
              )}
              Conectar WhatsApp
            </Button>
          )}

          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
