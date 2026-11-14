'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import type { Card as CardType } from '@/lib/definitions';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/use-tenant-context';
import {
  MessageCircle,
  ExternalLink,
  Copy,
  CheckCircle2,
  Search,
  RotateCcw,
  Sparkles,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Filter,
  Users,
  Send,
  Loader2,
  Play,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_MESSAGE_TEMPLATE = `Olá, {nome}! 🥳

Aqui está o link do seu cartão da Festa Novo Amanhecer:
{link}

📱 Toque no link acima para:
• Ver seu saldo e extrato ao vivo
• Acompanhar o status dos seus pedidos na cozinha
• Fazer recarga online via PIX sem pegar filas

Bom evento e aproveite a festa!`;

export default function DisparosPage() {
  const { currentTenant, currentEvent } = useTenant();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [cards, setCards] = useState<CardType[] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'ontem' | 'hoje' | 'todos'>('ontem');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendentes' | 'enviados'>('todos');
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE_TEMPLATE);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const [sendingMap, setSendingMap] = useState<Record<string, boolean>>({});
  const [failedMap, setFailedMap] = useState<Record<string, string>>({});

  // Estados do Disparo em Massa Automático (a cada 5s)
  const [bulkStartNumber, setBulkStartNumber] = useState<number>(33);
  const [isBulkRunning, setIsBulkRunning] = useState<boolean>(false);
  const [bulkStatusText, setBulkStatusText] = useState<string>('');
  const [bulkSentCount, setBulkSentCount] = useState<number>(0);
  const [bulkFailCount, setBulkFailCount] = useState<number>(0);
  const bulkStopRef = useRef<boolean>(false);

  // Carrega marcações de enviados do localStorage
  useEffect(() => {
    const storageKey = `fp_disparos_enviados_${currentEvent?.id || 'default'}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setSentMap(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Erro ao carregar enviados do localStorage', e);
    }
  }, [currentEvent?.id]);

  // Salva marcações de enviados (localStorage + Firestore em tempo real)
  const markAsSent = (cardId: string, value = true) => {
    const storageKey = `fp_disparos_enviados_${currentEvent?.id || 'default'}`;
    setSentMap((prev) => {
      const next = { ...prev, [cardId]: value };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Erro ao salvar enviados no localStorage', e);
      }
      return next;
    });
    if (firestore) {
      updateDoc(doc(firestore, 'cards', cardId), {
        disparo_enviado: value,
      }).catch(() => {});
    }
  };

  const resetAllSent = () => {
    if (!window.confirm('Deseja realmente limpar as marcações de enviado desta lista?')) return;
    const storageKey = `fp_disparos_enviados_${currentEvent?.id || 'default'}`;
    localStorage.removeItem(storageKey);
    setSentMap({});
    toast({ title: 'Marcações resetadas com sucesso!' });
  };

  // Carrega os cartões em tempo real do Firestore
  useEffect(() => {
    if (!firestore) return;
    const collRef = collection(firestore, 'cards');
    const unsubscribe = onSnapshot(collRef, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as CardType));
      setCards(list);
    });
    return () => unsubscribe();
  }, [firestore]);

  // Filtra por tenant e evento atual
  const scopedCards = useMemo(() => {
    if (!cards) return [];
    return cards.filter((card) => {
      if (currentTenant && card.tenant_id && card.tenant_id !== currentTenant.id) return false;
      if (currentEvent && card.event_id && card.event_id !== currentEvent.id) return false;
      return true;
    });
  }, [cards, currentTenant, currentEvent]);

  // Identifica data de criação e agrupa
  const cardsWithDate = useMemo(() => {
    return scopedCards.map((c) => {
      let createdDate: Date | null = null;
      if (c.created_at && (c.created_at as any).toDate) {
        createdDate = (c.created_at as any).toDate();
      } else if (c.created_at && (c.created_at as any).seconds) {
        createdDate = new Date((c.created_at as any).seconds * 1000);
      }
      const dateStrBr = createdDate
        ? createdDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        : '';
      const timeStrBr = createdDate
        ? createdDate.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
          })
        : '';

      return {
        ...c,
        createdDateObj: createdDate,
        dateStrBr,
        timeStrBr,
      };
    });
  }, [scopedCards]);

  // Filtro de data: Ontem (13/11/2026), Hoje (14/11/2026) ou Todos
  const filteredList = useMemo(() => {
    return cardsWithDate.filter((c) => {
      // Filtro de data
      if (dateFilter === 'ontem') {
        // Aceita '13/11/2026' ou '12/11/2026' para abranger todos os cartões de ontem
        const isYesterday = c.dateStrBr === '13/11/2026' || c.dateStrBr === '12/11/2026';
        if (!isYesterday) return false;
      } else if (dateFilter === 'hoje') {
        const isToday = c.dateStrBr === '14/11/2026';
        if (!isToday) return false;
      }

      // Filtro de status de envio
      const isSent = !!sentMap[c.id] || !!(c as any).disparo_enviado;
      if (statusFilter === 'pendentes' && isSent) return false;
      if (statusFilter === 'enviados' && !isSent) return false;

      // Filtro de texto (nome ou telefone)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const nomeMatch = (c.nome_cliente || '').toLowerCase().includes(q);
        const telMatch = (c.telefone_cliente || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''));
        const qrMatch = (c.qr_code_id || '').toLowerCase().includes(q);
        if (!nomeMatch && !telMatch && !qrMatch) return false;
      }

      return true;
    });
  }, [cardsWithDate, dateFilter, statusFilter, searchTerm, sentMap]);

  // Métricas do filtro de data ativo
  const currentCategoryCards = useMemo(() => {
    return cardsWithDate.filter((c) => {
      if (dateFilter === 'ontem') return c.dateStrBr === '13/11/2026' || c.dateStrBr === '12/11/2026';
      if (dateFilter === 'hoje') return c.dateStrBr === '14/11/2026';
      return true;
    });
  }, [cardsWithDate, dateFilter]);

  const totalInCategory = currentCategoryCards.length;
  const sentCount = currentCategoryCards.filter((c) => !!sentMap[c.id] || !!(c as any).disparo_enviado).length;
  const pendingCount = totalInCategory - sentCount;
  const progressPercent = totalInCategory > 0 ? Math.round((sentCount / totalInCategory) * 100) : 0;

  // Monta o texto personalizado para um cartão
  const buildCardMessageText = (card: CardType) => {
    const cardUrl = `https://festanovoamanhecer.com.br/c/${encodeURIComponent(card.qr_code_id)}`;
    return messageTemplate
      .replace(/{nome}/g, card.nome_cliente || 'Cliente')
      .replace(/{link}/g, cardUrl)
      .replace(/{saldo}/g, formatCurrency(card.saldo_centavos));
  };

  // Gerador de link wa.me
  const generateWaLink = (card: CardType) => {
    const rawPhone = card.telefone_cliente || '';
    const cleanDigits = rawPhone.replace(/\D/g, '');
    let finalPhone = cleanDigits;
    if (cleanDigits.length === 10 || cleanDigits.length === 11) {
      finalPhone = `55${cleanDigits}`;
    } else if (cleanDigits.length === 12 || cleanDigits.length === 13) {
      finalPhone = cleanDigits;
    }

    const text = buildCardMessageText(card);

    return `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;
  };

  const copyLink = (card: CardType) => {
    const cardUrl = `https://festanovoamanhecer.com.br/c/${encodeURIComponent(card.qr_code_id)}`;
    navigator.clipboard.writeText(cardUrl);
    toast({
      title: 'Link copiado!',
      description: `Link do cartão de ${card.nome_cliente || 'cliente'} copiado para a área de transferência.`,
    });
  };

  const handleOpenWhatsapp = (card: CardType) => {
    const url = generateWaLink(card);
    markAsSent(card.id, true);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSendViaApi = async (card: CardType, silentToast = false): Promise<boolean> => {
    if (!card.telefone_cliente) return false;
    if (sendingMap[card.id]) return false;

    setSendingMap((prev) => ({ ...prev, [card.id]: true }));
    try {
      const text = buildCardMessageText(card);
      const res = await fetch('/api/whatsapp/send-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: card.telefone_cliente,
          text,
          tenantId: card.tenant_id || currentTenant?.id || 'igreja-batista-da-manha',
          eventId: card.event_id || currentEvent?.id || 'DoKmbiQ8pd3M71yTC9iA',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        const errMsg = data.error || 'Não foi possível enviar a mensagem para este número.';
        setFailedMap((prev) => ({ ...prev, [card.id]: errMsg }));
        if (!silentToast) {
          toast({
            variant: 'destructive',
            title: 'Erro ao enviar via API',
            description: errMsg,
          });
        }
        return false;
      }

      setFailedMap((prev) => {
        const copy = { ...prev };
        delete copy[card.id];
        return copy;
      });
      markAsSent(card.id, true);
      if (!silentToast) {
        toast({
          title: 'Enviado via API WhatsApp! ✅',
          description: `Mensagem entregue para ${card.nome_cliente || card.telefone_cliente} (Instância: ${data.instanceUsed}).`,
        });
      }
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Falha ao comunicar com o servidor.';
      setFailedMap((prev) => ({ ...prev, [card.id]: errMsg }));
      if (!silentToast) {
        toast({
          variant: 'destructive',
          title: 'Erro de conexão',
          description: errMsg,
        });
      }
      return false;
    } finally {
      setSendingMap((prev) => ({ ...prev, [card.id]: false }));
    }
  };

  // Disparo em Massa Automático (1 envio a cada 5 segundos de intervalo)
  const startBulkDispatch = async () => {
    if (isBulkRunning) return;

    const startIdx = Math.max(0, (Number(bulkStartNumber) || 1) - 1);
    const queue = filteredList.slice(startIdx).filter((c) => {
      const isAlreadySent = !!sentMap[c.id] || !!(c as any).disparo_enviado;
      const hasValidPhone = !!c.telefone_cliente && c.telefone_cliente.replace(/\D/g, '').length >= 10;
      return !isAlreadySent && hasValidPhone;
    });

    if (queue.length === 0) {
      toast({
        title: 'Nenhum cliente pendente neste intervalo',
        description: `Todos os clientes com telefone a partir do #${startIdx + 1} já foram marcados como enviados.`,
      });
      return;
    }

    setIsBulkRunning(true);
    bulkStopRef.current = false;
    setBulkSentCount(0);
    setBulkFailCount(0);

    for (let i = 0; i < queue.length; i++) {
      if (bulkStopRef.current) break;

      const card = queue[i];
      const originalNumber = filteredList.findIndex((item) => item.id === card.id) + 1;

      setBulkStatusText(
        `✍️ Enviando (${i + 1}/${queue.length}): #${originalNumber} ${card.nome_cliente || card.telefone_cliente}...`
      );

      // Rola suavemente até o card em disparo
      const rowEl = document.getElementById(`disparo-card-${card.id}`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      const ok = await handleSendViaApi(card, true);
      if (ok) {
        setBulkSentCount((prev) => prev + 1);
      } else {
        setBulkFailCount((prev) => prev + 1);
      }

      // Se ainda houver próximo na fila e não tiver sido pausado, aguarda 5 segundos (com contagem regressiva)
      if (i < queue.length - 1 && !bulkStopRef.current) {
        for (let sec = 5; sec >= 1; sec--) {
          if (bulkStopRef.current) break;
          setBulkStatusText(
            `⏳ Aguardando ${sec}s para o próximo envio (${i + 1}/${queue.length} concluídos)...`
          );
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    const wasStopped = bulkStopRef.current;
    setIsBulkRunning(false);
    setBulkStatusText(
      wasStopped
        ? '⏹️ Disparo em massa pausado pelo usuário.'
        : '🎉 Disparo em massa finalizado com sucesso!'
    );
    toast({
      title: wasStopped ? 'Disparo Pausado' : 'Disparo em Massa Concluído! 🎉',
      description: wasStopped
        ? 'Você pode retomar quando quiser clicando novamente no botão.'
        : 'Todos os clientes pendentes da fila foram processados.',
    });
  };

  const stopBulkDispatch = () => {
    bulkStopRef.current = true;
    setBulkStatusText('Parando após concluir o envio atual...');
  };

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2.5">
            <MessageCircle className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            Envio Manual via WhatsApp (wa.me)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Abra uma conversa direta no WhatsApp de cada cliente com a mensagem e o link personalizado prontos para envio.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTemplateEditor(!showTemplateEditor)}
          className="gap-1.5 self-start sm:self-auto font-medium"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <span>Editar Mensagem Padrão</span>
          {showTemplateEditor ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Editor do Template de Mensagem (Colapsável) */}
      {showTemplateEditor && (
        <Card className="border-primary/30 bg-primary/5 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span>Modelo de Mensagem</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMessageTemplate(DEFAULT_MESSAGE_TEMPLATE)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <RotateCcw className="h-3 w-3" /> Restaurar Padrão
              </Button>
            </CardTitle>
            <CardDescription className="text-xs">
              Variáveis dinâmicas aceitas: <code className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">{'{nome}'}</code>,{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">{'{link}'}</code>,{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">{'{saldo}'}</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <Textarea
              rows={7}
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="font-mono text-xs bg-background"
            />
          </CardContent>
        </Card>
      )}

      {/* Painel de Progresso e Métricas */}
      <Card className="shadow-xs border-border/80">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Seletor de Data */}
            <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl">
              <Button
                size="sm"
                variant={dateFilter === 'ontem' ? 'default' : 'ghost'}
                onClick={() => setDateFilter('ontem')}
                className="h-8 text-xs font-semibold rounded-lg"
              >
                Ontem (13/11)
              </Button>
              <Button
                size="sm"
                variant={dateFilter === 'hoje' ? 'default' : 'ghost'}
                onClick={() => setDateFilter('hoje')}
                className="h-8 text-xs font-semibold rounded-lg"
              >
                Hoje (14/11)
              </Button>
              <Button
                size="sm"
                variant={dateFilter === 'todos' ? 'default' : 'ghost'}
                onClick={() => setDateFilter('todos')}
                className="h-8 text-xs font-semibold rounded-lg"
              >
                Todos do Evento
              </Button>
            </div>

            {/* Contador de Progresso */}
            <div className="flex items-center gap-4 text-xs sm:text-sm">
              <div>
                <span className="text-muted-foreground">Progresso: </span>
                <span className="font-bold text-foreground">
                  {sentCount} de {totalInCategory} enviados ({progressPercent}%)
                </span>
              </div>
              {sentCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetAllSent}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                >
                  Resetar marcações
                </Button>
              )}
            </div>
          </div>

          <Progress value={progressPercent} className="h-2.5 rounded-full" />

          {/* Painel de Disparo em Massa Automático (a cada 5 segundos) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border-2 border-purple-300 dark:border-purple-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-black text-purple-950 dark:text-purple-200 flex items-center gap-2">
                <Send className="h-4 w-4 text-purple-700 dark:text-purple-400" />
                <span>Disparo em Massa via API (Intervalo de 5s + 3s Digitando)</span>
              </p>
              <p className="text-xs text-purple-800 dark:text-purple-300 font-medium">
                {bulkStatusText ||
                  'Envia automaticamente de 1 em 1 apenas para os clientes pendentes a partir do número escolhido.'}
              </p>
              {(bulkSentCount > 0 || bulkFailCount > 0) && (
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  Neste lote: {bulkSentCount} enviados com sucesso
                  {bulkFailCount > 0 ? ` • ${bulkFailCount} falhas/sem WhatsApp` : ''}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-white dark:bg-background px-2.5 py-1 rounded-xl border border-purple-300">
                <label htmlFor="bulk-start-num" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Começar do #:
                </label>
                <input
                  id="bulk-start-num"
                  type="number"
                  min={1}
                  max={Math.max(1, filteredList.length)}
                  disabled={isBulkRunning}
                  value={bulkStartNumber}
                  onChange={(e) => setBulkStartNumber(Math.max(1, Number(e.target.value) || 1))}
                  className="w-14 h-7 text-center font-black text-sm bg-transparent focus:outline-none"
                />
              </div>

              {!isBulkRunning ? (
                <Button
                  type="button"
                  onClick={startBulkDispatch}
                  className="h-10 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs sm:text-sm gap-2 shadow-sm cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Disparar em Massa (a cada 5s)</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={stopBulkDispatch}
                  className="h-10 px-4 rounded-xl font-black text-xs sm:text-sm gap-2 shadow-sm cursor-pointer"
                >
                  <Square className="h-4 w-4 fill-current" />
                  <span>Pausar Disparo</span>
                </Button>
              )}
            </div>
          </div>

          {/* Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou código QR..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs sm:text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" /> Exibir:
              </span>
              <div className="flex gap-1 bg-muted/60 p-1 rounded-lg">
                <Button
                  size="sm"
                  variant={statusFilter === 'todos' ? 'secondary' : 'ghost'}
                  onClick={() => setStatusFilter('todos')}
                  className="h-7 text-xs px-2.5"
                >
                  Todos ({totalInCategory})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'pendentes' ? 'secondary' : 'ghost'}
                  onClick={() => setStatusFilter('pendentes')}
                  className="h-7 text-xs px-2.5 text-amber-700 dark:text-amber-400"
                >
                  Pendentes ({pendingCount})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'enviados' ? 'secondary' : 'ghost'}
                  onClick={() => setStatusFilter('enviados')}
                  className="h-7 text-xs px-2.5 text-emerald-700 dark:text-emerald-400"
                >
                  Enviados ({sentCount})
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Clientes */}
      <div className="space-y-2.5">
        {cards === null ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))
        ) : filteredList.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground bg-muted/20 border border-dashed rounded-2xl">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="font-semibold text-sm">Nenhum cliente encontrado com os filtros aplicados.</p>
            <p className="text-xs text-muted-foreground mt-1">Tente mudar o período de data ou o termo de busca.</p>
          </div>
        ) : (
          filteredList.map((card, idx) => {
            const isSent = !!sentMap[card.id] || !!(card as any).disparo_enviado;
            const hasPhone = !!card.telefone_cliente && card.telefone_cliente.replace(/\D/g, '').length >= 10;
            const cardUrl = `https://festanovoamanhecer.com.br/c/${encodeURIComponent(card.qr_code_id)}`;

            return (
              <Card
                key={card.id}
                id={`disparo-card-${card.id}`}
                className={cn(
                  'transition-all duration-150 border-border/80 shadow-2xs hover:shadow-xs',
                  sendingMap[card.id]
                    ? 'ring-2 ring-purple-600 bg-purple-50/40 dark:bg-purple-950/20'
                    : isSent
                    ? 'bg-emerald-50/30 dark:bg-emerald-950/15 border-emerald-300 dark:border-emerald-800/60'
                    : 'bg-card'
                )}
              >
                <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Informações do Cliente */}
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-muted-foreground/60 w-7">
                        #{idx + 1}
                      </span>
                      <p className="font-bold text-sm sm:text-base text-foreground truncate">
                        {card.nome_cliente || 'Sem Nome Cadastrado'}
                      </p>
                      {isSent ? (
                        <Badge className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 text-[10px] h-5 px-1.5 gap-1 font-semibold">
                          <CheckCircle2 className="h-3 w-3" /> Enviado
                        </Badge>
                      ) : failedMap[card.id] ? (
                        <Badge variant="destructive" className="text-[10px] h-5 px-1.5 font-semibold">
                          Falha: {failedMap[card.id].slice(0, 35)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-300 text-[10px] h-5 px-1.5 font-medium">
                          Pendente
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap font-medium">
                      <span className="flex items-center gap-1 font-mono">
                        <Smartphone className="h-3.5 w-3.5 text-muted-foreground/70" />
                        {card.telefone_cliente || 'Sem telefone'}
                      </span>
                      <span>•</span>
                      <span>
                        Saldo: <strong className="text-foreground">{formatCurrency(card.saldo_centavos)}</strong>
                      </span>
                      {card.timeStrBr && (
                        <>
                          <span>•</span>
                          <span>Criado às {card.timeStrBr}</span>
                        </>
                      )}
                    </div>

                    <p className="text-[11px] text-muted-foreground/80 font-mono truncate max-w-md pt-0.5">
                      Link: {cardUrl}
                    </p>
                  </div>

                  {/* Ações Rápidas */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(card)}
                      title="Copiar Link do Cartão"
                      className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsSent(card.id, !isSent)}
                      title={isSent ? 'Marcar como não enviado' : 'Marcar como enviado'}
                      className={cn(
                        'h-9 px-2.5 text-xs font-semibold',
                        isSent ? 'text-muted-foreground hover:text-destructive' : 'text-muted-foreground hover:text-emerald-600'
                      )}
                    >
                      {isSent ? 'Desmarcar' : 'Check'}
                    </Button>

                    {/* Botão 1: Envio via API (1 a 1 com 3s de simulação de escrita) */}
                    <Button
                      size="sm"
                      disabled={!hasPhone || !!sendingMap[card.id]}
                      onClick={() => handleSendViaApi(card)}
                      className={cn(
                        'h-9 px-3.5 text-xs font-bold gap-1.5 rounded-xl shadow-xs transition-colors cursor-pointer',
                        sendingMap[card.id]
                          ? 'bg-amber-600 text-white'
                          : isSent
                          ? 'bg-purple-700 hover:bg-purple-800 text-white'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      )}
                    >
                      {sendingMap[card.id] ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>✍️ Digitando (3s)...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>{isSent ? 'Reenviar API' : 'Enviar via API'}</span>
                        </>
                      )}
                    </Button>

                    {/* Botão 2: Envio Manual wa.me */}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!hasPhone}
                      onClick={() => handleOpenWhatsapp(card)}
                      className={cn(
                        'h-9 px-3 text-xs font-bold gap-1.5 rounded-xl border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 cursor-pointer'
                      )}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>wa.me</span>
                      <ExternalLink className="h-3 w-3 opacity-70" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
