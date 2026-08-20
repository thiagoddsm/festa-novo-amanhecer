'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { useTenant } from '@/hooks/use-tenant-context';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { Pdv } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Store, Plus, Pencil, Trash2, Check, X, Building2, Calendar } from 'lucide-react';
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

export default function PdvsPage() {
  const firestore = useFirestore();
  const { currentTenant, currentEvent } = useTenant();
  const { toast } = useToast();

  const [pdvs, setPdvs] = useState<Pdv[]>([]);
  const [newPdvName, setNewPdvName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state
  const [editingPdvId, setEditingPdvId] = useState<string | null>(null);
  const [editingPdvName, setEditingPdvName] = useState('');

  // Fetch PDVs in real-time
  useEffect(() => {
    if (!firestore) return;
    const pdvRef = collection(firestore, 'pdvs');

    const unsub = onSnapshot(pdvRef, (snapshot) => {
      const allPdvs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Pdv));
      
      // Filter by active tenant and event if selected
      const filtered = allPdvs.filter((p) => {
        const matchTenant = !currentTenant || !p.tenant_id || p.tenant_id === currentTenant.id;
        const matchEvent = !currentEvent || !p.event_id || p.event_id === currentEvent.id;
        return matchTenant && matchEvent;
      });

      setPdvs(filtered);
    });

    return () => unsub();
  }, [firestore, currentTenant, currentEvent]);

  // Create PDV
  const handleCreatePdv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPdvName.trim() || !firestore) return;

    if (!currentTenant) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma Organização',
        description: 'Selecione uma Organização no menu superior antes de criar um PDV.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, 'pdvs'), {
        nome: newPdvName.trim(),
        tenant_id: currentTenant.id,
        event_id: currentEvent?.id || '',
      });

      toast({
        title: 'Ponto de Venda Criado!',
        description: `PDV "${newPdvName.trim()}" cadastrado com sucesso.`,
      });

      setNewPdvName('');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar PDV',
        description: err.message || 'Não foi possível cadastrar o Ponto de Venda.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update PDV
  const handleUpdatePdv = async (pdvId: string) => {
    if (!editingPdvName.trim() || !firestore) return;
    try {
      const pdvDocRef = doc(firestore, 'pdvs', pdvId);
      await updateDoc(pdvDocRef, { nome: editingPdvName.trim() });
      toast({
        title: 'PDV Atualizado!',
        description: 'Nome do Ponto de Venda alterado com sucesso.',
      });
      setEditingPdvId(null);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: err.message,
      });
    }
  };

  // Delete PDV
  const handleDeletePdv = async (pdv: Pdv) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'pdvs', pdv.id));
      toast({
        title: 'PDV Excluído!',
        description: `O Ponto de Venda "${pdv.nome}" foi removido.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: err.message,
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gerenciador de Pontos de Venda (PDV)</h1>
        <p className="text-muted-foreground">
          Cadastre, edite e organize as barracas e pontos de atendimento do evento.
        </p>
      </div>

      {/* Context info badge */}
      {currentTenant && (
        <div className="flex flex-wrap items-center gap-2 bg-muted/40 p-3 rounded-lg border text-xs">
          <span className="font-semibold text-muted-foreground uppercase">Escopo Atual:</span>
          <Badge variant="outline" className="flex items-center gap-1">
            <Building2 className="h-3 w-3" /> {currentTenant.name}
          </Badge>
          {currentEvent ? (
            <Badge variant="secondary" className="flex items-center gap-1 bg-primary/10 text-primary border-primary/20">
              <Calendar className="h-3 w-3" /> {currentEvent.name}
            </Badge>
          ) : (
            <Badge variant="outline" className="italic text-amber-600">
              Todos os Eventos da Organização
            </Badge>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Formulário Novo PDV */}
        <Card className="border-border/60 shadow-sm md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Store className="h-5 w-5 text-primary" /> Novo Ponto de Venda
            </CardTitle>
            <CardDescription>Cadastre uma nova barraca ou guichê.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreatePdv} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pdvName">Nome do PDV / Barraca</Label>
                <Input
                  id="pdvName"
                  placeholder="Ex: Bebidas, Pastel, Caixa 1..."
                  value={newPdvName}
                  onChange={(e) => setNewPdvName(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" disabled={isSubmitting || !newPdvName.trim()} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Cadastrar PDV
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Lista de PDVs Existentes */}
        <Card className="border-border/60 shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              <span className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" /> Pontos de Venda Cadastrados
              </span>
              <Badge variant="secondary">{pdvs.length} PDVs</Badge>
            </CardTitle>
            <CardDescription>
              Lista de guichês ativos para o evento selecionado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pdvs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm space-y-1">
                <p className="font-semibold">Nenhum Ponto de Venda cadastrado ainda.</p>
                <p className="text-xs italic">Use o formulário ao lado para criar o primeiro PDV.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pdvs.map((pdv) => (
                  <div
                    key={pdv.id}
                    className="flex items-center justify-between p-3.5 rounded-lg border bg-card hover:bg-muted/20 transition-colors"
                  >
                    {editingPdvId === pdv.id ? (
                      <div className="flex items-center gap-2 w-full">
                        <Input
                          value={editingPdvName}
                          onChange={(e) => setEditingPdvName(e.target.value)}
                          className="h-8 text-xs flex-grow"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                          title="Salvar"
                          onClick={() => handleUpdatePdv(pdv.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground"
                          title="Cancelar"
                          onClick={() => setEditingPdvId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-md bg-primary/10 text-primary">
                            <Store className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-sm block">{pdv.nome}</span>
                            <span className="text-[10px] text-muted-foreground block">ID: {pdv.id}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Editar Nome"
                            onClick={() => {
                              setEditingPdvId(pdv.id);
                              setEditingPdvName(pdv.nome);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                title="Excluir PDV"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-destructive flex items-center gap-2">
                                  <Trash2 className="h-5 w-5" /> Confirmar Exclusão de PDV
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o Ponto de Venda <strong>"{pdv.nome}"</strong>?
                                  <br />
                                  <span className="text-destructive font-semibold">
                                    Esta ação não poderá ser desfeita.
                                  </span>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeletePdv(pdv)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Sim, Excluir PDV
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
