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
  ShieldCheck,
  Settings2,
  ChevronDown,
  ChevronUp,
  KeyRound,
  QrCode as QrCodeIcon,
  Copy,
  Check,
} from 'lucide-react';
import type { TenantEvent } from '@/lib/definitions';
import { connectEventWhatsapp, checkEventWhatsappStatus, disconnectEventWhatsapp } from '@/lib/actions';
import { getPdvInstanceName } from '@/lib/whatsapp';
import QRCode from 'react-qr-code';

interface EventWhatsappDialogProps {
  tenantId: string;
  tenantName: string;
  event: TenantEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: () => void;
}

export default function EventWhatsappDialog({
  tenantId,
  tenantName,
  event,
  open,
  onOpenChange,
  onStatusChange,
}: EventWhatsappDialogProps) {
  const { toast } = useToast();

  const defaultSuggestedInstance = getPdvInstanceName(
    tenantName,
    event.name,
    'caixa'
  );

  const [status, setStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>(
    event.whatsapp?.status || 'DISCONNECTED'
  );
  const [phoneNumber, setPhoneNumber] = useState<string | undefined>(event.whatsapp?.phoneNumber);
  const [instanceName, setInstanceName] = useState<string | undefined>(event.whatsapp?.instanceName);

  const [activeTab, setActiveTab] = useState<'PAIRING' | 'QR'>('PAIRING');
  const [inputPhone, setInputPhone] = useState<string>(event.whatsapp?.phoneNumber || '');

  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrCodeString, setQrCodeString] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [customInstanceName, setCustomInstanceName] = useState<string>(
    event.whatsapp?.instanceName || defaultSuggestedInstance
  );
  const [customToken, setCustomToken] = useState<string>(
    event.whatsapp?.token || ''
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Sync state when event prop updates
  useEffect(() => {
    if (event.whatsapp) {
      setStatus(event?.whatsapp?.status || 'DISCONNECTED');
      setPhoneNumber(event.whatsapp.phoneNumber);
      setInstanceName(event.whatsapp.instanceName);
      if (event.whatsapp.phoneNumber) setInputPhone(event.whatsapp.phoneNumber);
      if (event.whatsapp.instanceName) {
        setCustomInstanceName(event.whatsapp.instanceName);
      } else {
        setCustomInstanceName(defaultSuggestedInstance);
      }
      if (event.whatsapp.token) setCustomToken(event.whatsapp.token);
    } else {
      setCustomInstanceName(defaultSuggestedInstance);
    }
  }, [event, defaultSuggestedInstance]);

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
          const res = await checkEventWhatsappStatus(tenantId, event.id, targetInstance, targetToken);
          if (res?.status === 'CONNECTED') {
            setStatus('CONNECTED');
            setPhoneNumber(res.phoneNumber);
            setQrBase64(null);
            setQrCodeString(null);
            setPairingCode(null);
            stopPolling();
            toast({
              title: 'WhatsApp Conectado! 🎉',
              description: `O WhatsApp do evento "${event.name}" está ativo para envios.`,
            });
            onStatusChange?.();
          } else if (res?.status === 'DISCONNECTED' && status === 'CONNECTED') {
            setStatus('DISCONNECTED');
            setPhoneNumber(undefined);
            stopPolling();
            onStatusChange?.();
          }
        } catch (e) {
          console.error('[EventWhatsappDialog] Polling error:', e);
        }
      }, 3000);
    },
    [tenantId, event.id, event.name, status, stopPolling, toast, onStatusChange]
  );

  // Trigger Connect
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

      const res = await connectEventWhatsapp(
        tenantId,
        event.id,
        targetInst,
        targetTok,
        mode === 'PAIRING' ? inputPhone.trim() : undefined,
        mode
      );

      if (res.success) {
        if (res.state === 'open') {
          setStatus('CONNECTED');
          toast({ title: 'Já conectado!', description: 'Este evento já possui sessão ativa do WhatsApp.' });
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
    const inst = instanceName || customInstanceName || defaultSuggestedInstance;
    if (!inst) return;

    setIsDisconnecting(true);
    try {
      const res = await disconnectEventWhatsapp(tenantId, event.id, inst, customToken.trim() || undefined);
      if (res?.status === 'success') {
        setStatus('DISCONNECTED');
        setPhoneNumber(undefined);
        setQrBase64(null);
        setQrCodeString(null);
        setPairingCode(null);
        stopPolling();
        toast({ title: 'Desconectado', description: res.message });
        onStatusChange?.();
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: res.message });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao desconectar WhatsApp.' });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600 shrink-0" />
            <DialogTitle className="text-base sm:text-lg">WhatsApp do Evento / Caixa</DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            Conecte o WhatsApp do evento <strong>{event.name}</strong> para disparo de comprovantes e cartões.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 py-1">
          {/* Status Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-lg border bg-muted/40">
            <div className="flex items-center gap-2 min-w-0">
              <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{event.name} (Caixa Central)</p>
                {phoneNumber ? (
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{phoneNumber}</p>
                ) : (
                  <p
                    className="text-[11px] text-muted-foreground font-mono truncate max-w-[220px] sm:max-w-[280px]"
                    title={instanceName || defaultSuggestedInstance}
                  >
                    Instância: {instanceName || defaultSuggestedInstance}
                  </p>
                )}
              </div>
            </div>
            <div className="shrink-0 self-end sm:self-auto">
              {status === 'CONNECTED' && (
                <Badge className="bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 text-[11px] px-2 py-0.5">
                  <CheckCircle className="h-3 w-3" /> Conectado
                </Badge>
              )}
              {status === 'CONNECTING' && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 flex items-center gap-1 text-[11px] px-2 py-0.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> {pairingCode ? 'Aguardando Código' : 'Aguardando Leitura'}
                </Badge>
              )}
              {status === 'DISCONNECTED' && (
                <Badge variant="outline" className="text-muted-foreground text-[11px] px-2 py-0.5">
                  Desconectado
                </Badge>
              )}
              {status === 'ERROR' && (
                <Badge variant="destructive" className="flex items-center gap-1 text-[11px] px-2 py-0.5">
                  <ShieldAlert className="h-3 w-3" /> Falha
                </Badge>
              )}
            </div>
          </div>

          {/* Fallback Notice when Disconnected */}
          {status !== 'CONNECTED' && (
            <div className="p-2.5 rounded-lg border bg-blue-50/70 border-blue-200 text-xs text-blue-900 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-950">Envio Garantido: Fallback IBM Ativo</p>
                <p className="text-[11px] text-blue-800 leading-tight mt-0.5">
                  Mesmo enquanto o WhatsApp exclusivo deste evento não estiver pareado, todas as mensagens de novos cartões e comprovantes continuam sendo enviadas automaticamente pelo número central da igreja (IBM).
                </p>
              </div>
            </div>
          )}

          {/* Connected state confirmation */}
          {status === 'CONNECTED' && (
            <div className="p-3 border rounded-xl bg-green-50/60 border-green-200 text-center space-y-1.5">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
              <h4 className="font-semibold text-green-900 text-xs sm:text-sm">WhatsApp do Evento Ativo!</h4>
              <p className="text-[11px] sm:text-xs text-green-800">
                Todas as boas-vindas com QR Code, recargas e avisos de estorno deste evento serão enviados por este número.
              </p>
            </div>
          )}

          {/* Connecting State */}
          {status === 'CONNECTING' && (
            <div className="flex flex-col items-center justify-center p-3 border rounded-xl bg-white shadow-sm space-y-3">
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
                    <p className="font-bold text-emerald-950">Como usar no WhatsApp do Caixa:</p>
                    <ol className="list-decimal pl-4 space-y-0.5">
                      <li>Abra o <strong>WhatsApp</strong> no celular</li>
                      <li>Toque nos <strong>3 pontinhos</strong> &gt; <strong>Aparelhos conectados</strong></li>
                      <li>Toque em <strong>Conectar um aparelho</strong></li>
                      <li>Toque em <strong>&ldquo;Conectar com número de telefone&rdquo;</strong></li>
                      <li>Digite este código de 8 dígitos</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-white border rounded-xl flex items-center justify-center">
                  {qrBase64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`}
                      alt="QR Code WhatsApp"
                      className="w-44 h-44 sm:w-48 sm:h-48 object-contain"
                    />
                  ) : qrCodeString ? (
                    <QRCode value={qrCodeString} size={180} />
                  ) : (
                    <div className="w-44 h-44 flex flex-col items-center justify-center text-muted-foreground">
                      <Loader2 className="h-7 w-7 animate-spin text-green-600 mb-2" />
                      <span className="text-xs">Gerando QR Code...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Disconnected / Tabs Choice */}
          {status !== 'CONNECTED' && status !== 'CONNECTING' && (
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
                  <Label htmlFor="event-phone-input" className="text-xs font-semibold flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                    Número do WhatsApp do Caixa (com DDD)
                  </Label>
                  <Input
                    id="event-phone-input"
                    type="tel"
                    value={inputPhone}
                    onChange={(e) => setInputPhone(e.target.value)}
                    placeholder="Ex: 21 98888-7777"
                    className="h-10 text-sm font-medium"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Gera um código de 8 dígitos para digitar diretamente no WhatsApp (sem precisar escanear QR Code).
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
          )}

          {/* Advanced Settings Accordion */}
          <div className="border rounded-md p-2 bg-muted/20">
            <button
              type="button"
              className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span className="flex items-center gap-1">
                <Settings2 className="h-3.5 w-3.5" />
                Configurações Avançadas da Instância
              </span>
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showAdvanced && (
              <div className="space-y-2 mt-2 pt-2 border-t text-xs">
                <div>
                  <Label htmlFor="customInstanceName" className="text-xs">Nome da Instância Evolution</Label>
                  <Input
                    id="customInstanceName"
                    value={customInstanceName}
                    onChange={(e) => setCustomInstanceName(e.target.value)}
                    placeholder={defaultSuggestedInstance}
                    className="h-8 text-xs font-mono mt-1"
                    disabled={status === 'CONNECTED' || status === 'CONNECTING'}
                  />
                </div>

                <div>
                  <Label htmlFor="customToken" className="text-xs">Token Customizado da Instância (Opcional)</Label>
                  <Input
                    id="customToken"
                    type="password"
                    value={customToken}
                    onChange={(e) => setCustomToken(e.target.value)}
                    placeholder="Deixe em branco para usar a Chave Mestra Global"
                    className="h-8 text-xs font-mono mt-1"
                    disabled={status === 'CONNECTED' || status === 'CONNECTING'}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="shrink-0 flex-col sm:flex-row gap-2 pt-2 border-t mt-1">
          {status === 'CONNECTED' ? (
            <Button
              variant="destructive"
              size="sm"
              className="w-full sm:w-auto"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
              Desconectar WhatsApp
            </Button>
          ) : status === 'CONNECTING' ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => handleConnect(activeTab)}
              disabled={isLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
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
