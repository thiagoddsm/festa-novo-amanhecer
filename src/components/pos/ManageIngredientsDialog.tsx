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
import { Loader2, Plus, Trash2, PackagePlus, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import type { Pdv, PdvIngredient } from '@/lib/definitions';
import { addIngredient, updateIngredientStock, deleteIngredient } from '@/lib/actions';
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

  // New ingredient form state
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState<number | ''>(100);
  const [unidade, setUnidade] = useState('un');
  const [estoqueMinimo, setEstoqueMinimo] = useState<number | ''>(10);
  const [isAdding, setIsAdding] = useState(false);

  // Quick edit stock state per ingredient ID
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [quickStockVal, setQuickStockVal] = useState<number | ''>('');

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
        toast({ variant: 'destructive', title: 'Erro!', description: res.message });
      }
    });
  };

  const handleQuickAdd = (ing: PdvIngredient, amount: number) => {
    startTransition(async () => {
      const novo = (ing.quantidade_atual || 0) + amount;
      const res = await updateIngredientStock(pdv.id, ing.id, novo);
      if (res?.status === 'success') {
        toast({ title: 'Estoque Atualizado', description: `+${amount} ${ing.unidade} adicionados a ${ing.nome}.` });
      } else {
        toast({ variant: 'destructive', title: 'Erro ao atualizar', description: res.message });
      }
    });
  };

  const handleSaveStock = (ing: PdvIngredient) => {
    if (quickStockVal === '') {
      setEditingStockId(null);
      return;
    }
    startTransition(async () => {
      const res = await updateIngredientStock(pdv.id, ing.id, Number(quickStockVal));
      setEditingStockId(null);
      if (res?.status === 'success') {
        toast({ title: 'Sucesso!', description: `Estoque de ${ing.nome} atualizado para ${quickStockVal}.` });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: res.message });
      }
    });
  };

  const handleDelete = (ingredientId: string) => {
    startTransition(async () => {
      const res = await deleteIngredient(pdv.id, ingredientId);
      if (res?.status === 'success') {
        toast({ title: 'Insumo Excluído', description: res.message });
      } else {
        toast({ variant: 'destructive', title: 'Erro ao excluir', description: res.message });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <PackagePlus className="h-5 w-5 text-primary" />
            Controle de Insumos & Estoque — {pdv.nome}
          </DialogTitle>
          <DialogDescription>
            Cadastre os ingredientes compartilhados da barraca (pão, hambúrguer, queijo, etc.) e faça reabastecimentos rápidos durante o evento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-sm font-semibold text-muted-foreground">
              Insumos Cadastrados ({ingredients.length})
            </span>
            <span className="text-xs text-muted-foreground">
              Reposição rápida: clique em <span className="font-semibold text-emerald-600">+10</span> ou <span className="font-semibold text-emerald-600">+50</span>
            </span>
          </div>

          <ScrollArea className="h-64 rounded-md border p-3">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : ingredients.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground space-y-2">
                <PackagePlus className="h-8 w-8 mx-auto opacity-40" />
                <p className="text-sm">Nenhum insumo cadastrado neste PDV ainda.</p>
                <p className="text-xs text-muted-foreground">
                  Cadastre abaixo os insumos utilizados nas receitas (ex: Pão, Carne, Queijo).
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {ingredients.map((ing) => {
                  const isZero = (ing.quantidade_atual || 0) <= 0;
                  const isLow =
                    !isZero &&
                    typeof ing.estoque_minimo === 'number' &&
                    ing.quantidade_atual <= ing.estoque_minimo;

                  return (
                    <div
                      key={ing.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{ing.nome}</span>
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
                            <Badge variant="outline" className="text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-300">
                              {ing.quantidade_atual} {ing.unidade}
                            </Badge>
                          )}
                        </div>
                        {ing.estoque_minimo ? (
                          <p className="text-xs text-muted-foreground">
                            Alerta de estoque baixo: ≤ {ing.estoque_minimo} {ing.unidade}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        {editingStockId === ing.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              className="h-8 w-20 text-xs"
                              value={quickStockVal}
                              onChange={(e) => setQuickStockVal(e.target.value === '' ? '' : Number(e.target.value))}
                              autoFocus
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-600"
                              onClick={() => handleSaveStock(ing)}
                              disabled={isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-mono"
                            title="Clique para editar o saldo exato"
                            onClick={() => {
                              setEditingStockId(ing.id);
                              setQuickStockVal(ing.quantidade_atual || 0);
                            }}
                          >
                            Editar ({ing.quantidade_atual})
                          </Button>
                        )}

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 px-2 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200"
                            onClick={() => handleQuickAdd(ing, 10)}
                            disabled={isPending}
                          >
                            +10
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 px-2 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200"
                            onClick={() => handleQuickAdd(ing, 50)}
                            disabled={isPending}
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
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Form to add a new ingredient */}
          <form onSubmit={handleAddSubmit} className="border-t pt-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Novo Insumo / Ingrediente
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5 space-y-1">
                <Label htmlFor="ing-name" className="text-xs">
                  Nome do Insumo
                </Label>
                <Input
                  id="ing-name"
                  placeholder="Ex: Pão de Hambúrguer, Carne 150g"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="ing-qty" className="text-xs">
                  Saldo Inicial
                </Label>
                <Input
                  id="ing-qty"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="100"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="ing-unit" className="text-xs">
                  Unidade
                </Label>
                <Input
                  id="ing-unit"
                  placeholder="un, fatia, g"
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <Label htmlFor="ing-min" className="text-xs">
                  Alerta Baixo (&le;)
                </Label>
                <Input
                  id="ing-min"
                  type="number"
                  min="0"
                  placeholder="10"
                  value={estoqueMinimo}
                  onChange={(e) => setEstoqueMinimo(e.target.value === '' ? '' : Number(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isAdding || isPending || !nome.trim()}
              className="w-full h-9 text-xs font-semibold gap-1.5"
            >
              {isAdding || isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Cadastrar Insumo no PDV
                </>
              )}
            </Button>
          </form>
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
