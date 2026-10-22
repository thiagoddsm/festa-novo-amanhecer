'use client';
import { useState, useEffect, useMemo, useTransition } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, writeBatch, Timestamp, doc } from 'firebase/firestore';
import { type Order, type OrderItem } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { updateOrderStatus } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { ScrollArea } from '../ui/scroll-area';
import { Loader2, ArrowRightCircle, MessageSquare, Check, AlertCircle } from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { formatDateTime } from '@/lib/utils';
import { useTenant } from '@/hooks/use-tenant-context';


type OrderStatus = 'EM_PREPARO' | 'PRONTO' | 'ENTREGUE';

const ItemTypes = {
  ORDER: 'order',
};

const statusConfig: Record<OrderStatus, { title: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    'EM_PREPARO': { title: 'Em Preparo', variant: 'secondary' },
    'PRONTO': { title: 'Pronto p/ Retirada', variant: 'default' },
    'ENTREGUE': { title: 'Entregue', variant: 'outline' }
};

const KanbanColumn = ({ title, variant, orders, status, isPending }: {
    title: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    orders: Order[];
    status: OrderStatus;
    isPending: boolean;
}) => {
    const [{ isOver }, drop] = useDrop(() => ({
        accept: ItemTypes.ORDER,
        drop: () => ({ status }),
        collect: monitor => ({
            isOver: !!monitor.isOver(),
        }),
    }));

    return (
        <Card
            ref={(node) => { drop(node); }}
            className={cn(
                "flex-1 flex flex-col min-w-[280px] sm:min-w-[300px] transition-colors shadow-xs",
                isOver ? 'bg-accent' : ''
            )}
        >
            <CardHeader className="p-3 sm:p-4 pb-2 border-b">
                <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                    <span className="font-semibold">{title}</span>
                    <Badge variant={variant} className="text-xs px-2">{orders.length}</Badge>
                </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-grow bg-muted/40 p-2 max-h-[60vh] sm:max-h-[68vh]">
                <div className="space-y-2.5 p-1 h-full relative">
                    {isPending && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-xs flex items-center justify-center z-10">
                            <Loader2 className="animate-spin text-primary" />
                        </div>
                    )}
                    {orders.map(order => (
                        <OrderCard key={order.id} order={order} />
                    ))}
                    {orders.length === 0 && (
                        <div className="text-center py-10 px-4">
                            <p className="text-xs sm:text-sm text-muted-foreground">Nenhum pedido nesta etapa.</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </Card>
    );
};

const formatTimestamp = (ts: unknown): Date => {
  if (ts instanceof Timestamp) {
    return ts.toDate();
  }
  if (ts instanceof Date) {
    return ts;
  }
  if (typeof ts === 'string') {
    return new Date(ts);
  }
  return new Date();
}

const OrderCard = ({ order }: { order: Order }) => {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    
    const handleStatusUpdate = (newStatus: OrderStatus) => {
        if (order.status === newStatus) return;
        
        startTransition(async () => {
            const result = await updateOrderStatus(order.id, newStatus);
            if (result.status === 'error') {
                toast({
                    variant: 'destructive',
                    title: 'Erro ao atualizar pedido',
                    description: result.message
                });
            } else {
                toast({
                    title: newStatus === 'PRONTO' ? 'Pedido Pronto!' : newStatus === 'ENTREGUE' ? 'Pedido Entregue!' : 'Status Atualizado',
                    description: `Senha #${order.order_number} de ${order.cliente_nome || 'Cliente'}.`,
                });
            }
        });
    };

    const [{ isDragging }, drag] = useDrag(() => ({
        type: ItemTypes.ORDER,
        item: { id: order.id, status: order.status },
        end: (item, monitor) => {
            const dropResult = monitor.getDropResult<{ status: OrderStatus }>();
            if (item && dropResult) {
                handleStatusUpdate(dropResult.status);
            }
        },
        collect: monitor => ({
            isDragging: !!monitor.isDragging(),
        }),
    }));
    
    const isEmPreparo = order.status === 'PENDENTE' || order.status === 'EM_PREPARO';
    const isPronto = order.status === 'PRONTO';
    const isEntregue = order.status === 'ENTREGUE';

    return (
    <Card
        ref={(node) => { drag(node); }}
        className={cn(
            "cursor-grab bg-card active:cursor-grabbing border shadow-xs hover:shadow-md transition-shadow",
            isDragging ? 'opacity-50' : 'opacity-100',
            isPending ? 'opacity-60 pointer-events-none' : ''
        )}
    >
        <CardHeader className="p-3 pb-2">
            <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                    <span className="font-bold text-base sm:text-lg block truncate">{order.cliente_nome || 'Cliente'}</span>
                    <span className="text-[11px] text-muted-foreground">{formatDateTime(formatTimestamp(order.created_at))}</span>
                </div>
                <div className="text-right shrink-0">
                    <span className="inline-block bg-primary/10 text-primary font-black text-lg sm:text-xl px-2.5 py-0.5 rounded-lg border border-primary/20">
                        #{order.order_number}
                    </span>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 pb-2 space-y-2">
            <ul className="text-xs sm:text-sm space-y-1.5 divide-y divide-border/40">
                {order.items.map((item: OrderItem, index: number) => (
                    <li key={`${item.id}-${index}`} className="pt-1.5 first:pt-0">
                        <div className="flex items-start justify-between gap-1">
                            <span>
                                <strong className="text-primary font-bold">{item.quantity}x</strong> {item.name}
                            </span>
                        </div>
                        {item.observation && (
                            <p className="text-[11px] text-blue-700 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded mt-1 font-medium">
                                Obs: {item.observation}
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        </CardContent>

        <CardFooter className="p-3 pt-2 bg-muted/20 border-t flex flex-col gap-2 items-stretch">
            {/* Quick Action Buttons for Smartphones & Kitchen Display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 w-full">
                {isEmPreparo && (
                    <Button
                        size="sm"
                        onClick={() => handleStatusUpdate('PRONTO')}
                        disabled={isPending}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 text-xs sm:text-sm shadow-xs col-span-full"
                    >
                        {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        ) : (
                            <Check className="h-4 w-4 mr-1.5 stroke-[2.5]" />
                        )}
                        Marcar como Pronto
                    </Button>
                )}

                {isPronto && (
                    <>
                        <Button
                            size="sm"
                            onClick={() => handleStatusUpdate('ENTREGUE')}
                            disabled={isPending}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs sm:text-sm shadow-xs"
                        >
                            {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                            ) : (
                                <ArrowRightCircle className="h-4 w-4 mr-1.5" />
                            )}
                            Marcar Entregue
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusUpdate('EM_PREPARO')}
                            disabled={isPending}
                            className="h-9 text-xs text-muted-foreground hover:text-foreground"
                        >
                            Voltar Preparo
                        </Button>
                    </>
                )}

                {isEntregue && (
                    <div className="col-span-full flex items-center justify-between">
                        <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" /> Concluído & Entregue
                        </span>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStatusUpdate('PRONTO')}
                            disabled={isPending}
                            className="h-7 text-[10px] text-muted-foreground hover:text-foreground px-2"
                        >
                            Reabrir p/ Pronto
                        </Button>
                    </div>
                )}
            </div>

            {/* WhatsApp Notification Status */}
            {order.notification_status && (
                <div className="flex items-center gap-1.5 pt-1 text-[10px]">
                    {order.notification_status === 'SENT' ? (
                        <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                            <MessageSquare className="h-3 w-3 text-green-600" />
                            <Check className="h-2.5 w-2.5" />
                            WPP Notificado {order.notification_route === 'PDV' ? '(Barraca)' : '(Evento)'}
                        </span>
                    ) : order.notification_status === 'SENDING' ? (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                            <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                            Enviando WhatsApp...
                        </span>
                    ) : order.notification_status === 'FAILED' ? (
                        <span className="inline-flex items-center gap-1 text-destructive" title={order.notification_error}>
                            <AlertCircle className="h-3 w-3" />
                            Falha envio WhatsApp
                        </span>
                    ) : null}
                </div>
            )}
        </CardFooter>
    </Card>
)};


function KanbanBoard({ pdvId }: { pdvId: string }) {
    const firestore = useFirestore();
    const { currentTenant, currentEvent } = useTenant();
    const { toast } = useToast();
    const [orders, setOrders] = useState<Order[] | null>(null);
    const [mobileTab, setMobileTab] = useState<OrderStatus>('EM_PREPARO');

    useEffect(() => {
        if (!firestore || !pdvId) return;
        
        const ordersRef = collection(firestore, 'orders');
        
        // This query requires a composite index on (pdv_id, status)
        const q = query(ordersRef, 
            where('pdv_id', '==', pdvId),
            where('status', 'in', ['PENDENTE', 'EM_PREPARO', 'PRONTO', 'ENTREGUE'])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
            // Sort client-side after fetching
            fetchedOrders.sort((a, b) => {
                const dateA = formatTimestamp(a.created_at);
                const dateB = formatTimestamp(b.created_at);
                return dateA.getTime() - dateB.getTime();
            });

            // Filter by tenant and event
            const filteredOrders = fetchedOrders.filter((order) => {
                if (currentTenant && order.tenant_id !== currentTenant.id) return false;
                if (currentEvent && order.event_id !== currentEvent.id) return false;
                return true;
            });

            setOrders(filteredOrders);
        }, (error) => {
            console.error("Error fetching orders:", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar pedidos', description: 'Não foi possível carregar os pedidos em tempo real.' });
        });

        return () => unsubscribe();
    }, [firestore, pdvId, currentTenant, currentEvent, toast]);
    
    // Automatically archive delivered orders after 5 minutes
    useEffect(() => {
        if (!firestore || !orders) return;
        
        const interval = setInterval(() => {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const batch = writeBatch(firestore);
            let hasUpdates = false;

            orders.forEach(order => {
                const orderUpdatedAt = formatTimestamp(order.updated_at);
                if (order.status === 'ENTREGUE' && orderUpdatedAt < fiveMinutesAgo) {
                    const orderRef = doc(firestore, 'orders', order.id);
                    batch.update(orderRef, { status: 'ARQUIVADO' });
                    hasUpdates = true;
                }
            });

            if (hasUpdates) {
                batch.commit().catch(err => console.error("Failed to archive old orders:", err));
            }
        }, 60 * 1000); // Run every minute

        return () => clearInterval(interval);

    }, [firestore, orders]);

    const categorizedOrders = useMemo(() => {
        const initial: Record<OrderStatus, Order[]> = {
            'EM_PREPARO': [], 'PRONTO': [], 'ENTREGUE': []
        };

        if (!orders) return initial;

        return orders.reduce((acc, order) => {
            // Treat PENDENTE as EM_PREPARO for display purposes
            if (order.status === 'PENDENTE' || order.status === 'EM_PREPARO') {
                 acc['EM_PREPARO'].push(order);
            } else if (acc[order.status as OrderStatus]) {
                acc[order.status as OrderStatus].push(order);
            }
            return acc;
        }, initial);

    }, [orders]);

    if (orders === null) {
        return (
            <div className="flex gap-4 overflow-x-auto p-2">
                {Object.keys(statusConfig).map(status => (
                    <Card key={status} className="flex-1 flex flex-col min-w-[280px]">
                        <CardHeader className="p-4">
                             <Skeleton className="h-6 w-3/4" />
                        </CardHeader>
                        <div className="p-4 space-y-3">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    </Card>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {/* Mobile View Toggle: 3 quick tabs so users on phone don't need to scroll sideways */}
            <div className="sm:hidden flex items-center p-1 bg-muted rounded-xl gap-1">
                {(Object.keys(statusConfig) as OrderStatus[]).map((status) => {
                    const count = categorizedOrders[status].length;
                    const isActive = mobileTab === status;
                    return (
                        <button
                            key={status}
                            type="button"
                            onClick={() => setMobileTab(status)}
                            className={cn(
                                "flex-1 py-2 px-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                                isActive 
                                    ? "bg-background text-foreground shadow-xs" 
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <span className="truncate">
                                {status === 'EM_PREPARO' ? 'Preparo' : status === 'PRONTO' ? 'Prontos' : 'Entregues'}
                            </span>
                            <span className={cn(
                                "text-[10px] px-1.5 py-0.2 rounded-full font-black",
                                count > 0 
                                    ? (status === 'PRONTO' ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground")
                                    : "bg-muted-foreground/20 text-muted-foreground"
                            )}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Mobile Single-Column Active View */}
            <div className="sm:hidden">
                <KanbanColumn
                    title={statusConfig[mobileTab].title}
                    variant={statusConfig[mobileTab].variant}
                    orders={categorizedOrders[mobileTab]}
                    status={mobileTab}
                    isPending={false}
                />
            </div>

            {/* Tablet / Desktop Horizontal Columns (or Horizontal Swipe on wider screens) */}
            <div className="hidden sm:flex gap-4 overflow-x-auto pb-4">
                {(Object.keys(statusConfig) as OrderStatus[]).map(status => {
                    return (
                        <KanbanColumn
                            key={status}
                            title={statusConfig[status].title}
                            variant={statusConfig[status].variant}
                            orders={categorizedOrders[status]}
                            status={status}
                            isPending={false}
                        />
                    )
                })}
            </div>
        </div>
    );
}

export default function OrderKanban({ pdvId }: { pdvId: string }) {
    const isMobile = useIsMobile();
    const backend = isMobile ? TouchBackend : HTML5Backend;

    return (
        <DndProvider backend={backend} options={{ enableMouseEvents: !isMobile }}>
            <KanbanBoard pdvId={pdvId} />
        </DndProvider>
    );
}
