'use client';
import { useState, useEffect, useMemo, useTransition } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { type Order } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { updateOrderStatus } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { ScrollArea } from '../ui/scroll-area';
import { Loader2, StickyNote } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


type OrderStatus = 'EM_PREPARO' | 'PRONTO' | 'ENTREGUE';

const statusConfig: Record<OrderStatus, { title: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    'EM_PREPARO': { title: 'Em Preparo', variant: 'secondary' },
    'PRONTO': { title: 'Pronto p/ Retirada', variant: 'default' },
    'ENTREGUE': { title: 'Entregue', variant: 'outline' }
};

const KanbanColumn = ({ title, variant, orders, onDrop, onDragOver, onDragStart, status, isPending }: {
    title: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    orders: Order[];
    status: OrderStatus;
    onDrop: (e: React.DragEvent<HTMLDivElement>, status: OrderStatus) => void;
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, order: Order) => void;
    isPending: boolean;
}) => (
    <Card
        className="flex-1 flex flex-col min-w-[280px]"
        onDrop={(e) => onDrop(e, status)}
        onDragOver={onDragOver}
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
                    <OrderCard key={order.id} order={order} onDragStart={onDragStart} />
                ))}
                {orders.length === 0 && <p className="text-sm text-center text-muted-foreground pt-10">Nenhum pedido aqui.</p>}
            </div>
        </ScrollArea>
    </Card>
);

const OrderCard = ({ order, onDragStart }: { order: Order, onDragStart: (e: React.DragEvent<HTMLDivElement>, order: Order) => void }) => (
    <Card
        draggable
        onDragStart={(e) => onDragStart(e, order)}
        className="cursor-grab bg-card"
    >
        <CardHeader className="p-3">
            <CardTitle className="flex justify-between items-start text-base">
                <span className="font-normal">{order.cliente_nome}</span>
                <div className="flex items-center gap-2">
                 {order.observacoes && (
                     <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <StickyNote className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{order.observacoes}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                 )}
                <span className="font-bold text-lg text-primary">{order.order_number}</span>
                </div>
            </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
            <ul className="text-sm text-muted-foreground">
                {order.items.map(item => (
                    <li key={item.id}>{item.quantity}x {item.name}</li>
                ))}
            </ul>
        </CardContent>
        <CardFooter className="p-3 text-xs text-muted-foreground justify-end">
            {format(order.created_at.toDate(), "HH:mm 'de' dd/MM", { locale: ptBR })}
        </CardFooter>
    </Card>
);


export default function OrderKanban({ pdvId }: { pdvId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [orders, setOrders] = useState<Order[] | null>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (!firestore || !pdvId) return;
        
        const ordersRef = collection(firestore, 'orders');
        
        const q = query(ordersRef, 
            where('pdv_id', '==', pdvId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order))
                .filter(order => order.created_at.toDate() >= twentyFourHoursAgo)
                .sort((a,b) => a.created_at.toMillis() - b.created_at.toMillis());

            setOrders(fetchedOrders);
        }, (error) => {
            console.error("Error fetching orders:", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar pedidos', description: 'Não foi possível carregar os pedidos em tempo real.' });
        });

        return () => unsubscribe();
    }, [firestore, pdvId, toast]);

    const categorizedOrders = useMemo(() => {
        const initial: Record<OrderStatus | 'PENDENTE', Order[]> = {
            'PENDENTE': [], 'EM_PREPARO': [], 'PRONTO': [], 'ENTREGUE': []
        };

        if (!orders) return initial;

        return orders.reduce((acc, order) => {
            // Treat PENDENTE as EM_PREPARO for display purposes
            if (order.status === 'PENDENTE' || order.status === 'EM_PREPARO') {
                 acc['EM_PREPARO'].push(order);
            } else if (acc[order.status]) {
                acc[order.status].push(order);
            }
            return acc;
        }, initial);

    }, [orders]);


    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, order: Order) => {
        e.dataTransfer.setData('orderId', order.id);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, newStatus: OrderStatus) => {
        e.preventDefault();
        const orderId = e.dataTransfer.getData('orderId');
        if (!orderId) return;
    
        const originalOrders = orders;
        
        // Optimistic UI update
        setOrders(prevOrders =>
            prevOrders!.map(o =>
                o.id === orderId ? { ...o, status: newStatus } : o
            )
        );
    
        startTransition(() => {
            updateOrderStatus(orderId, newStatus).then(result => {
                if (result.status === 'error') {
                     toast({
                        variant: 'destructive',
                        title: 'Erro ao atualizar pedido',
                        description: result.message
                    });
                    setOrders(originalOrders);
                }
                // On success, the real-time listener will update the state, so no need to do anything here.
            });
        });
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

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
        <div className="flex gap-4 overflow-x-auto pb-4">
            {(Object.keys(statusConfig) as OrderStatus[]).map(status => (
                <KanbanColumn
                    key={status}
                    title={statusConfig[status].title}
                    variant={statusConfig[status].variant}
                    orders={categorizedOrders[status]}
                    status={status}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragStart={handleDragStart}
                    isPending={isPending}
                />
            ))}
        </div>
    );
}
