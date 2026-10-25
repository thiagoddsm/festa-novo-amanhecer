'use client';

import { useState, useEffect, useTransition } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
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
} from 'lucide-react';
import type { Pdv, PdvIngredient } from '@/lib/definitions';
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
}

const COMMON_UNITS = [
  { label: 'Unidade (un)', val: 'un' },
  { label: 'Fatias', val: 'fatias' },
  { label: 'Gramas (g)', val: 'g' },
  { label: 'Quilos (kg)', val: 'kg' },
  { label: 'Mililitros (ml)', val: 'ml' },
  { label: 'Porção', val: 'porção' },
];

export default function ManageIngredientsDialog({
  pdv,
  open,
  onOpenChange,
}: ManageIngredientsDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [ingredients, setIngredients] = useState<PdvIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

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
    if (!nome.trim() || quantidade === '') return;

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
        toast({ title: 'Sucesso!', description: res.message });
        setNome('');
        setQuantidade(100);
        setUnidade('un');
        setEstoqueMinimo(10);
      } else {
        toast({ variant: 'destructive', title: 'Erro!', description: res?.message || 'Erro ao adicionar.' });
      }
    });
  };

  const handleQuickAdd = (ing: PdvIngredient, amount: number) => {
    startTransition(async () => {
      const novo = (ing.quantidade_atual || 0) + amount;
      const res = await updateIngredientStock(pdv.id, ing.id, novo);
      if (res?.status === 'success') {
        toast({
          title: 'Estoque Atualizado',
          description: `+${amount} ${ing.unidade} adicionados a ${ing.nome}.`,
        });
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
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
                <PackagePlus className="h-5 w-5 text-primary shrink-0" />
                Controle de Insumos & Estoque — {pdv.nome}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Cadastre e edite ingredientes brutos (nome, unidade e estoque) com reposição rápida durante o evento.
              </DialogDescription>
            </div>
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
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3 py-2 min-h-0">
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              Insumos Cadastrados ({ingredients.length})
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Reposição rápida: clique em <span className="font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">+10</span> ou <span className="font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">+50</span>
            </span>
          </div>

          {/* Expanded ScrollArea with ample height */}
          <ScrollArea className="flex-1 min-h-[300px] max-h-[48vh] rounded-lg border p-3 bg-muted/10">
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
                            <span className="text-[11px] text-muted-foreground">Modifique o nome, unidade ou estoque</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                            <div className="sm:col-span-4 space-y-1">
                              <Label className="text-xs">Nome do Insumo</Label>
                              <Input
                                value={editNome}
                                onChange={(e) => setEditNome(e.target.value)}
                                className="h-8 text-xs font-semibold"
                                required
                                autoFocus
                              />
                            </div>

                            <div className="sm:col-span-3 space-y-1">
                              <Label className="text-xs">Unidade / Tipo</Label>
                              <Input
                                value={editUnidade}
                                onChange={(e) => setEditUnidade(e.target.value)}
                                placeholder="un, fatias, g"
                                className="h-8 text-xs font-mono"
                                required
                              />
                            </div>

                            <div className="sm:col-span-3 space-y-1">
                              <Label className="text-xs">Estoque Atual</Label>
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={editQuantidade}
                                onChange={(e) =>
                                  setEditQuantidade(e.target.value === '' ? '' : Number(e.target.value))
                                }
                                className="h-8 text-xs font-mono font-bold"
                                required
                              />
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
                                Alerta de estoque baixo: &le; {ing.estoque_minimo} {ing.unidade}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs font-semibold gap-1 px-2.5 hover:border-primary hover:text-primary transition-colors"
                              title="Editar nome, unidade ou estoque deste insumo"
                              onClick={() => handleStartEdit(ing)}
                              disabled={isPending}
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>Editar</span>
                            </Button>

                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 px-2.5 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-200"
                                onClick={() => handleQuickAdd(ing, 10)}
                                disabled={isPending}
                                title="Adicionar +10 rapidamente"
                              >
                                +10
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 px-2.5 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-200"
                                onClick={() => handleQuickAdd(ing, 50)}
                                disabled={isPending}
                                title="Adicionar +50 rapidamente"
                              >
                                +50
                              </Button>
                            </div>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  title="Excluir insumo"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Insumo</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Deseja realmente remover o insumo <strong>{ing.nome}</strong>? Itens de cardápio que dependem deste insumo não poderão mais calculá-lo.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(ing.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
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

          {/* Form to add a new ingredient */}
          <form onSubmit={handleAddSubmit} className="border rounded-lg p-3 sm:p-4 bg-muted/20 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Plus className="h-4 w-4 text-primary" />
              Cadastrar Novo Insumo
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-5 space-y-1">
                <Label htmlFor="new-ing-name" className="text-xs font-medium">
                  Nome do Insumo
                </Label>
                <Input
                  id="new-ing-name"
                  placeholder="Ex: Pão, Carne 90g, Queijo Cheddar"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="new-ing-qty" className="text-xs font-medium">
                  Saldo Inicial
                </Label>
                <Input
                  id="new-ing-qty"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="100"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  className="h-8 text-xs font-mono font-bold bg-background"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="new-ing-unit" className="text-xs font-medium">
                  Unidade / Tipo
                </Label>
                <Input
                  id="new-ing-unit"
                  placeholder="un, fatias, g"
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
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
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
