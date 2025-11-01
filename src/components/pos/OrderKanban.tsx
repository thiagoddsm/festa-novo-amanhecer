'use client';
import { useState, useEffect, useMemo } from 'react';
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

type OrderStatus = 'PENDENTE' | 'EM_PREPARO' | 'PRONTO' | 'ENTREGUE';

const statusConfig: Record<OrderStatus, { title: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    'PENDENTE': { title: 'Pendente', variant: 'destructive' },
    'EM_PREPARO': { title: 'Em Preparo', variant: 'secondary' },
    'PRONTO': { title: 'Pronto p/ Retirada', variant: 'default' },
    'ENTREGUE': { title: 'Entregue', variant: 'outline' }
};

const KanbanColumn = ({ title, variant, orders, onDrop, onDragOver, onDragStart, status }: {
    title: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    orders: Order[];
    status: OrderStatus;
    onDrop: (e: React.DragEvent<HTMLDivElement>, status: OrderStatus) => void;
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, order: Order) => void;
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
            <div className="space-y-3 p-2 h-full">
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
            <CardTitle className="flex justify-between items-center text-base">
                {order.cliente_nome}
                <span className="font-bold text-lg text-primary">{order.order_number}</span>
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

    useEffect(() => {
        if (!firestore || !pdvId) return;
        
        const ordersRef = collection(firestore, 'orders');
        // Simplified query to avoid composite index requirement.
        // We will filter by date and status on the client-side.
        const q = query(
            ordersRef,
            where('pdv_id', '==', pdvId),
            orderBy('created_at', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
            
            // Filter out old and delivered orders on the client side
            const activeOrders = fetchedOrders.filter(order => 
                order.status !== 'ENTREGUE' &&
                order.created_at.toDate() >= twentyFourHoursAgo
            ).sort((a,b) => a.created_at.toMillis() - b.created_at.toMillis()); // re-sort ascending after filtering

            setOrders(activeOrders);
        }, (error) => {
            console.error("Error fetching orders:", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar pedidos', description: 'Não foi possível carregar os pedidos em tempo real.' });
        });

        return () => unsubscribe();
    }, [firestore, pdvId, toast]);

    const categorizedOrders = useMemo(() => {
        const initial: Record<OrderStatus, Order[]> = {
            'PENDENTE': [], 'EM_PREPARO': [], 'PRONTO': [], 'ENTREGUE': []
        };
        if (!orders) return initial;
        return orders.reduce((acc, order) => {
            if (order.status !== 'ENTREGUE') { // Ensure we don't process delivered orders for the columns
               acc[order.status].push(order);
            }
            return acc;
        }, initial);
    }, [orders]);


    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, order: Order) => {
        e.dataTransfer.setData('orderId', order.id);
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>, newStatus: OrderStatus) => {
        e.preventDefault();
        const orderId = e.dataTransfer.getData('orderId');
        if (!orderId) return;

        // Optimistic update
        const originalOrders = orders;
        setOrders(prevOrders =>
            prevOrders!.map(o =>
                o.id === orderId ? { ...o, status: newStatus } : o
            )
        );

        const result = await updateOrderStatus(orderId, newStatus);
        if (result.status === 'error') {
            toast({
                variant: 'destructive',
                title: 'Erro ao atualizar pedido',
                description: result.message
            });
            setOrders(originalOrders); // Revert on error
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); // Necessary to allow drop
    };

    if (orders === null) {
        return (
            <div className="flex gap-4 overflow-x-auto p-2">
                {Object.keys(statusConfig).slice(0, -1).map(status => (
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
            {(Object.keys(statusConfig) as OrderStatus[]).filter(s => s !== 'ENTREGUE').map(status => (
                <KanbanColumn
                    key={status}
                    title={statusConfig[status].title}
                    variant={statusConfig[status].variant}
                    orders={categorizedOrders[status]}
                    status={status}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragStart={handleDragStart}
                />
            ))}
        </div>
    );
}
