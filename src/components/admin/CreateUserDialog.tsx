'use client';
import { useState, useActionState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createUser } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import type { Pdv, Tenant, TenantEvent } from '@/lib/definitions';

// ---------------------------------------------------------------------------
// Schema — mirrors the server-side schema in actions.ts
// ---------------------------------------------------------------------------
const UserSchema = z
  .object({
    email: z.string().email('Email inválido.'),
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
    name: z.string().min(1, 'O nome é obrigatório.'),
    role: z.enum(['SUPERADMIN', 'ADMIN_ORGANIZACAO', 'ADMIN_EVENTO', 'CAIXA', 'PDV'], {
      required_error: 'A função é obrigatória.',
    }),
    pdvId: z.string().optional(),
    tenantId: z.string().optional(),
    eventId: z.string().optional(),
  })
  .refine((data) => data.role !== 'PDV' || !!data.pdvId, {
    message: 'PDV é obrigatório para a função PDV',
    path: ['pdvId'],
  });

type UserFormValues = z.infer<typeof UserSchema>;

const initialState = { status: 'idle' as 'idle' | 'success' | 'error', message: '' };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createUser, initialState);
  const { toast } = useToast();

  const [pdvs, setPdvs] = useState<Pdv[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [events, setEvents] = useState<TenantEvent[]>([]);

  const firestore = useFirestore();

  const form = useForm<UserFormValues>({
    resolver: zodResolver(UserSchema),
    defaultValues: { role: 'CAIXA' },
  });

  const role = form.watch('role');
  const selectedTenantId = form.watch('tenantId');

  // Subscribe to PDVs and tenants
  useEffect(() => {
    if (!firestore) return;

    const unsubPdvs = onSnapshot(collection(firestore, 'pdvs'), (snap) => {
      setPdvs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pdv)));
    });

    const unsubTenants = onSnapshot(collection(firestore, 'tenants'), (snap) => {
      setTenants(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tenant)));
    });

    return () => {
      unsubPdvs();
      unsubTenants();
    };
  }, [firestore]);

  // Load events when tenantId changes
  useEffect(() => {
    if (!firestore || !selectedTenantId) {
      setEvents([]);
      form.setValue('eventId', undefined);
      return;
    }
    getDocs(collection(firestore, 'tenants', selectedTenantId, 'events')).then((snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TenantEvent)));
    });
    form.setValue('eventId', undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, selectedTenantId]);

  // Handle server action result
  useEffect(() => {
    if (state.status === 'success') {
      toast({ title: 'Sucesso!', description: state.message });
      form.reset();
      setOpen(false);
    } else if (state.status === 'error') {
      toast({ variant: 'destructive', title: 'Erro!', description: state.message });
    }
  }, [state, toast, form]);

  const onSubmit = (data: UserFormValues) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        formData.append(key, value);
      }
    });
    formAction(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Novo Usuário</DialogTitle>
          <DialogDescription>
            Preencha os detalhes para criar um novo usuário no sistema.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Nome */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Maria" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Senha */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Função */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Função</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a função" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ADMIN_ORGANIZACAO">Admin Organização</SelectItem>
                      <SelectItem value="ADMIN_EVENTO">Admin Evento</SelectItem>
                      <SelectItem value="CAIXA">Caixa</SelectItem>
                      <SelectItem value="PDV">Ponto de Venda (PDV)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* PDV (only for PDV role) */}
            {role === 'PDV' && (
              <FormField
                control={form.control}
                name="pdvId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ponto de Venda</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o PDV" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pdvs.map((pdv) => (
                          <SelectItem key={pdv.id} value={pdv.id}>
                            {pdv.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Organização */}
            <FormField
              control={form.control}
              name="tenantId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organização (opcional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a organização" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Evento (conditional on org selection) */}
            {selectedTenantId && events.length > 0 && (
              <FormField
                control={form.control}
                name="eventId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Evento (opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o evento" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {events.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : 'Criar Usuário'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    