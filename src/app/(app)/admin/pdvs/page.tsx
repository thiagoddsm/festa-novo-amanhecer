'use client';

import { useState, useEffect, useTransition } from 'react';
import { useFirestore } from '@/firebase';
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/use-tenant-context';
import { Store, Plus, Trash2, Pencil, UtensilsCrossed, Sparkles, Building2, Calendar, MessageSquare, PackagePlus } from 'lucide-react';
import type { Pdv, MenuItem } from '@/lib/definitions';
import { createPdv, updatePdv, deletePdv, seedDefaultPdvs } from '@/lib/actions';
import EditMenuSheet from '@/components/pos/EditMenuSheet';
import ManageIngredientsDialog from '@/components/pos/ManageIngredientsDialog';
import PdvWhatsappDialog from '@/components/pos/PdvWhatsappDialog';
import PdvIconPicker from '@/components/pos/PdvIconPicker';
import { getPdvIconConfig, detectPdvIconId } from '@/lib/pdv-icons';

export default function AdminPdvsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { currentTenant, currentEvent } = useTenant();

  const [pdvs, setPdvs] = useState<Pdv[] | null>(null);
  const [menuItemsByPdv, setMenuItemsByPdv] = useState<Record<string, MenuItem[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // New PDV dialog
  const [newPdvOpen, setNewPdvOpen] = useState(false);
  const [newPdvName, setNewPdvName] = useState('');
  const [newPdvIcon, setNewPdvIcon] = useState('geral');
  const [isCreatingPdv, setIsCreatingPdv] = useState(false);

  // Edit PDV Name dialog
  const [editPdvOpen, setEditPdvOpen] = useState(false);
  const [editingPdv, setEditingPdv] = useState<Pdv | null>(null);
  const [editPdvName, setEditPdvName] = useState('');
  const [editPdvIcon, setEditPdvIcon] = useState('geral');
  const [isUpdatingPdv, setIsUpdatingPdv] = useState(false);

  // Edit Menu Sheet
  const [menuSheetOpen, setMenuSheetOpen] = useState(false);
  const [selectedPdvForMenu, setSelectedPdvForMenu] = useState<Pdv | null>(null);

  // WhatsApp Dialog
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [selectedPdvForWhatsapp, setSelectedPdvForWhatsapp] = useState<Pdv | null>(null);

  // Insumos Dialog
  const [ingredientsDialogOpen, setIngredientsDialogOpen] = useState(false);
  const [selectedPdvForIngredients, setSelectedPdvForIngredients] = useState<Pdv | null>(null);

  // Seeding
  const [isSeeding, startSeeding] = useTransition();

  // Load PDVs for current tenant & event
  useEffect(() => {
    if (!firestore) return;

    const pdvCol = collection(firestore, 'pdvs');
    const unsubscribe = onSnapshot(pdvCol, async (snapshot) => {
      const allPdvs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Pdv));

      // Filter strictly by current tenant and event
      const filtered = allPdvs.filter((p) => {
        if (!currentTenant) return false;
        if (p.tenant_id !== currentTenant.id) return false;
        if (currentEvent) {
          return p.event_id === currentEvent.id;
        }
        return !p.event_id;
      });

      setPdvs(filtered);
      setIsLoading(false);

      // Load menu items for each PDV
      const itemsMap: Record<string, MenuItem[]> = {};
      for (const p of filtered) {
        try {
          const menuSnap = await getDocs(collection(firestore, 'pdvs', p.id, 'menuItems'));
          itemsMap[p.id] = menuSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MenuItem));
        } catch (e) {
          itemsMap[p.id] = [];
        }
      }
      setMenuItemsByPdv(itemsMap);
    });

    return () => unsubscribe();
  }, [firestore, currentTenant, currentEvent]);

  // Create PDV
  const handleCreatePdv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPdvName.trim() || isCreatingPdv) return;

    setIsCreatingPdv(true);
    try {
      const formData = new FormData();
      formData.append('nome', newPdvName.trim());
      formData.append('icon', newPdvIcon || detectPdvIconId(newPdvName.trim()));
      if (currentTenant) formData.append('tenant_id', currentTenant.id);
      if (currentEvent) formData.append('event_id', currentEvent.id);

      const result = await createPdv(undefined, formData);
      if (result?.status === 'success') {
        toast({ title: 'Sucesso!', description: result.message });
        setNewPdvName('');
        setNewPdvIcon('geral');
        setNewPdvOpen(false);
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.message });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível criar o PDV.' });
    } finally {
      setIsCreatingPdv(false);
    }
  };

  // Update PDV
  const handleUpdatePdv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPdv || !editPdvName.trim() || isUpdatingPdv) return;

    setIsUpdatingPdv(true);
    try {
      const result = await updatePdv(editingPdv.id, editPdvName.trim(), editPdvIcon);
      if (result?.status === 'success') {
        toast({ title: 'Sucesso!', description: result.message });
        setEditPdvOpen(false);
        setEditingPdv(null);
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.message });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao atualizar o PDV.' });
    } finally {
      setIsUpdatingPdv(false);
    }
  };

  // Delete PDV
  const handleDeletePdv = async (pdvId: string) => {
    try {
      const result = await deletePdv(pdvId);
      if (result?.status === 'success') {
        toast({ title: 'Excluído!', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.message });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao excluir o PDV.' });
    }
  };

  // Seed default stalls
  const handleSeedDefaults = () => {
    if (!currentTenant || !currentEvent) {
      toast({
        variant: 'destructive',
        title: 'Atenção',
        description: 'Selecione uma Organização e um Evento no cabeçalho antes de criar barracas.',
      });
      return;
    }

    startSeeding(async () => {
      const result = await seedDefaultPdvs(currentTenant.id, currentEvent.id);
      if (result?.status === 'success') {
        toast({ title: 'Barracas Criadas!', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.message });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 min-w-0 w-full max-w-full">
      <Card className="w-full min-w-0">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-6 pb-4">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
              <Store className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">Gerenciar Pontos de Venda (PDVs)</span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs sm:text-sm text-muted-foreground">
              <span>Configuração para:</span>
              <Badge variant="outline" className="font-normal text-xs gap-1 max-w-[170px] truncate">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{currentTenant?.name || 'Todas as Organizações'}</span>
              </Badge>
              {currentEvent && (
                <Badge variant="secondary" className="font-normal text-xs gap-1 max-w-[150px] truncate">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span className="truncate">{currentEvent.name}</span>
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {(!pdvs || pdvs.length === 0) && (
              <Button
                variant="outline"
                onClick={handleSeedDefaults}
                disabled={isSeeding || !currentTenant || !currentEvent}
                className="text-xs flex-1 sm:flex-initial"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
                {isSeeding ? 'Criando…' : 'Criar Barracas Padrão'}
              </Button>
            )}

            <Dialog open={newPdvOpen} onOpenChange={setNewPdvOpen}>
              <DialogTrigger asChild>
                <Button className="flex-1 sm:flex-initial">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo PDV
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCreatePdv}>
                  <DialogHeader>
                    <DialogTitle>Cadastrar Novo PDV</DialogTitle>
                    <DialogDescription>
                      Cadastre uma nova barraca ou ponto de venda para{' '}
                      <strong>{currentEvent?.name || currentTenant?.name || 'o evento'}</strong>.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-3">
                    <div>
                      <label className="text-sm font-medium">Nome do PDV / Barraca</label>
                      <Input
                        placeholder="Ex: Barraca do Espetinho"
                        value={newPdvName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewPdvName(val);
                          setNewPdvIcon(detectPdvIconId(val));
                        }}
                        className="mt-1"
                        autoFocus
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Símbolo / Categoria</label>
                      <p className="text-xs text-muted-foreground mb-1.5">Escolha o ícone que aparecerá no terminal e nas listagens.</p>
                      <PdvIconPicker
                        value={newPdvIcon}
                        onChange={setNewPdvIcon}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setNewPdvOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isCreatingPdv || !newPdvName.trim()}>
                      {isCreatingPdv ? 'Criando…' : 'Salvar PDV'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-6 pt-0">
          {isLoading ? (
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-44 w-full rounded-xl" />
            </div>
          ) : pdvs && pdvs.length > 0 ? (
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pdvs.map((pdv) => {
                const items = menuItemsByPdv[pdv.id] || [];
                const iconConfig = getPdvIconConfig(pdv.icon, pdv.nome);
                const IconComponent = iconConfig.icon;

                return (
                  <Card key={pdv.id} className="border bg-card flex flex-col justify-between w-full min-w-0 shadow-xs">
                    <CardHeader className="p-3 sm:p-4 pb-2 flex flex-row items-start justify-between space-y-0 gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2 min-w-0">
                          <div className={`h-8 w-8 rounded-xl ${iconConfig.iconBg} ${iconConfig.iconColor} flex items-center justify-center shrink-0 shadow-2xs`}>
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <span className="truncate">{pdv.nome}</span>
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {items.length} {items.length === 1 ? 'item no cardápio' : 'itens no cardápio'}
                        </CardDescription>

                        {/* WhatsApp Status Badge */}
                        <div className="mt-2">
                          {pdv.whatsapp?.status === 'CONNECTED' ? (
                            <Badge
                              variant="outline"
                              className="border-green-300 bg-green-50 text-green-700 text-[11px] gap-1 cursor-pointer hover:bg-green-100 shadow-2xs max-w-full truncate"
                              onClick={() => {
                                setSelectedPdvForWhatsapp(pdv);
                                setWhatsappDialogOpen(true);
                              }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                              <MessageSquare className="h-3 w-3 shrink-0" />
                              <span className="truncate">WPP Conectado</span>
                              {pdv.whatsapp.phoneNumber && (
                                <span className="font-mono text-[10px] opacity-75 hidden xs:inline">+{pdv.whatsapp.phoneNumber}</span>
                              )}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50/70 text-amber-800 text-[11px] gap-1 cursor-pointer hover:bg-amber-100 shadow-2xs max-w-full truncate"
                              onClick={() => {
                                setSelectedPdvForWhatsapp(pdv);
                                setWhatsappDialogOpen(true);
                              }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                              <MessageSquare className="h-3 w-3 shrink-0" />
                              <span className="truncate">WPP Desconectado</span>
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingPdv(pdv);
                            setEditPdvName(pdv.nome);
                            setEditPdvIcon(pdv.icon || detectPdvIconId(pdv.nome));
                            setEditPdvOpen(true);
                          }}
                          title="Editar PDV e Símbolo"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              title="Excluir PDV"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Ponto de Venda?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Você está prestes a excluir o PDV <strong>&quot;{pdv.nome}&quot;</strong> e todo o seu cardápio. Essa ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeletePdv(pdv.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardHeader>

                    <CardContent className="p-3 sm:p-4 pt-0 flex flex-col gap-3">
                      {/* Menu preview */}
                      <div className="space-y-1">
                        {items.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {items.slice(0, 4).map((item) => (
                              <Badge key={item.id} variant="secondary" className="text-xs font-normal max-w-full truncate">
                                {item.nome}
                              </Badge>
                            ))}
                            {items.length > 4 && (
                              <Badge variant="outline" className="text-xs">
                                +{items.length - 4} mais
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            Cardápio vazio. Clique abaixo para cadastrar itens.
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="pt-2 border-t flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs h-8"
                          onClick={() => {
                            setSelectedPdvForMenu(pdv);
                            setMenuSheetOpen(true);
                          }}
                        >
                          <UtensilsCrossed className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                          <span>Cardápio</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 gap-1 shrink-0"
                          title="Gerenciar insumos e estoque deste PDV"
                          onClick={() => {
                            setSelectedPdvForIngredients(pdv);
                            setIngredientsDialogOpen(true);
                          }}
                        >
                          <PackagePlus className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span>Insumos</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className={`text-xs h-8 gap-1.5 shrink-0 ${
                            pdv.whatsapp?.status === 'CONNECTED'
                              ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                              : 'border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100'
                          }`}
                          onClick={() => {
                            setSelectedPdvForWhatsapp(pdv);
                            setWhatsappDialogOpen(true);
                          }}
                        >
                          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                          <span>{pdv.whatsapp?.status === 'CONNECTED' ? 'WhatsApp' : 'Conectar'}</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Store className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="font-medium">Nenhum PDV cadastrado para este evento</p>
              <p className="text-xs mt-1">
                Clique em &quot;Criar Barracas Padrão&quot; para adicionar barracas e cardápios pré-configurados ou cadastre manualmente.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit PDV Dialog */}
      <Dialog open={editPdvOpen} onOpenChange={setEditPdvOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleUpdatePdv}>
            <DialogHeader>
              <DialogTitle>Editar Ponto de Venda</DialogTitle>
              <DialogDescription>
                Altere o nome e o símbolo representativo deste PDV.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <div>
                <label className="text-sm font-medium">Nome do PDV</label>
                <Input
                  value={editPdvName}
                  onChange={(e) => setEditPdvName(e.target.value)}
                  className="mt-1"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Símbolo / Categoria</label>
                <p className="text-xs text-muted-foreground mb-1.5">Escolha o ícone representativo deste PDV.</p>
                <PdvIconPicker
                  value={editPdvIcon}
                  onChange={setEditPdvIcon}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditPdvOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isUpdatingPdv || !editPdvName.trim()}>
                {isUpdatingPdv ? 'Salvando…' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Menu Sheet */}
      {selectedPdvForMenu && (
        <EditMenuSheet
          pdv={selectedPdvForMenu}
          menuItems={menuItemsByPdv[selectedPdvForMenu.id] || []}
          isOpen={menuSheetOpen}
          onOpenChange={(open) => {
            setMenuSheetOpen(open);
            if (!open) setSelectedPdvForMenu(null);
          }}
        />
      )}

      {/* PDV Insumos Dialog */}
      {selectedPdvForIngredients && (
        <ManageIngredientsDialog
          pdv={selectedPdvForIngredients}
          open={ingredientsDialogOpen}
          onOpenChange={(open) => {
            setIngredientsDialogOpen(open);
            if (!open) setSelectedPdvForIngredients(null);
          }}
        />
      )}

      {/* PDV WhatsApp Dialog */}
      {selectedPdvForWhatsapp && (
        <PdvWhatsappDialog
          pdv={selectedPdvForWhatsapp}
          open={whatsappDialogOpen}
          onOpenChange={(open) => {
            setWhatsappDialogOpen(open);
            if (!open) setSelectedPdvForWhatsapp(null);
          }}
        />
      )}
    </div>
  );
}
