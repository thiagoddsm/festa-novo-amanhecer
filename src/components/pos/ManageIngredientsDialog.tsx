'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import {
  Loader2,
  Plus,
  Trash2,
  PackagePlus,
  AlertTriangle,
  Check,
  X,
  Pencil,
  Info,
  ChevronDown,
  ChevronUp,
  History,
  ClipboardList,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  Utensils,
  User,
  Clock,
} from 'lucide-react';
import type { Pdv, PdvIngredient, IngredientLogEntry } from '@/lib/definitions';
import {
  addIngredient,
  updateIngredient,
  updateIngredientStock,
  deleteIngredient,
} from '@/lib/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ManageIngredientsDialogProps {
  pdv: Pdv;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'insumos' | 'logs';
}

const COMMON_UNITS = [
  { label: 'Unidade (un)', val: 'un' },
  { label: 'Fatias', val: 'fatias' },
  { label: 'Gramas (g)', val: 'g' },
  { label: 'Quilos (kg)', val: 'kg' },
  { label: 'Mililitros (ml)', val: 'ml' },
  { label: 'Porção', val: 'porção' },
];

function formatLogTimestamp(ts: any): string {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function ManageIngredientsDialog({
  pdv,
  open,
  onOpenChange,
  initialTab = 'insumos',
}: ManageIngredientsDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'insumos' | 'logs'>(initialTab);

  // Sync initial tab when reopened
  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  // Ingredients state
  const [ingredients, setIngredients] = useState<PdvIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Audit Logs state
  const [logs, setLogs] = useState<IngredientLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logSearch, setLogSearch] = useState('');
  const [logFilter, setLogFilter] = useState<'ALL' | 'SAIDA_VENDA' | 'ENTRADA_MANUAL' | 'AJUSTE' | 'ESTORNO'>('ALL');

  // Collapsible guidance box
  const [showHelp, setShowHelp] = useState(false);

  // New ingredient form state
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState<number | ''>(100);
  const [unidade, setUnidade] = useState('un');
  const [estoqueMinimo, setEstoqueMinimo] = useState<number | ''>(10);
  const [isAdding, setIsAdding] = useState(false);

  // Full edit state for an ingredient
  const [editingIngId, setEditingIngId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editUnidade, setEditUnidade] = useState('un');
  const [editQuantidade, setEditQuantidade] = useState<number | ''>('');
  const [editMinimo, setEditMinimo] = useState<number | ''>('');

  // Real-time subscription to Ingredients
  useEffect(() => {
    if (!firestore || !open || !pdv.id) return;

    setLoading(true);
    const colRef = collection(firestore, 'pdvs', pdv.id, 'ingredients');
    const q = query(colRef, orderBy('nome', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as PdvIngredient[];
        setIngredients(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading ingredients:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, open, pdv.id]);

  // Real-time subscription to Audit Logs
  useEffect(() => {
    if (!firestore || !open || !pdv.id) return;

    setLogsLoading(true);
    const logsColRef = collection(firestore, 'pdvs', pdv.id, 'ingredient_logs');
    const q = query(logsColRef, orderBy('created_at', 'desc'), limit(150));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as IngredientLogEntry[];
        setLogs(list);
        setLogsLoading(false);
      },
      (err) => {
        console.error('Error loading ingredient logs:', err);
        setLogsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, open, pdv.id]);

  // Filtered audit logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter by type
      if (logFilter === 'SAIDA_VENDA' && log.tipo !== 'SAIDA_VENDA') return false;
      if (logFilter === 'ENTRADA_MANUAL' && log.tipo !== 'ENTRADA_MANUAL') return false;
      if (logFilter === 'ESTORNO' && log.tipo !== 'ESTORNO') return false;
      if (logFilter === 'AJUSTE' && log.tipo !== 'AJUSTE_MANUAL' && log.tipo !== 'EDICAO') return false;

      // Filter by search query
      if (logSearch.trim()) {
        const q = logSearch.toLowerCase().trim();
        const inTitle = log.titulo?.toLowerCase().includes(q);
        const inOrder = log.pedido_numero?.toLowerCase().includes(q);
        const inClient = log.cliente_nome?.toLowerCase().includes(q);
        const inUser = log.usuario?.toLowerCase().includes(q);
        const inDesc = log.descricao?.toLowerCase().includes(q);
        const inItems = log.itens_vendidos?.some(
          (it) => it.nome.toLowerCase().includes(q) || it.observacoes?.toLowerCase().includes(q)
        );
        const inIngredients = log.insumos_alterados?.some((ins) =>
          ins.ingredient_nome.toLowerCase().includes(q)
        );
        return inTitle || inOrder || inClient || inUser || inDesc || inItems || inIngredients;
      }

      return true;
    });
  }, [logs, logFilter, logSearch]);

  const handleStartEdit = (ing: PdvIngredient) => {
    setEditingIngId(ing.id);
    setEditNome(ing.nome);
    setEditUnidade(ing.unidade || 'un');
    setEditQuantidade(ing.quantidade_atual ?? 0);
    setEditMinimo(typeof ing.estoque_minimo === 'number' ? ing.estoque_minimo : '');
  };

  const handleCancelEdit = () => {
    setEditingIngId(null);
  };

  const handleSaveFullEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIngId || !editNome.trim() || editQuantidade === '') return;

    const fd = new FormData();
    fd.append('pdvId', pdv.id);
    fd.append('ingredientId', editingIngId);
    fd.append('nome', editNome.trim());
    fd.append('unidade', editUnidade.trim() || 'un');
    fd.append('quantidade_atual', String(editQuantidade));
    if (editMinimo !== '') {
      fd.append('estoque_minimo', String(editMinimo));
    }

    startTransition(async () => {
      const res = await updateIngredient(undefined, fd);
      if (res?.status === 'success') {
        toast({ title: 'Sucesso!', description: res.message });
        setEditingIngId(null);
      } else {
        toast({ variant: 'destructive', title: 'Erro!', description: res?.message || 'Erro ao salvar.' });
      }
    });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || quantidade === '') {
      toast({ variant: 'destructive', title: 'Atenção', description: 'Preencha o nome e a quantidade do insumo.' });
      return;
    }

    setIsAdding(true);
    const fd = new FormData();
    fd.append('pdvId', pdv.id);
    fd.append('nome', nome.trim());
    fd.append('quantidade_atual', String(quantidade));
    fd.append('unidade', unidade.trim() || 'un');
    if (estoqueMinimo !== '') {
      fd.append('estoque_minimo', String(estoqueMinimo));
    }

    startTransition(async () => {
      const res = await addIngredient(undefined, fd);
      setIsAdding(false);
      if (res?.status === 'success') {
        toast({ title: 'Insumo Cadastrado!', description: res.message });
        setNome('');
        setQuantidade(100);
        setEstoqueMinimo(10);
      } else {
        toast({ variant: 'destructive', title: 'Erro!', description: res?.message || 'Falha ao cadastrar insumo.' });
      }
    });
  };

  const handleQuickAdd = (ingredientId: string, currentQty: number, addDelta: number) => {
    startTransition(async () => {
      const res = await updateIngredientStock(pdv.id, ingredientId, currentQty + addDelta);
      if (res?.status === 'success') {
        toast({ title: 'Estoque Atualizado', description: `+${addDelta} adicionado com sucesso.` });
      } else {
        toast({ variant: 'destructive', title: 'Erro ao atualizar', description: res?.message });
      }
    });
  };

  const handleDelete = (ingredientId: string) => {
    startTransition(async () => {
      const res = await deleteIngredient(pdv.id, ingredientId);
      if (res?.status === 'success') {
        toast({ title: 'Insumo Excluído', description: res.message });
      } else {
        toast({ variant: 'destructive', title: 'Erro ao excluir', description: res?.message });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[94vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-2 border-b shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
                <PackagePlus className="h-5 w-5 text-primary shrink-0" />
                Controle de Insumos & Estoque — {pdv.nome}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Gerencie insumos brutos, reposição de estoque e histórico de auditoria com baixa por pedido.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-center">
              {/* Discrete Audit Log Button */}
              <Button
                type="button"
                variant={activeTab === 'logs' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setActiveTab(activeTab === 'logs' ? 'insumos' : 'logs')}
                className="h-8 text-xs gap-1.5 border-dashed"
                title="Abrir histórico de auditoria de insumos"
              >
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Log de Auditoria</span>
                {logs.length > 0 && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono font-bold">
                    {logs.length}
                  </Badge>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowHelp(!showHelp)}
                className="text-xs text-primary gap-1 h-8 shrink-0"
              >
                <Info className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Como funciona?</span>
                {showHelp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* Collapsible Guidance Box */}
          {showHelp && (
            <div className="rounded-lg border border-purple-200 bg-purple-50/80 p-3 text-xs text-purple-950 mt-2 space-y-1 animate-in fade-in">
              <p className="font-semibold text-purple-900">Como funciona o consumo por produto (Ficha Técnica / Receita)?</p>
              <p className="text-purple-800 leading-relaxed">
                <strong>1. Aqui nos Insumos:</strong> cadastre o estoque bruto da barraca (ex: <em>Pão (un)</em>, <em>Carne (un)</em>, <em>Queijo (fatias)</em>, <em>Bacon (g)</em>).
              </p>
              <p className="text-purple-800 leading-relaxed">
                <strong>2. No Cardápio (Editar Produto):</strong> ative <em>Controle de Estoque por Receita</em> e vincule quantos insumos cada lanche gasta (ex: <em>1 Pão + 2 Carnes + 2 Fatias de Queijo</em>). O sistema calcula sozinho o limite de vendas e dá baixa automática em cada pedido!
              </p>
              <p className="text-purple-800 leading-relaxed">
                <strong>3. Log de Auditoria:</strong> acompanhe em tempo real cada saída de venda discriminada por lanche (incluindo personalizações como &quot;SEM: [Cebola]&quot;) e entradas manuais.
              </p>
            </div>
          )}
        </DialogHeader>

        {/* Tabs Control */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'insumos' | 'logs')}
          className="flex-1 flex flex-col min-h-0 overflow-hidden pt-2"
        >
          <div className="flex items-center justify-between pb-2 shrink-0">
            <TabsList className="grid grid-cols-2 w-full sm:w-[380px]">
              <TabsTrigger value="insumos" className="text-xs font-semibold gap-1.5">
                <PackagePlus className="h-3.5 w-3.5" />
                Insumos & Estoque ({ingredients.length})
              </TabsTrigger>
              <TabsTrigger value="logs" className="text-xs font-semibold gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" />
                Auditoria & Saídas
                {logs.length > 0 && (
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded-full font-mono font-bold">
                    {logs.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <span className="text-xs text-muted-foreground hidden md:inline">
              {activeTab === 'insumos'
                ? 'Atualização instantânea em tempo real'
                : 'Auditoria contínua de movimentações'}
            </span>
          </div>

          {/* TAB 1: INSUMOS & ESTOQUE */}
          <TabsContent value="insumos" className="flex-1 flex flex-col min-h-0 overflow-hidden gap-3 m-0 data-[state=inactive]:hidden">
            <div className="flex items-center justify-between pt-1 shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                Insumos Cadastrados ({ingredients.length})
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Reposição rápida: clique em <span className="font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">+10</span> ou <span className="font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">+50</span>
              </span>
            </div>

            {/* Scrollable Ingredients List */}
            <ScrollArea className="flex-1 min-h-[220px] max-h-[42vh] rounded-lg border p-3 bg-muted/10">
              {loading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                </div>
              ) : ingredients.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground space-y-2">
                  <PackagePlus className="h-10 w-10 mx-auto opacity-40 text-primary" />
                  <p className="text-sm font-medium">Nenhum insumo cadastrado neste PDV ainda.</p>
                  <p className="text-xs text-muted-foreground">
                    Utilize o formulário abaixo para cadastrar os insumos desta barraca (ex: Pão, Carne, Queijo, Molho).
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {ingredients.map((ing) => {
                    const isEditing = editingIngId === ing.id;
                    const isZero = (ing.quantidade_atual || 0) <= 0;
                    const isLow =
                      !isZero &&
                      typeof ing.estoque_minimo === 'number' &&
                      ing.quantidade_atual <= ing.estoque_minimo;

                    return (
                      <div
                        key={ing.id}
                        className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-all shadow-xs"
                      >
                        {isEditing ? (
                          /* Full Edit Form Inline */
                          <form onSubmit={handleSaveFullEdit} className="space-y-3">
                            <div className="flex items-center justify-between pb-1 border-b">
                              <span className="text-xs font-bold text-primary flex items-center gap-1">
                                <Pencil className="h-3.5 w-3.5" /> Editando Insumo: {ing.nome}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                Altere nome, unidade ou estoque
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
                              <div className="sm:col-span-4 space-y-1">
                                <Label className="text-xs">Nome do Insumo</Label>
                                <Input
                                  value={editNome}
                                  onChange={(e) => setEditNome(e.target.value)}
                                  placeholder="Ex: Pão de Brioche"
                                  className="h-8 text-xs font-medium"
                                  autoFocus
                                  required
                                />
                              </div>

                              <div className="sm:col-span-3 space-y-1">
                                <Label className="text-xs">Unidade de Medida</Label>
                                <Input
                                  value={editUnidade}
                                  onChange={(e) => setEditUnidade(e.target.value)}
                                  placeholder="un, fatias, g, kg"
                                  className="h-8 text-xs"
                                  required
                                />
                              </div>

                              <div className="sm:col-span-3 space-y-1">
                                <Label className="text-xs">Estoque Atual</Label>
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={editQuantidade}
                                    onChange={(e) =>
                                      setEditQuantidade(e.target.value === '' ? '' : Number(e.target.value))
                                    }
                                    className="h-8 text-xs font-mono font-bold"
                                    required
                                  />
                                  <div className="flex gap-1 shrink-0">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-2 text-[11px] font-mono text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                      onClick={() =>
                                        setEditQuantidade((prev) => (Number(prev) || 0) + 10)
                                      }
                                      title="Adicionar +10"
                                    >
                                      +10
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-2 text-[11px] font-mono text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                      onClick={() =>
                                        setEditQuantidade((prev) => (Number(prev) || 0) + 50)
                                      }
                                      title="Adicionar +50"
                                    >
                                      +50
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              <div className="sm:col-span-2 space-y-1">
                                <Label className="text-xs">Alerta (&le;)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={editMinimo}
                                  onChange={(e) =>
                                    setEditMinimo(e.target.value === '' ? '' : Number(e.target.value))
                                  }
                                  placeholder="10"
                                  className="h-8 text-xs font-mono"
                                />
                              </div>
                            </div>

                            {/* Quick Unit Pills for Editing */}
                            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground pt-0.5">
                              <span>Trocar unidade rápido:</span>
                              {COMMON_UNITS.map((p) => (
                                <button
                                  key={p.val}
                                  type="button"
                                  onClick={() => setEditUnidade(p.val)}
                                  className={`px-2 py-0.5 rounded-full border transition-colors ${
                                    editUnidade === p.val
                                      ? 'bg-primary text-primary-foreground border-primary font-medium'
                                      : 'bg-muted/70 hover:bg-muted text-foreground border-border'
                                  }`}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>

                            <div className="flex justify-end gap-2 pt-1 border-t">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1"
                                onClick={handleCancelEdit}
                                disabled={isPending}
                              >
                                <X className="h-3.5 w-3.5" /> Cancelar
                              </Button>
                              <Button
                                type="submit"
                                size="sm"
                                className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                disabled={isPending || !editNome.trim()}
                              >
                                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                Salvar Insumo
                              </Button>
                            </div>
                          </form>
                        ) : (
                          /* Normal Card View */
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-foreground">{ing.nome}</span>
                                {isZero ? (
                                  <Badge variant="destructive" className="text-xs font-bold">
                                    Esgotado (0)
                                  </Badge>
                                ) : isLow ? (
                                  <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Baixo ({ing.quantidade_atual} {ing.unidade})
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-300">
                                    {ing.quantidade_atual} {ing.unidade}
                                  </Badge>
                                )}
                              </div>
                              {ing.estoque_minimo ? (
                                <p className="text-xs text-muted-foreground">
                                  Alerta configurado para &le; {ing.estoque_minimo} {ing.unidade}
                                </p>
                              ) : null}
                            </div>

                            {/* Quick Actions */}
                            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs font-mono font-bold text-emerald-700 hover:bg-emerald-50 border-emerald-300"
                                onClick={() => handleQuickAdd(ing.id, ing.quantidade_atual, 10)}
                                disabled={isPending}
                                title="Adicionar +10 ao estoque"
                              >
                                +10
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs font-mono font-bold text-emerald-700 hover:bg-emerald-50 border-emerald-300"
                                onClick={() => handleQuickAdd(ing.id, ing.quantidade_atual, 50)}
                                disabled={isPending}
                                title="Adicionar +50 ao estoque"
                              >
                                +50
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs gap-1 font-medium"
                                onClick={() => handleStartEdit(ing)}
                                disabled={isPending}
                                title="Editar nome, unidade ou estoque"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Editar</span>
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                    disabled={isPending}
                                    title="Excluir Insumo"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir Insumo &quot;{ing.nome}&quot;?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita. Produtos que usam este insumo na receita deixarão de deduzir este ingrediente.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(ing.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Sim, Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Quick Add Form Section */}
            <form onSubmit={handleAddSubmit} className="rounded-lg border p-3 bg-muted/20 space-y-2.5 shrink-0">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-primary" />
                Cadastrar Novo Insumo
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-5 space-y-1">
                  <Label htmlFor="new-ing-name" className="text-xs font-medium">
                    Nome do Insumo *
                  </Label>
                  <Input
                    id="new-ing-name"
                    placeholder="Ex: Pão de Hamburguer, Carne Smash..."
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="new-ing-unit" className="text-xs font-medium">
                    Unidade *
                  </Label>
                  <Input
                    id="new-ing-unit"
                    placeholder="un, fatias, g"
                    value={unidade}
                    onChange={(e) => setUnidade(e.target.value)}
                    required
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="new-ing-qty" className="text-xs font-medium">
                    Estoque Inicial *
                  </Label>
                  <Input
                    id="new-ing-qty"
                    type="number"
                    min="0"
                    placeholder="100"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value === '' ? '' : Number(e.target.value))}
                    required
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <Label htmlFor="new-ing-min" className="text-xs font-medium">
                    Alerta Baixo (&le;)
                  </Label>
                  <Input
                    id="new-ing-min"
                    type="number"
                    min="0"
                    placeholder="10 (opcional)"
                    value={estoqueMinimo}
                    onChange={(e) => setEstoqueMinimo(e.target.value === '' ? '' : Number(e.target.value))}
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>
              </div>

              {/* Quick unit pills */}
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground pt-0.5">
                <span>Unidades comuns:</span>
                {COMMON_UNITS.map((p) => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => setUnidade(p.val)}
                    className={`px-2 py-0.5 rounded-full border transition-colors ${
                      unidade === p.val
                        ? 'bg-primary text-primary-foreground border-primary font-medium'
                        : 'bg-background hover:bg-muted text-foreground border-border'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <Button
                type="submit"
                disabled={isAdding || isPending || !nome.trim()}
                className="w-full h-8 text-xs font-bold gap-1.5"
              >
                {isAdding || isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Cadastrar Insumo na Barraca
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          {/* TAB 2: LOG DE AUDITORIA */}
          <TabsContent value="logs" className="flex-1 flex flex-col min-h-0 overflow-hidden gap-2.5 m-0 data-[state=inactive]:hidden">
            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por lanche, insumo, pedido (#0000) ou cliente..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="h-8 pl-8 text-xs bg-background"
                />
                {logSearch && (
                  <button
                    type="button"
                    onClick={() => setLogSearch('')}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Buttons */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant={logFilter === 'ALL' ? 'secondary' : 'ghost'}
                  onClick={() => setLogFilter('ALL')}
                  className="h-7 text-xs px-2.5"
                >
                  Todos ({logs.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={logFilter === 'SAIDA_VENDA' ? 'secondary' : 'ghost'}
                  onClick={() => setLogFilter('SAIDA_VENDA')}
                  className="h-7 text-xs px-2.5 text-rose-700 hover:text-rose-800"
                >
                  🍔 Vendas
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={logFilter === 'ENTRADA_MANUAL' ? 'secondary' : 'ghost'}
                  onClick={() => setLogFilter('ENTRADA_MANUAL')}
                  className="h-7 text-xs px-2.5 text-emerald-700 hover:text-emerald-800"
                >
                  ➕ Entradas
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={logFilter === 'AJUSTE' ? 'secondary' : 'ghost'}
                  onClick={() => setLogFilter('AJUSTE')}
                  className="h-7 text-xs px-2.5 text-amber-700 hover:text-amber-800"
                >
                  ✏️ Ajustes
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={logFilter === 'ESTORNO' ? 'secondary' : 'ghost'}
                  onClick={() => setLogFilter('ESTORNO')}
                  className="h-7 text-xs px-2.5 text-purple-700 hover:text-purple-800"
                >
                  ↩️ Estornos
                </Button>
              </div>
            </div>

            {/* Scrollable Audit Log Entries */}
            <ScrollArea className="flex-1 min-h-[300px] max-h-[58vh] rounded-lg border p-3 bg-muted/10">
              {logsLoading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground space-y-2">
                  <History className="h-10 w-10 mx-auto opacity-30 text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    {logSearch || logFilter !== 'ALL'
                      ? 'Nenhum registro coincide com o filtro atual.'
                      : 'Nenhuma movimentação registrada ainda.'}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Conforme novos pedidos forem pagos ou o estoque abastecido, cada baixa com detalhes do lanche e dos insumos consumidos aparecerá aqui automaticamente.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLogs.map((log) => {
                    const isSale = log.tipo === 'SAIDA_VENDA';
                    const isReversal = log.tipo === 'ESTORNO';
                    const isAdd = log.tipo === 'ENTRADA_MANUAL';
                    const isEdit = log.tipo === 'EDICAO' || log.tipo === 'AJUSTE_MANUAL';
                    const isDelete = log.tipo === 'EXCLUSAO';
                    const isCreate = log.tipo === 'CRIACAO';

                    return (
                      <div
                        key={log.id}
                        className={`p-3 rounded-lg border bg-card transition-all shadow-xs space-y-2.5 ${
                          isSale
                            ? 'border-rose-200/80 hover:border-rose-300'
                            : isReversal
                            ? 'border-purple-200/80 hover:border-purple-300'
                            : isAdd
                            ? 'border-emerald-200/80 hover:border-emerald-300'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        {/* Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b pb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Type Badge */}
                            {isSale && (
                              <Badge className="bg-rose-500/10 text-rose-700 border-rose-300 hover:bg-rose-500/20 gap-1 text-[11px] font-bold">
                                <ArrowDownRight className="h-3 w-3" /> Saída Venda
                              </Badge>
                            )}
                            {isReversal && (
                              <Badge className="bg-purple-500/10 text-purple-700 border-purple-300 hover:bg-purple-500/20 gap-1 text-[11px] font-bold">
                                <RotateCcw className="h-3 w-3" /> Estorno / Reembolso
                              </Badge>
                            )}
                            {isAdd && (
                              <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 hover:bg-emerald-500/20 gap-1 text-[11px] font-bold">
                                <ArrowUpRight className="h-3 w-3" /> Entrada Manual
                              </Badge>
                            )}
                            {isEdit && (
                              <Badge className="bg-amber-500/10 text-amber-700 border-amber-300 hover:bg-amber-500/20 gap-1 text-[11px] font-bold">
                                <Pencil className="h-3 w-3" /> Ajuste / Edição
                              </Badge>
                            )}
                            {isCreate && (
                              <Badge className="bg-slate-500/10 text-slate-700 border-slate-300 hover:bg-slate-500/20 gap-1 text-[11px] font-bold">
                                <Plus className="h-3 w-3" /> Novo Insumo
                              </Badge>
                            )}
                            {isDelete && (
                              <Badge className="bg-red-500/10 text-red-700 border-red-300 hover:bg-red-500/20 gap-1 text-[11px] font-bold">
                                <Trash2 className="h-3 w-3" /> Exclusão
                              </Badge>
                            )}

                            {/* Order Number */}
                            {log.pedido_numero && (
                              <Badge variant="outline" className="text-[11px] font-mono font-bold bg-muted/30">
                                Pedido {log.pedido_numero}
                              </Badge>
                            )}

                            {/* Client Name */}
                            {log.cliente_nome && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" /> {log.cliente_nome}
                              </span>
                            )}
                          </div>

                          {/* Timestamp and Operator */}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {log.usuario && (
                              <span className="hidden sm:inline font-medium">Por: {log.usuario}</span>
                            )}
                            <span className="font-mono flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatLogTimestamp(log.created_at)}
                            </span>
                          </div>
                        </div>

                        {/* Title and Description */}
                        <div>
                          <p className="text-xs font-semibold text-foreground">{log.titulo}</p>
                          {log.descricao && (
                            <p className="text-xs text-muted-foreground mt-0.5">{log.descricao}</p>
                          )}
                        </div>

                        {/* Sandwiches / Sold Products Box */}
                        {log.itens_vendidos && log.itens_vendidos.length > 0 && (
                          <div className="rounded-md bg-muted/40 p-2.5 border border-border/50 space-y-1.5">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <Utensils className="h-3 w-3 text-primary" /> Lanche(s) / Item(ns) no Pedido:
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {log.itens_vendidos.map((it, idx) => (
                                <div
                                  key={idx}
                                  className="bg-background px-2.5 py-1.5 rounded border border-border/80 text-xs font-medium shadow-xs"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold text-primary">{it.quantidade}x</span>
                                    <span className="font-semibold text-foreground">{it.nome}</span>
                                  </div>
                                  {it.observacoes && (
                                    <span className="block text-[11px] font-mono text-amber-700 dark:text-amber-400 mt-0.5">
                                      {it.observacoes}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Ingredients Movement Breakdown */}
                        {log.insumos_alterados && log.insumos_alterados.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                              Insumos Movimentados:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                              {log.insumos_alterados.map((ins, iIdx) => {
                                const isNegative = ins.quantidade_alterada < 0;
                                return (
                                  <div
                                    key={iIdx}
                                    className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs border ${
                                      isNegative
                                        ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/80 text-rose-950 dark:text-rose-200'
                                        : 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/80 text-emerald-950 dark:text-emerald-200'
                                    }`}
                                  >
                                    <span className="font-semibold truncate pr-1">
                                      {ins.ingredient_nome}
                                    </span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span
                                        className={`font-mono font-bold ${
                                          isNegative
                                            ? 'text-rose-600 dark:text-rose-400'
                                            : 'text-emerald-600 dark:text-emerald-400'
                                        }`}
                                      >
                                        {ins.quantidade_alterada > 0
                                          ? `+${ins.quantidade_alterada}`
                                          : ins.quantidade_alterada}{' '}
                                        {ins.unidade || 'un'}
                                      </span>
                                      {typeof ins.quantidade_resultante === 'number' && (
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                          (Saldo: {ins.quantidade_resultante})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-2 border-t shrink-0 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            FestaPay &bull; Controle de Insumos e Ficha Técnica
          </span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
