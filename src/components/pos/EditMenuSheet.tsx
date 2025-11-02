'use client';
import { useState, useTransition, useActionState, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Pencil, Check, X, Loader2, PlusCircle } from 'lucide-react';
import { Pdv, MenuItem } from '@/lib/definitions';
import { formatCurrency } from '@/lib/utils';
import { addMenuItem, updateMenuItem, deleteMenuItem } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
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
} from "@/components/ui/alert-dialog"

interface EditMenuSheetProps {
  pdv: Pdv;
  menuItems: MenuItem[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditingItem {
  id: string;
  nome: string;
  preco_centavos: number;
  ingredientes: string[];
}

const initialState = { status: 'success' as 'success' | 'error', message: '' };

export default function EditMenuSheet({ pdv, menuItems, isOpen, onOpenChange }: EditMenuSheetProps) {
  const { toast } = useToast();
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const [addState, addAction] = useActionState(addMenuItem, initialState);
  const [updateState, updateAction] = useActionState(updateMenuItem, initialState);
  
  const addFormRef = useRef<HTMLFormElement>(null);


  const handleEditClick = (item: MenuItem) => {
    setEditingItem({
      id: item.id,
      nome: item.nome,
      preco_centavos: item.preco_centavos,
      ingredientes: item.ingredientes || [],
    });
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
  };
  
  const handleDelete = (itemId: string) => {
      startTransition(async () => {
          const result = await deleteMenuItem(pdv.id, itemId);
          toast({
              title: result.status === 'success' ? 'Sucesso!' : 'Erro!',
              description: result.message,
              variant: result.status === 'success' ? 'default' : 'destructive',
          })
      })
  }
  
  const handleUpdateSubmit = (formData: FormData) => {
    if (!editingItem) return;
    formData.append('pdvId', pdv.id);
    formData.append('itemId', editingItem.id);
    
    startTransition(() => {
        updateAction(formData);
        if (updateState.status === 'success') {
            toast({ title: 'Sucesso', description: updateState.message });
            setEditingItem(null);
        } else {
            toast({ variant: 'destructive', title: 'Erro', description: updateState.message });
        }
    })
    setEditingItem(null);
  }

  const handleAddSubmit = (formData: FormData) => {
      formData.append('pdvId', pdv.id);
      startTransition(() => {
        addAction(formData);
        if (addState.status === 'success') {
            toast({ title: 'Sucesso!', description: addState.message });
            addFormRef.current?.reset();
        } else {
            toast({ variant: 'destructive', title: 'Erro!', description: addState.message });
        }
      })
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Editar Cardápio</SheetTitle>
          <SheetDescription>
            Adicione, edite ou remova itens do cardápio para <span className="font-semibold text-primary">{pdv.nome}</span>.
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="flex-grow pr-6 -mr-6">
          <div className="space-y-4 py-4">
            {menuItems.map(item => (
              <div key={item.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                {editingItem?.id === item.id ? (
                  <form action={handleUpdateSubmit} className="flex-grow space-y-2">
                     <div className="flex items-center gap-2">
                        <Input
                        name="nome"
                        defaultValue={editingItem.nome}
                        className="h-8"
                        required
                        />
                        <Input
                        name="preco_reais"
                        type="number"
                        step="0.01"
                        defaultValue={editingItem.preco_centavos / 100}
                        className="h-8 w-24"
                        required
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" type="submit" disabled={isPending}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" type="button" onClick={handleCancelEdit}>
                        <X className="h-4 w-4" />
                        </Button>
                    </div>
                     <div>
                        <Label htmlFor='ingredientes' className="text-xs">Ingredientes (separados por vírgula)</Label>
                        <Input
                            name="ingredientes"
                            defaultValue={editingItem.ingredientes.join(', ')}
                            className="h-8"
                        />
                    </div>
                  </form>
                ) : (
                  <>
                    <div>
                      <p className="font-medium">{item.nome}</p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(item.preco_centavos)}</p>
                      {item.ingredientes && item.ingredientes.length > 0 && (
                          <p className="text-xs text-muted-foreground italic">
                              {item.ingredientes.join(', ')}
                          </p>
                      )}
                    </div>
                    <div className="flex items-center">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditClick(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Essa ação não pode ser desfeita. Isso excluirá permanentemente o item do cardápio.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(item.id)} disabled={isPending}>
                                    {isPending ? <Loader2 className='animate-spin' /> : "Excluir"}
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <SheetFooter className="mt-auto pt-4 border-t">
            <form ref={addFormRef} action={handleAddSubmit} className="space-y-4 w-full">
                <h4 className='font-semibold flex items-center gap-2'><PlusCircle className='h-4 w-4' />Adicionar Novo Item</h4>
                 <div className="flex items-end gap-2">
                    <div className='flex-grow'>
                        <Label htmlFor="new-item-name">Nome do Item</Label>
                        <Input id="new-item-name" name="nome" placeholder="Ex: Batata Frita" required/>
                    </div>
                    <div className='w-28'>
                        <Label htmlFor="new-item-price">Preço (R$)</Label>
                        <Input id="new-item-price" name="preco_reais" type="number" step="0.01" placeholder="15.00" required/>
                    </div>
                 </div>
                 <div>
                    <Label htmlFor="new-item-ingredientes">Ingredientes (separados por vírgula)</Label>
                    <Input id="new-item-ingredientes" name="ingredientes" placeholder="Ex: Queijo, Bacon, Cheddar" />
                </div>
                 <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? <Loader2 className="animate-spin" /> : 'Adicionar ao Cardápio'}
                 </Button>
            </form>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
