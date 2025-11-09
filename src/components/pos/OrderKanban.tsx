'use client';
import { useState, useEffect, useMemo, useTransition } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, orderBy, writeBatch, Timestamp } from 'firebase/firestore';
import { type Order, type OrderItem } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { updateOrderStatus } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { ScrollArea } from '../ui/scroll-area';
import { Loader2, ArrowRightCircle } from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { formatDateTime } from '@/lib/utils';


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
            ref={drop}
            className={cn(
                "flex-1 flex flex-col min-w-[300px] transition-colors",
                isOver ? 'bg-accent' : ''
            )}
        >
            <CardHeader className="p-4">
                <CardTitle className="flex items-center justify-between">
                    <span className="text-lg">{title}</span>
                    <Badge variant={variant}>{orders.length}</Badge>
                </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-grow bg-muted/50 p-2">
                <div className="space-y-3 p-2 h-full relative">
                    {isPending && <div className="absolute inset-0 bg-background/50 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}
                    {orders.map(order => (
                        <OrderCard key={order.id} order={order} />
                    ))}
                    {orders.length === 0 && <p className="text-sm text-center text-muted-foreground pt-10">Nenhum pedido aqui.</p>}
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
            }
        });
    };
    
    const nextStatus: Record<string, OrderStatus> = {
        'EM_PREPARO': 'PRONTO',
        'PRONTO': 'ENTREGUE',
    }
    const next = nextStatus[order.status];

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
    
    return (
    <Card
        ref={drag}
        className={cn(
            "cursor-grab bg-card active:cursor-grabbing",
            isDragging ? 'opacity-50' : 'opacity-100',
            isPending ? 'animate-pulse' : ''
        )}
    >
        <CardHeader className="p-3">
            <CardTitle className="flex justify-between items-start text-base">
                <span className="font-normal">{order.cliente_nome}</span>
                <span className="font-bold text-lg text-primary">{order.order_number}</span>
            </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
            <ul className="text-sm space-y-1">
                {order.items.map((item: OrderItem, index: number) => (
                    <li key={`${item.id}-${index}`}>
                        <span className='text-muted-foreground'>{item.quantity}x</span> {item.name}
                        {item.observation && (
                            <p className="text-xs text-blue-600 pl-4 max-w-full break-words">&hookrightarrow; {item.observation}</p>
                        )}
                    </li>
                ))}
            </ul>
        </CardContent>
        <CardFooter className="p-3 text-xs text-muted-foreground flex justify-between items-center">
            <span>{formatDateTime(formatTimestamp(order.created_at))}</span>
            {next && (
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleStatusUpdate(next)}
                    disabled={isPending}
                    className="h-auto px-2 py-1 text-xs"
                >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <>{statusConfig[next].title.split(' ')[0]} <ArrowRightCircle className="ml-2 h-4 w-4"/></>}
                </Button>
            )}
        </CardFooter>
    </Card>
)};


function KanbanBoard({ pdvId }: { pdvId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [orders, setOrders] = useState<Order[] | null>(null);

    useEffect(() => {
        if (!firestore || !pdvId) return;
        
        const ordersRef = collection(firestore, 'orders');
        
        // Listen for orders from the last 24 hours
        const twentyFourHoursAgo = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
        const q = query(ordersRef, 
            where('pdv_id', '==', pdvId),
            where('created_at', '>=', twentyFourHoursAgo)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() } as Order))
              .sort((a,b) => a.created_at.toMillis() - b.created_at.toMillis());

            setOrders(fetchedOrders);
        }, (error) => {
            console.error("Error fetching orders:", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar pedidos', description: 'Não foi possível carregar os pedidos em tempo real.' });
        });

        return () => unsubscribe();
    }, [firestore, pdvId, toast]);
    
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
            if (order.status === 'CANCELADO' || order.status === 'ARQUIVADO') return acc;
            
            // Treat PENDENTE as EM_PREPARO for display purposes
            if (order.status === 'PENDENTE' || order.status === 'EM_PREPARO') {
                 acc['EM_PREPARO'].push(order);
            } else if (acc[order.status]) {
                acc[order.status].push(order);
            }
            return acc;
        }, initial);

    }, [orders]);


    if (orders === null) {
        return (
            <div className="flex gap-4 overflow-x-auto p-2">
                {Object.keys(statusConfig).map(status => (
                    <Card key={status} className="flex-1 flex flex-col min-w-[300px]">
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
        <div className="flex gap-4 overflow-x-auto pb-4">
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
