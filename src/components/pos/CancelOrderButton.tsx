'use client';

import { useState, useTransition } from 'react';
import { Loader2, XCircle } from 'lucide-react';
import type { Order } from '@/lib/definitions';
import { cancelOrder } from '@/lib/actions';
import { useAuth } from '@/hooks/use-auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatCurrency } from '@/lib/utils';

const PRIVILEGED_ROLES = ['CAIXA', 'ADMIN_EVENTO', 'ADMIN_ORGANIZACAO', 'SUPERADMIN'];

/** Returns true when the given user role may cancel an order in this status. */
export function canCancelOrder(order: Pick<Order, 'status'>, role?: string | null): boolean {
  if (!role) return false;
  if (order.status === 'CANCELADO' || order.status === 'ARQUIVADO') return false;
  const isActive = order.status === 'PENDENTE' || order.status === 'EM_PREPARO';
  return isActive || PRIVILEGED_ROLES.includes(role);
}

function orderTotalCents(order: Order): number {
  return (order.items || []).reduce((sum, it: any) => sum + (it.price ?? 0) * (it.quantity ?? 0), 0);
}

export default function CancelOrderButton({
  order,
  compact = false,
  className,
}: {
  order: Order;
  compact?: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!canCancelOrder(order, user?.role)) return null;

  const total = orderTotalCents(order);

  const handleConfirm = () => {
    startTransition(async () => {
      const res = await cancelOrder(order.id, user?.name || user?.email || 'Operador', user?.role || '');
      if (res?.status === 'success') {
        toast({ title: 'Pedido cancelado', description: res.message });
        setOpen(false);
      } else {
        toast({ variant: 'destructive', title: 'Não foi possível cancelar', description: res?.message });
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          className ??
          (compact
            ? 'h-7 px-2 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive gap-1'
            : 'h-9 w-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5')
        }
      >
        <XCircle className="h-3.5 w-3.5" />
        Cancelar pedido
      </Button>

      <AlertDialog open={open} onOpenChange={(v) => !isPending && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido #{order.order_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              O valor{total > 0 ? ` de ${formatCurrency(total)}` : ''} será devolvido ao saldo do cartão de{' '}
              <strong>{order.cliente_nome || 'Cliente'}</strong>, o estoque dos itens será restaurado e o cliente será avisado
              no WhatsApp. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sim, cancelar e estornar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
