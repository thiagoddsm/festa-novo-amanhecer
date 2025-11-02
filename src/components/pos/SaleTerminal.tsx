'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { processSale } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import type { Pdv, MenuItem } from '@/lib/definitions';
import { CheckCircle2, XCircle, Loader2, ShoppingCart, X, ArrowLeft, Trash2, Pencil, QrCode, MessageSquarePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import EditMenuSheet from './EditMenuSheet';
import QrScannerDialog from '../common/QrScanner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OrderKanban from './OrderKanban';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '../ui/label';

const initialState: {
    status: 'idle' | 'success' | 'error';
    message: string;
    data?: any;
} = {
  status: 'idle',
  message: '',
};

type CartItem = {
    id: string;
    name: string;
    price: number;
    quantity: number;
    observation?: string;
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} className="w-full h-16 text-lg">
      {pending ? <Loader2 className="animate-spin" /> : 'Finalizar Venda'}
    </Button>
  );
}

function ObservationDialog({ item, onSave }: { item: CartItem; onSave: (observation: string) => void }) {
    const [observation, setObservation] = useState(item.observation || '');
    const [isOpen, setIsOpen] = useState(false);

    const handleSave = () => {
        onSave(observation);
        setIsOpen(false);
    }

    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogTrigger asChild>
                <Button variant={item.observation ? "secondary" : "ghost"} size="icon" className="h-7 w-7">
                    <MessageSquarePlus className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Observação para: {item.name}</AlertDialogTitle>
                    <AlertDialogDescription>
                        Adicione instruções especiais para este item. Ex: sem cebola, ponto da carne, etc.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                    <Textarea
                        value={observation}
                        onChange={(e) => setObservation(e.target.value)}
                        placeholder='Digite a observação aqui...'
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSave}>Salvar</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export default function SaleTerminal({ pdv, onGoBack }: { pdv: Pdv, onGoBack: () => void }) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [state, formAction] = useActionState(processSale, initialState);
  const [confirmation, setConfirmation] = useState<{ status: 'success' | 'error'; message: string; details?: string } | null>(null);
  
  const [menuItems, setMenuItems] = useState<MenuItem[] | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [qrCodeId, setQrCodeId] = useState('');
  const [isMenuSheetOpen, setIsMenuSheetOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);


  const formRef = useRef<HTMLFormElement>(null);

  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  useEffect(() => {
    if (!firestore) return;
    const menuCollection = collection(firestore, 'pdvs', pdv.id, 'menuItems');
    const q = query(menuCollection, orderBy('nome', 'asc'));
    const unsubscribe = onSnapshot(q, snapshot => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
      setMenuItems(items);
    });
    return () => unsubscribe();
  }, [firestore, pdv.id]);

  useEffect(() => {
    if (!state.message || state.status === 'idle') return;

    if (state.status === 'error') {
      setConfirmation({ status: 'error', message: 'Venda Recusada', details: state.message });
    } else if (state.status === 'success') {
      setConfirmation({
        status: 'success',
        message: 'Venda Aprovada',
        details: `Novo saldo: ${formatCurrency(state.data.novo_saldo_centavos)}`,
      });
      // Reset form state
      formRef.current?.reset();
      setCart([]);
      setQrCodeId('');
    }

    const timer = setTimeout(() => setConfirmation(null), 3000);
    return () => clearTimeout(timer);
  }, [state]);

  const addToCart = (item: MenuItem) => {
    setCart(currentCart => {
      const existingItem = currentCart.find(cartItem => cartItem.id === item.id && !cartItem.observation);
      if (existingItem) {
        return currentCart.map(cartItem =>
          cartItem.id === item.id && !cartItem.observation ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
        );
      }
      return [...currentCart, { id: item.id, name: item.nome, price: item.preco_centavos, quantity: 1, observation: '' }];
    });
  };

  const removeFromCart = (itemId: string, itemObservation?: string) => {
    setCart(currentCart => {
      const itemIndex = currentCart.findIndex(cartItem => cartItem.id === itemId && cartItem.observation === itemObservation);
      if (itemIndex === -1) return currentCart;
  
      const item = currentCart[itemIndex];
  
      if (item.quantity > 1) {
        // Decrease quantity
        const updatedCart = [...currentCart];
        updatedCart[itemIndex] = { ...item, quantity: item.quantity - 1 };
        return updatedCart;
      } else {
        // Remove item
        return currentCart.filter((_, index) => index !== itemIndex);
      }
    });
  };
  
  const updateItemObservation = (itemId: string, observation: string) => {
      setCart(currentCart => currentCart.map(item => 
        item.id === itemId ? { ...item, observation } : item
      ));
  };

  const clearCart = () => {
    setCart([]);
  }

  const handleScan = (data: string) => {
      setQrCodeId(data);
      setIsScannerOpen(false);
  }

  return (
    <>
     <Tabs defaultValue="venda" className="w-full">
        <div className="flex justify-between items-center mb-4">
            <TabsList>
                <TabsTrigger value="venda">Terminal de Venda</TabsTrigger>
                <TabsTrigger value="acompanhamento">Acompanhamento de Pedidos</TabsTrigger>
            </TabsList>
             <Button variant="ghost" size="sm" onClick={onGoBack}><ArrowLeft className="mr-2 h-4 w-4" /> Trocar PDV</Button>
        </div>
        <TabsContent value="venda">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
                <Card className="lg:col-span-3">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div className='flex items-center gap-2'>
                            <CardTitle>Cardápio</CardTitle>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMenuSheetOpen(true)}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <CardDescription>Vendendo em: <span className='font-semibold text-primary'>{pdv.nome}</span></CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {menuItems === null && Array.from({length: 6}).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                    {menuItems && menuItems.length === 0 && <p className='col-span-full text-center text-muted-foreground'>Nenhum item no cardápio para este PDV.</p>}
                    {menuItems && menuItems.map(item => (
                    <Button key={item.id} variant="outline" className="h-24 flex-col justify-center" onClick={() => addToCart(item)}>
                        <span className="text-base text-center">{item.nome}</span>
                        <span className="text-sm font-bold">{formatCurrency(item.preco_centavos)}</span>
                    </Button>
                    ))}
                </CardContent>
                </Card>

                <Card className="lg:col-span-2 sticky top-4">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle className='flex items-center gap-2'><ShoppingCart /> Carrinho</CardTitle>
                            {cart.length > 0 && 
                                <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive hover:text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Limpar
                                </Button>
                            }
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-60">
                            {cart.length === 0 ? (
                                <p className="text-center text-muted-foreground py-10">Clique em um item do cardápio para adicionar.</p>
                            ): (
                                <div className="space-y-4">
                                {cart.map((item, index) => (
                                    <div key={`${item.id}-${index}`} className="flex justify-between items-center">
                                        <div>
                                            <div className="font-semibold flex items-center gap-2">{item.name} <Badge variant="secondary">{item.quantity}x</Badge></div>
                                            <p className="text-sm text-muted-foreground">{formatCurrency(item.price)}</p>
                                            {item.observation && <p className="text-xs text-blue-500 pl-1">OBS: {item.observation}</p>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                                <ObservationDialog item={item} onSave={(obs) => updateItemObservation(item.id, obs)} />
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeFromCart(item.id, item.observation)}><X className='h-4 w-4'/></Button>
                                        </div>
                                    </div>
                                ))}
                                </div>
                            )}
                        </ScrollArea>
                        <Separator className="my-4"/>
                        <form ref={formRef} action={formAction}>
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        id="qr_code_id"
                                        name="qr_code_id"
                                        placeholder="ID do cliente"
                                        required
                                        value={qrCodeId}
                                        onChange={(e) => setQrCodeId(e.target.value)}
                                        className="h-12 text-center text-lg flex-grow"
                                    />
                                    <Button type="button" variant="outline" size="icon" className="h-12 w-12" onClick={() => setIsScannerOpen(true)}>
                                        <QrCode className="h-6 w-6" />
                                    </Button>
                                </div>
                                <input type="hidden" name="pdv_id" value={pdv.id} />
                                <input type="hidden" name="pdv_nome" value={pdv.nome} />
                                <input type="hidden" name="items" value={JSON.stringify(cart)} />
                                <input type="hidden" name="total_venda" value={total} />
                                <SubmitButton disabled={cart.length === 0 || !qrCodeId} />
                            </div>
                        </form>
                    </CardContent>
                    <CardFooter className='flex justify-between items-center text-2xl font-bold bg-muted/50 p-4 rounded-b-lg'>
                        <span>Total:</span>
                        <span>{formatCurrency(total)}</span>
                    </CardFooter>
                </Card>
            </div>
        </TabsContent>
        <TabsContent value="acompanhamento">
            <OrderKanban pdvId={pdv.id} />
        </TabsContent>
    </Tabs>

      <EditMenuSheet 
        pdv={pdv}
        menuItems={menuItems || []}
        isOpen={isMenuSheetOpen}
        onOpenChange={setIsMenuSheetOpen}
      />

       <QrScannerDialog
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onScan={handleScan}
      />

      {confirmation && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex flex-col items-center justify-center text-white transition-opacity',
            confirmation.status === 'success' ? 'bg-green-500/95' : 'bg-red-500/95'
          )}
        >
          {confirmation.status === 'success' ? (
            <CheckCircle2 className="h-24 w-24" />
          ) : (
            <XCircle className="h-24 w-24" />
          )}
          <h2 className="mt-4 text-4xl font-bold">{confirmation.message}</h2>
          {confirmation.details && <p className="mt-2 text-lg">{confirmation.details}</p>}
        </div>
      )}
    </>
  );
}
