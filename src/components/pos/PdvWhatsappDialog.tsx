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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  MessageSquare,
  Smartphone,
  CheckCircle,
  RefreshCw,
  LogOut,
  ShieldAlert,
  Settings2,
  ChevronDown,
  ChevronUp,
  KeyRound,
  QrCode as QrCodeIcon,
  Copy,
  Check,
} from 'lucide-react';
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

  const [activeTab, setActiveTab] = useState<'PAIRING' | 'QR'>('PAIRING');
  const [inputPhone, setInputPhone] = useState<string>(pdv.whatsapp?.phoneNumber || '');

  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrCodeString, setQrCodeString] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);

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
      if (pdv.whatsapp.phoneNumber) setInputPhone(pdv.whatsapp.phoneNumber);
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

  // Auto-verify live connection status from Evolution API when dialog opens
  useEffect(() => {
    if (!open || !pdv.id) return;
    const targetInst = pdv.whatsapp?.instanceName || defaultSuggestedInstance;
    checkPdvWhatsappStatus(pdv.id, targetInst, pdv.whatsapp?.token).then((res) => {
      if (res.status === 'CONNECTED') {
        setStatus('CONNECTED');
        setPhoneNumber(res.phoneNumber);
      } else {
        setStatus('DISCONNECTED');
        setPhoneNumber(undefined);
      }
    }).catch((err) => console.warn('[PdvWhatsappDialog] Error verifying live status on open:', err));
  }, [open, pdv.id, pdv.whatsapp?.instanceName, pdv.whatsapp?.token, defaultSuggestedInstance]);

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
            setPairingCode(null);
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

  // Trigger Connect (QR mode or Pairing code mode)
  const handleConnect = async (mode: 'QR' | 'PAIRING' = activeTab) => {
    if (mode === 'PAIRING' && !inputPhone.trim()) {
      toast({
        variant: 'destructive',
        title: 'Número obrigatório',
        description: 'Digite o número do WhatsApp com DDD (ex: 21999998888) para gerar o código de 8 dígitos.',
      });
      return;
    }

    setIsLoading(true);
    setQrBase64(null);
    setQrCodeString(null);
    setPairingCode(null);

    try {
      const targetInst = customInstanceName.trim() || defaultSuggestedInstance;
      const targetTok = customToken.trim() || undefined;

      const res = await connectPdvWhatsapp(
        pdv.id,
        pdv.event_id,
        targetInst,
        targetTok,
        mode === 'PAIRING' ? inputPhone.trim() : undefined,
        mode
      );

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
          title: mode === 'PAIRING' ? 'Erro ao gerar código' : 'Erro ao gerar QR Code',
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

  const copyPairingCode = () => {
    if (!pairingCode) return;
    navigator.clipboard?.writeText(pairingCode.replace(/\D/g, '') || pairingCode);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
    toast({ title: 'Código copiado!', description: 'Cole no WhatsApp na tela "Conectar com número de telefone".' });
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
        setPairingCode(null);
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
            Conecte o celular do atendente via código de 8 dígitos ou QR Code para enviar avisos de pedido pronto.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 py-1">
          {/* Status Connected */}
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
            <div className="flex flex-col items-center gap-3 w-full">
              <Badge variant="secondary" className="gap-1 animate-pulse bg-yellow-100 text-yellow-800 text-[11px]">
                <Loader2 className="h-3 w-3 animate-spin" />
                {pairingCode ? 'Aguardando confirmação no WhatsApp...' : 'Aguardando leitura do QR Code...'}
              </Badge>

              {/* Pairing Code Big Box */}
              {pairingCode ? (
                <div className="w-full p-4 bg-emerald-50/80 border-2 border-emerald-300 rounded-2xl flex flex-col items-center gap-2 text-center shadow-xs">
                  <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                    Código de 8 dígitos
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-3xl sm:text-4xl font-extrabold tracking-widest text-emerald-700 select-all">
                      {pairingCode}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={copyPairingCode}
                      className="h-9 w-9 bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-100 shrink-0"
                      title="Copiar código"
                    >
                      {copiedPin ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="text-xs text-emerald-900 bg-white/80 p-2.5 rounded-xl border border-emerald-200 text-left w-full space-y-1 mt-1 leading-relaxed">
                    <p className="font-bold text-emerald-950">Como usar no WhatsApp do atendente:</p>
                    <ol className="list-decimal pl-4 space-y-0.5">
                      <li>Abra o <strong>WhatsApp</strong> no celular</li>
                      <li>Toque nos <strong>3 pontinhos</strong> (ou <strong>Configurações</strong>) &gt; <strong>Aparelhos conectados</strong></li>
                      <li>Toque em <strong>Conectar um aparelho</strong></li>
                      <li>Toque na opção <strong>&ldquo;Conectar com número de telefone&rdquo;</strong> (abaixo do leitor)</li>
                      <li>Digite este código de 8 dígitos</li>
                    </ol>
                  </div>
                </div>
              ) : (
                /* QR Code Display */
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
                      <span className="text-xs">Gerando conexão...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Disconnected: Choice between Pairing Code & QR Code */
            <div className="flex flex-col gap-3 py-1 w-full">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-muted-foreground text-xs">
                  🔴 WhatsApp Desconectado
                </Badge>
                <span className="text-[11px] text-muted-foreground">Escolha como conectar:</span>
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'PAIRING' | 'QR')} className="w-full">
                <TabsList className="grid grid-cols-2 w-full h-10">
                  <TabsTrigger value="PAIRING" className="gap-1.5 text-xs font-semibold">
                    <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
                    Código de 8 Dígitos
                  </TabsTrigger>
                  <TabsTrigger value="QR" className="gap-1.5 text-xs font-semibold">
                    <QrCodeIcon className="h-3.5 w-3.5 text-primary" />
                    QR Code
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Pairing Code */}
                <TabsContent value="PAIRING" className="pt-2 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="pdv-phone-input" className="text-xs font-semibold flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                      Número do WhatsApp do Atendente (com DDD)
                    </Label>
                    <Input
                      id="pdv-phone-input"
                      type="tel"
                      value={inputPhone}
                      onChange={(e) => setInputPhone(e.target.value)}
                      placeholder="Ex: 21 98888-7777"
                      className="h-10 text-sm font-medium"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      O sistema gera um código de 8 dígitos para você digitar diretamente no WhatsApp do celular (sem precisar escanear QR).
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={() => handleConnect('PAIRING')}
                    disabled={isLoading || !inputPhone.trim()}
                    className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm gap-2"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    Gerar Código de 8 Dígitos
                  </Button>
                </TabsContent>

                {/* Tab 2: QR Code */}
                <TabsContent value="QR" className="pt-2 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Gere o QR Code tradicional para escanear pela câmera do WhatsApp em <strong>Aparelhos Conectados</strong>.
                  </p>
                  <Button
                    type="button"
                    onClick={() => handleConnect('QR')}
                    disabled={isLoading}
                    className="w-full h-10 bg-green-600 hover:bg-green-700 text-white font-bold text-xs sm:text-sm gap-2"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCodeIcon className="h-4 w-4" />}
                    Gerar QR Code na Tela
                  </Button>
                </TabsContent>
              </Tabs>

              {/* Fallback Notice */}
              <div className="text-[11px] text-muted-foreground bg-blue-50 border border-blue-200 text-blue-800 p-2.5 rounded-md flex items-start gap-2 text-left w-full mt-1">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Fallback ativo:</strong> Se esta barraca não for conectada, as mensagens de pedido pronto serão enviadas automaticamente pelo WhatsApp central do evento.
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
              onClick={() => handleConnect(activeTab)}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Gerar Novo Código / QR
            </Button>
          ) : null}

          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
