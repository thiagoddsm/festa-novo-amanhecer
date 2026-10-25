'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  PlusCircle,
  Package,
  Layers,
  Settings2,
  PackagePlus,
  UtensilsCrossed,
  Info,
} from 'lucide-react';
import {
  Pdv,
  MenuItem,
  StockControlType,
  PdvIngredient,
  RecipeItem,
} from '@/lib/definitions';
import { formatCurrency } from '@/lib/utils';
import { addMenuItem, updateMenuItem, deleteMenuItem } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import ManageIngredientsDialog from './ManageIngredientsDialog';
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

interface EditMenuSheetProps {
  pdv: Pdv;
  menuItems?: MenuItem[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onItemsChange?: (items: MenuItem[]) => void;
}

interface EditingItemState {
  id: string;
  nome: string;
  preco_reais: string;
  ingredientes: string;
  stock_control_type: StockControlType;
  estoque_atual: string;
  estoque_minimo: string;
  receita: RecipeItem[];
}

export default function EditMenuSheet({
  pdv,
  menuItems,
  isOpen,
  onOpenChange,
}: EditMenuSheetProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [ingredients, setIngredients] = useState<PdvIngredient[]>([]);
  const [ingredientsDialogOpen, setIngredientsDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Real-time live menu items loaded directly from subcollection
  const [liveMenuItems, setLiveMenuItems] = useState<MenuItem[]>(menuItems || []);

  useEffect(() => {
    if (!firestore || !isOpen || !pdv.id) return;
    const menuColRef = collection(firestore, 'pdvs', pdv.id, 'menuItems');
    const q = query(menuColRef, orderBy('nome', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as MenuItem[];
      setLiveMenuItems(list);
    });
    return () => unsubscribe();
  }, [firestore, isOpen, pdv.id]);

  // Load ingredients for this PDV to build recipes
  useEffect(() => {
    if (!firestore || !isOpen || !pdv.id) return;
    const colRef = collection(firestore, 'pdvs', pdv.id, 'ingredients');
    const q = query(colRef, orderBy('nome', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as PdvIngredient[];
      setIngredients(list);
    });
    return () => unsubscribe();
  }, [firestore, isOpen, pdv.id]);

  // Editing existing item state
  const [editingItem, setEditingItem] = useState<EditingItemState | null>(null);

  // New item form state
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newIngredientes, setNewIngredientes] = useState('');
  const [newStockType, setNewStockType] = useState<StockControlType>('NONE');
  const [newStockAtual, setNewStockAtual] = useState('');
  const [newStockMinimo, setNewStockMinimo] = useState('');
  const [newRecipe, setNewRecipe] = useState<RecipeItem[]>([]);

  // Temporary selected ingredient to add to recipe
  const [selectedIngId, setSelectedIngId] = useState<string>('');
  const [selectedIngQty, setSelectedIngQty] = useState<number>(1);

  const handleEditClick = (item: MenuItem) => {
    setEditingItem({
      id: item.id,
      nome: item.nome,
      preco_reais: (item.preco_centavos / 100).toFixed(2),
      ingredientes: (item.ingredientes || []).join(', '),
      stock_control_type: item.stock_control_type || 'NONE',
      estoque_atual: typeof item.estoque_atual === 'number' ? String(item.estoque_atual) : '',
      estoque_minimo: typeof item.estoque_minimo === 'number' ? String(item.estoque_minimo) : '',
      receita: item.receita || [],
    });
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
  };

  const handleDelete = (itemId: string) => {
    startTransition(async () => {
      const result = await deleteMenuItem(pdv.id, itemId);
      toast({
        title: result?.status === 'success' ? 'Sucesso!' : 'Erro!',
        description: result.message,
        variant: result?.status === 'success' ? 'default' : 'destructive',
      });
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const fd = new FormData();
    fd.append('pdvId', pdv.id);
    fd.append('itemId', editingItem.id);
    fd.append('nome', editingItem.nome);
    fd.append('preco_reais', editingItem.preco_reais);
    fd.append('ingredientes', editingItem.ingredientes);
    fd.append('stock_control_type', editingItem.stock_control_type);

    if (editingItem.stock_control_type === 'PRODUCT') {
      fd.append('estoque_atual', editingItem.estoque_atual || '0');
      if (editingItem.estoque_minimo) {
        fd.append('estoque_minimo', editingItem.estoque_minimo);
      }
    } else if (editingItem.stock_control_type === 'INGREDIENTS') {
      fd.append('receita', JSON.stringify(editingItem.receita));
    }

    startTransition(async () => {
      const res = await updateMenuItem(undefined, fd);
      if (res?.status === 'success') {
        toast({ title: 'Sucesso!', description: res.message });
        setEditingItem(null);
      } else {
        toast({ variant: 'destructive', title: 'Erro!', description: res.message });
      }
    });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPrice) return;

    const fd = new FormData();
    fd.append('pdvId', pdv.id);
    fd.append('nome', newName.trim());
    fd.append('preco_reais', newPrice);
    fd.append('ingredientes', newIngredientes.trim());
    fd.append('stock_control_type', newStockType);

    if (newStockType === 'PRODUCT') {
      fd.append('estoque_atual', newStockAtual || '0');
      if (newStockMinimo) {
        fd.append('estoque_minimo', newStockMinimo);
      }
    } else if (newStockType === 'INGREDIENTS') {
      fd.append('receita', JSON.stringify(newRecipe));
    }

    startTransition(async () => {
      const res = await addMenuItem(undefined, fd);
      if (res?.status === 'success') {
        toast({ title: 'Sucesso!', description: res.message });
        setNewName('');
        setNewPrice('');
        setNewIngredientes('');
        setNewStockType('NONE');
        setNewStockAtual('');
        setNewStockMinimo('');
        setNewRecipe([]);
      } else {
        toast({ variant: 'destructive', title: 'Erro!', description: res.message });
      }
    });
  };

  // Helper to add ingredient to a recipe
  const addIngredientToRecipe = (isEditing: boolean) => {
    if (!selectedIngId) return;
    const ingObj = ingredients.find((i) => i.id === selectedIngId);
    if (!ingObj) return;

    const newItem: RecipeItem = {
      ingredient_id: ingObj.id,
      ingredient_nome: ingObj.nome,
      quantidade: selectedIngQty || 1,
    };

    if (isEditing && editingItem) {
      const existing = editingItem.receita.findIndex((r) => r.ingredient_id === selectedIngId);
      if (existing > -1) {
        const updated = [...editingItem.receita];
        updated[existing].quantidade = selectedIngQty || 1;
        setEditingItem({ ...editingItem, receita: updated });
      } else {
        setEditingItem({ ...editingItem, receita: [...editingItem.receita, newItem] });
      }
    } else {
      const existing = newRecipe.findIndex((r) => r.ingredient_id === selectedIngId);
      if (existing > -1) {
        const updated = [...newRecipe];
        updated[existing].quantidade = selectedIngQty || 1;
        setNewRecipe(updated);
      } else {
        setNewRecipe([...newRecipe, newItem]);
      }
    }

    setSelectedIngId('');
    setSelectedIngQty(1);
  };

  const removeIngredientFromRecipe = (isEditing: boolean, ingredientId: string) => {
    if (isEditing && editingItem) {
      setEditingItem({
        ...editingItem,
        receita: editingItem.receita.filter((r) => r.ingredient_id !== ingredientId),
      });
    } else {
      setNewRecipe(newRecipe.filter((r) => r.ingredient_id !== ingredientId));
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col p-6 overflow-y-auto">
          <SheetHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-xl font-bold flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                  Cardápio & Estoque — {pdv.nome}
                </SheetTitle>
                <SheetDescription>
                  Configure produtos, preços e escolha a modalidade de controle de estoque de cada item.
                </SheetDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-semibold shrink-0"
                onClick={() => setIngredientsDialogOpen(true)}
              >
                <PackagePlus className="h-4 w-4 text-primary" />
                Insumos do PDV ({ingredients.length})
              </Button>
            </div>
          </SheetHeader>

          {/* Current Menu Items List */}
          <div className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Itens Atuais ({liveMenuItems.length})
              </span>
            </div>

            <div className="space-y-3">
              {liveMenuItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors space-y-2"
                >
                  {editingItem?.id === item.id ? (
                    /* Edit Form Inline */
                    <form onSubmit={handleUpdateSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-8">
                          <Label className="text-xs">Nome do Item</Label>
                          <Input
                            value={editingItem.nome}
                            onChange={(e) => setEditingItem({ ...editingItem, nome: e.target.value })}
                            className="h-8 text-xs"
                            required
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <Label className="text-xs">Preço (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editingItem.preco_reais}
                            onChange={(e) => setEditingItem({ ...editingItem, preco_reais: e.target.value })}
                            className="h-8 text-xs font-mono"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Ingredientes / Tags (separados por vírgula)</Label>
                        <Input
                          value={editingItem.ingredientes}
                          onChange={(e) => setEditingItem({ ...editingItem, ingredientes: e.target.value })}
                          placeholder="Ex: Queijo, Bacon, Salada"
                          className="h-8 text-xs"
                        />
                      </div>

                      {/* Stock Control Selector */}
                      <div className="space-y-2 rounded-md border p-3 bg-muted/20">
                        <Label className="text-xs font-bold text-foreground">
                          Controle de Estoque deste Item:
                        </Label>
                        <RadioGroup
                          value={editingItem.stock_control_type}
                          onValueChange={(val) =>
                            setEditingItem({ ...editingItem, stock_control_type: val as StockControlType })
                          }
                          className="grid grid-cols-1 gap-2 pt-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="NONE" id="edit-stock-none" />
                            <label htmlFor="edit-stock-none" className="text-xs font-medium cursor-pointer">
                              ( ) Sem controle de estoque
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="PRODUCT" id="edit-stock-product" />
                            <label htmlFor="edit-stock-product" className="text-xs font-medium cursor-pointer">
                              ( ) Controle de estoque de produto (unidades diretas)
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="INGREDIENTS" id="edit-stock-ingredients" />
                            <label htmlFor="edit-stock-ingredients" className="text-xs font-medium cursor-pointer">
                              ( ) Controle de estoque de produto e ingrediente (receita / insumos)
                            </label>
                          </div>
                        </RadioGroup>

                        {/* PRODUCT Stock Fields */}
                        {editingItem.stock_control_type === 'PRODUCT' && (
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t mt-2">
                            <div>
                              <Label className="text-xs">Estoque Atual</Label>
                              <Input
                                type="number"
                                min="0"
                                value={editingItem.estoque_atual}
                                onChange={(e) => setEditingItem({ ...editingItem, estoque_atual: e.target.value })}
                                className="h-8 text-xs"
                                placeholder="50"
                                required
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Alerta Mínimo (&le;)</Label>
                              <Input
                                type="number"
                                min="0"
                                value={editingItem.estoque_minimo}
                                onChange={(e) => setEditingItem({ ...editingItem, estoque_minimo: e.target.value })}
                                className="h-8 text-xs"
                                placeholder="5"
                              />
                            </div>
                          </div>
                        )}

                        {/* INGREDIENTS Recipe Fields */}
                        {editingItem.stock_control_type === 'INGREDIENTS' && (
                          <div className="space-y-2 pt-2 border-t mt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold">Composição / Receita por Porção:</span>
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs text-primary"
                                onClick={() => setIngredientsDialogOpen(true)}
                              >
                                + Gerenciar Insumos
                              </Button>
                            </div>

                            {editingItem.receita.length > 0 ? (
                              <div className="space-y-1.5">
                                {editingItem.receita.map((r) => (
                                  <div
                                    key={r.ingredient_id}
                                    className="flex items-center justify-between text-xs p-1.5 rounded bg-background border"
                                  >
                                    <span>
                                      <strong>{r.quantidade}x</strong> {r.ingredient_nome}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive"
                                      onClick={() => removeIngredientFromRecipe(true, r.ingredient_id)}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">
                                Nenhum insumo vinculado a esta receita ainda.
                              </p>
                            )}

                            {/* Add ingredient row to editing item */}
                            <div className="flex items-center gap-2 pt-1">
                              <Select value={selectedIngId} onValueChange={setSelectedIngId}>
                                <SelectTrigger className="h-8 text-xs flex-1">
                                  <SelectValue placeholder="Selecione um insumo..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {ingredients.map((ing) => (
                                    <SelectItem key={ing.id} value={ing.id} className="text-xs">
                                      {ing.nome} ({ing.unidade})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                min="1"
                                className="h-8 w-16 text-xs"
                                value={selectedIngQty}
                                onChange={(e) => setSelectedIngQty(Number(e.target.value) || 1)}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="h-8 text-xs font-semibold"
                                onClick={() => addIngredientToRecipe(true)}
                                disabled={!selectedIngId}
                              >
                                + Adicionar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={isPending}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          type="submit"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          disabled={isPending}
                        >
                          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Salvar Alterações
                        </Button>
                      </div>
                    </form>
                  ) : (
                    /* Display Item Summary */
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{item.nome}</span>
                          <span className="text-xs font-mono font-bold text-primary">
                            {formatCurrency(item.preco_centavos)}
                          </span>

                          {/* Stock Badges */}
                          {item.stock_control_type === 'PRODUCT' ? (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 gap-1">
                              <Package className="h-3 w-3" />
                              Estoque: {item.estoque_atual ?? 0} un
                            </Badge>
                          ) : item.stock_control_type === 'INGREDIENTS' ? (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 gap-1">
                              <Layers className="h-3 w-3" />
                              Receita ({item.receita?.length || 0} insumos)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground opacity-60">
                              Sem estoque
                            </Badge>
                          )}
                        </div>

                        {item.ingredientes && item.ingredientes.length > 0 && (
                          <p className="text-xs text-muted-foreground italic">
                            Tags: {item.ingredientes.join(', ')}
                          </p>
                        )}

                        {item.stock_control_type === 'INGREDIENTS' && item.receita && item.receita.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Usa: {item.receita.map((r) => `${r.quantidade}x ${r.ingredient_nome}`).join(', ')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleEditClick(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Item do Cardápio</AlertDialogTitle>
                              <AlertDialogDescription>
                                Deseja realmente excluir permanentemente <strong>{item.nome}</strong>?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(item.id)}
                                disabled={isPending}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {isPending ? <Loader2 className="animate-spin" /> : 'Excluir'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form to Add New Item */}
          <SheetFooter className="mt-auto pt-4 border-t block">
            <form onSubmit={handleAddSubmit} className="space-y-4 w-full">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-primary" />
                Adicionar Novo Item ao Cardápio
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-8 space-y-1">
                  <Label htmlFor="new-item-name" className="text-xs">
                    Nome do Item
                  </Label>
                  <Input
                    id="new-item-name"
                    placeholder="Ex: Hambúrguer Clássico, Batata Frita"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    className="h-8 text-xs"
                  />
                </div>
                <div className="sm:col-span-4 space-y-1">
                  <Label htmlFor="new-item-price" className="text-xs">
                    Preço (R$)
                  </Label>
                  <Input
                    id="new-item-price"
                    type="number"
                    step="0.01"
                    placeholder="15.00"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    required
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-item-ingredientes" className="text-xs">
                  Ingredientes / Tags opcionais (para remover no pedido)
                </Label>
                <Input
                  id="new-item-ingredientes"
                  placeholder="Ex: Queijo, Bacon, Alface, Molho"
                  value={newIngredientes}
                  onChange={(e) => setNewIngredientes(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* 3-Option Stock Selector */}
              <div className="space-y-2 rounded-md border p-3 bg-muted/20">
                <Label className="text-xs font-bold text-foreground">
                  Controle de Estoque:
                </Label>
                <RadioGroup
                  value={newStockType}
                  onValueChange={(val) => setNewStockType(val as StockControlType)}
                  className="grid grid-cols-1 gap-1.5 pt-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="NONE" id="new-stock-none" />
                    <label htmlFor="new-stock-none" className="text-xs font-medium cursor-pointer">
                      ( ) Sem controle de estoque
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PRODUCT" id="new-stock-product" />
                    <label htmlFor="new-stock-product" className="text-xs font-medium cursor-pointer">
                      ( ) Controle de estoque de produto (unidades diretas)
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="INGREDIENTS" id="new-stock-ingredients" />
                    <label htmlFor="new-stock-ingredients" className="text-xs font-medium cursor-pointer">
                      ( ) Controle de estoque de produto e ingrediente (receita / insumos)
                    </label>
                  </div>
                </RadioGroup>

                {/* PRODUCT Fields */}
                {newStockType === 'PRODUCT' && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t mt-2">
                    <div>
                      <Label className="text-xs">Estoque Inicial</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newStockAtual}
                        onChange={(e) => setNewStockAtual(e.target.value)}
                        className="h-8 text-xs"
                        placeholder="50"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Alerta Baixo (&le;)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newStockMinimo}
                        onChange={(e) => setNewStockMinimo(e.target.value)}
                        className="h-8 text-xs"
                        placeholder="5"
                      />
                    </div>
                  </div>
                )}

                {/* INGREDIENTS Fields */}
                {newStockType === 'INGREDIENTS' && (
                  <div className="space-y-2 pt-2 border-t mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Composição da Receita:</span>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-primary"
                        onClick={() => setIngredientsDialogOpen(true)}
                      >
                        + Cadastrar Insumos
                      </Button>
                    </div>

                    {newRecipe.length > 0 ? (
                      <div className="space-y-1.5">
                        {newRecipe.map((r) => (
                          <div
                            key={r.ingredient_id}
                            className="flex items-center justify-between text-xs p-1.5 rounded bg-background border"
                          >
                            <span>
                              <strong>{r.quantidade}x</strong> {r.ingredient_nome}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => removeIngredientFromRecipe(false, r.ingredient_id)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Adicione os insumos consumidos por este item abaixo.
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <Select value={selectedIngId} onValueChange={setSelectedIngId}>
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder="Selecione um insumo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ingredients.map((ing) => (
                            <SelectItem key={ing.id} value={ing.id} className="text-xs">
                              {ing.nome} ({ing.unidade})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="1"
                        className="h-8 w-16 text-xs"
                        value={selectedIngQty}
                        onChange={(e) => setSelectedIngQty(Number(e.target.value) || 1)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs font-semibold"
                        onClick={() => addIngredientToRecipe(false)}
                        disabled={!selectedIngId}
                      >
                        + Adicionar
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full h-9 font-semibold text-xs" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Adicionar ao Cardápio'}
              </Button>
            </form>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Insumos & Estoque Dialog */}
      <ManageIngredientsDialog
        pdv={pdv}
        open={ingredientsDialogOpen}
        onOpenChange={setIngredientsDialogOpen}
      />
    </>
  );
}
