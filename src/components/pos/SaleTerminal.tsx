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
import type { Pdv, MenuItem, Card as CardType } from '@/lib/definitions';
import { CheckCircle2, XCircle, Loader2, ShoppingCart, X, ArrowLeft, Trash2, Pencil, QrCode, MessageSquarePlus, MessageSquare, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, orderBy, doc, getDocs, where, limit, getDoc } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import EditMenuSheet from './EditMenuSheet';
import QrScannerDialog from '../common/QrScannerDialog';
import PdvWhatsappDialog from './PdvWhatsappDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OrderKanban from './OrderKanban';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '../ui/label';
import { useTenant } from '@/hooks/use-tenant-context';
import { Checkbox } from '../ui/checkbox';
import { useAuth } from '@/hooks/use-auth-context';

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
    ingredientes?: string[];
    observation?: string;
}

function SubmitButton({ 
  disabled, 
  hasItems, 
  cardData, 
  total 
}: { 
  disabled: boolean; 
  hasItems: boolean; 
  cardData: CardType | null; 
  total: number;
}) {
  const { pending } = useFormStatus();
  const hasInsufficientBalance = cardData && cardData.saldo_centavos < total;

  return (
    <Button 
      type="submit" 
      disabled={pending || disabled || !!hasInsufficientBalance} 
      className={`w-full h-14 text-base md:h-16 md:text-lg font-bold rounded-xl transition-all ${
        !disabled && !hasInsufficientBalance
          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md' 
          : ''
      }`}
    >
      {pending ? (
        <Loader2 className="animate-spin h-6 w-6" />
      ) : !hasItems ? (
        'Adicione itens ao carrinho'
      ) : !cardData ? (
        'Identifique o cartão'
      ) : hasInsufficientBalance ? (
        'Saldo insuficiente no cartão'
      ) : (
        `Finalizar Venda • ${formatCurrency(total)}`
      )}
    </Button>
  );
}

function ObservationDialog({ item, onSave }: { item: CartItem; onSave: (observation: string) => void }) {
    const [freeText, setFreeText] = useState('');
    const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);

     useEffect(() => {
        if (isOpen) {
            const obs = item.observation || '';
            const freeTextMatch = obs.match(/OBS: (.*)/);
            setFreeText(freeTextMatch ? freeTextMatch[1] : '');

            const removedMatch = obs.match(/SEM: \[(.*?)\]/);
            const currentRemoved = removedMatch ? removedMatch[1].split(',').map(i => i.trim()) : [];
            setRemovedIngredients(currentRemoved);
        }
    }, [isOpen, item.observation]);

    const handleSave = () => {
        let finalObservation = '';
        if (removedIngredients.length > 0) {
            finalObservation += `SEM: [${removedIngredients.join(', ')}]`;
        }
        if (freeText.trim()) {
            finalObservation += `${finalObservation ? ' | ' : ''}OBS: ${freeText.trim()}`;
        }
        onSave(finalObservation);
        setIsOpen(false);
    }
    
    const handleCheckboxChange = (ingredient: string, checked: boolean) => {
        setRemovedIngredients(prev => 
            checked ? [...prev, ingredient] : prev.filter(i => i !== ingredient)
        );
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
                        Marque os ingredientes para REMOVER ou adicione instruções.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4 space-y-4">
                    {item.ingredientes && item.ingredientes.length > 0 && (
                        <div className="space-y-2">
                             <Label>Remover Ingredientes:</Label>
                             <div className="flex flex-wrap gap-2">
                                {item.ingredientes.map(ing => (
                                    <div key={ing} className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`check-${item.id}-${ing}`} 
                                            checked={removedIngredients.includes(ing)}
                                            onCheckedChange={(checked) => handleCheckboxChange(ing, !!checked)}
                                        />
                                        <label
                                            htmlFor={`check-${item.id}-${ing}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                           {ing}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <Label htmlFor="free-text-obs">Outras Observações:</Label>
                        <Textarea
                            id="free-text-obs"
                            value={freeText}
                            onChange={(e) => setFreeText(e.target.value)}
                            placeholder='Ex: Bem passado, sem pimenta...'
                        />
                    </div>
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
  const { user } = useAuth();
  const { currentTenant, currentEvent } = useTenant();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [livePdv, setLivePdv] = useState<Pdv>(pdv);
  const [state, formAction] = useActionState(processSale, initialState);
  const [confirmation, setConfirmation] = useState<{ status: 'success' | 'error'; message: string; details?: string } | null>(null);
  
  const [menuItems, setMenuItems] = useState<MenuItem[] | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [qrCodeId, setQrCodeId] = useState('');
  const [cardData, setCardData] = useState<CardType | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [isValidatingCard, setIsValidatingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [isMenuSheetOpen, setIsMenuSheetOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isWhatsappDialogOpen, setIsWhatsappDialogOpen] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  // Sync PDV data in real-time (especially WhatsApp status)
  useEffect(() => {
    if (!firestore) return;
    const unsubscribe = onSnapshot(doc(firestore, 'pdvs', pdv.id), snap => {
      if (snap.exists()) {
        setLivePdv({ id: snap.id, ...snap.data() } as Pdv);
      }
    });
    return () => unsubscribe();
  }, [firestore, pdv.id]);

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
      setCardData(null);
      setManualInput('');
      setCardError(null);
    }

    const timer = setTimeout(() => setConfirmation(null), 3000);
    return () => clearTimeout(timer);
  }, [state]);

  const addToCart = (item: MenuItem) => {
    setCart(currentCart => {
      const existingItemIndex = currentCart.findIndex(cartItem => cartItem.id === item.id && !cartItem.observation);
      if (existingItemIndex > -1) {
          const newCart = [...currentCart];
          newCart[existingItemIndex].quantity += 1;
          return newCart;
      }
      return [...currentCart, { id: item.id, name: item.nome, price: item.preco_centavos, quantity: 1, ingredientes: item.ingredientes }];
    });
  };

  const removeFromCart = (uniqueId: string) => {
    setCart(currentCart => {
        const itemIndex = currentCart.findIndex(cartItem => `${cartItem.id}-${cartItem.observation}` === uniqueId);
      if (itemIndex === -1) return currentCart;
  
      const item = currentCart[itemIndex];
  
      if (item.quantity > 1) {
        const updatedCart = [...currentCart];
        updatedCart[itemIndex] = { ...item, quantity: item.quantity - 1 };
        return updatedCart;
      } else {
        return currentCart.filter((_, index) => index !== itemIndex);
      }
    });
  };
  
  const updateItemObservation = (uniqueId: string, observation: string) => {
      setCart(currentCart => {
        const itemIndex = currentCart.findIndex(item => `${item.id}-${item.observation}` === uniqueId);
        if (itemIndex === -1) return currentCart;

        const newCart = [...currentCart];
        const item = newCart[itemIndex];

        // Check if another item with the same ID and new observation already exists
        const existingItemWithNewObsIndex = newCart.findIndex((cartItem, index) => 
            index !== itemIndex &&
            cartItem.id === item.id && 
            cartItem.observation === observation
        );

        if (existingItemWithNewObsIndex > -1) {
            // Merge quantities
            newCart[existingItemWithNewObsIndex].quantity += item.quantity;
            // Remove the original item
            return newCart.filter((_, index) => index !== itemIndex);
        } else {
            // Just update the observation
             newCart[itemIndex] = { ...item, observation };
             return newCart;
        }
      });
  };

  const clearCart = () => {
    setCart([]);
  };

  const validateAndSetCard = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;
    if (!firestore) return;

    setIsValidatingCard(true);
    setCardError(null);

    try {
      const cardsRef = collection(firestore, 'cards');
      
      // 1. Search by qr_code_id
      const q = query(cardsRef, where('qr_code_id', '==', code), limit(1));
      const snap = await getDocs(q);

      let foundCard: CardType | null = null;
      if (!snap.empty) {
        foundCard = { id: snap.docs[0].id, ...snap.docs[0].data() } as CardType;
      } else {
        // 2. Fallback: search by document ID directly
        try {
          const docSnap = await getDoc(doc(firestore, 'cards', code));
          if (docSnap.exists()) {
            foundCard = { id: docSnap.id, ...docSnap.data() } as CardType;
          }
        } catch (e) {
          // ignore doc id lookup error
        }
      }

      if (!foundCard) {
        setCardError('Cartão não encontrado neste evento.');
        setCardData(null);
        setQrCodeId('');
        toast({
          variant: 'destructive',
          title: 'Cartão não encontrado',
          description: `Nenhum cartão cadastrado com o código "${code}".`,
        });
        return;
      }

      // 3. Validate tenant
      if (currentTenant && foundCard.tenant_id && foundCard.tenant_id !== currentTenant.id) {
        setCardError('Este cartão pertence a outra organização.');
        setCardData(null);
        setQrCodeId('');
        toast({
          variant: 'destructive',
          title: 'Organização Incompatível',
          description: 'Este cartão pertence a outra organização.',
        });
        return;
      }

      // 4. Validate event
      if (currentEvent && foundCard.event_id && foundCard.event_id !== currentEvent.id) {
        setCardError('Este cartão pertence a outro evento.');
        setCardData(null);
        setQrCodeId('');
        toast({
          variant: 'destructive',
          title: 'Evento Incompatível',
          description: 'Este cartão pertence a outro evento.',
        });
        return;
      }

      // 5. Validate status
      if (foundCard.status !== 'ATIVO') {
        setCardError(`Cartão com status ${foundCard.status.toLowerCase()}.`);
        setCardData(null);
        setQrCodeId('');
        toast({
          variant: 'destructive',
          title: 'Cartão Inválido',
          description: `O cartão está ${foundCard.status.toLowerCase()}.`,
        });
        return;
      }

      // Card is verified and active!
      setCardData(foundCard);
      setQrCodeId(foundCard.qr_code_id);
      setManualInput('');
      setCardError(null);
      toast({
        title: 'Cartão Identificado!',
        description: `${foundCard.nome_cliente || 'Cliente'} • Saldo: ${formatCurrency(foundCard.saldo_centavos)}`,
      });
    } catch (err: any) {
      console.error('Erro ao consultar cartão:', err);
      setCardError('Erro ao consultar cartão.');
    } finally {
      setIsValidatingCard(false);
    }
  };

  const handleScan = (data: string) => {
    setIsScannerOpen(false);
    validateAndSetCard(data);
  };

  return (
    <>
      <Tabs defaultValue="venda" className="w-full">
        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-4 max-w-full overflow-hidden">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <TabsList className="h-9 shrink-0">
                  <TabsTrigger value="venda" className="text-xs sm:text-sm px-2.5 sm:px-3">Venda</TabsTrigger>
                  <TabsTrigger value="acompanhamento" className="text-xs sm:text-sm px-2.5 sm:px-3">Pedidos</TabsTrigger>
              </TabsList>

              {/* WhatsApp Connection Button */}
              {livePdv.whatsapp?.status === 'CONNECTED' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-300 bg-green-50 text-green-700 hover:bg-green-100 text-xs h-9 px-2 sm:px-3 gap-1.5 shadow-xs shrink-0"
                  onClick={() => setIsWhatsappDialogOpen(true)}
                >
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">WhatsApp Conectado</span>
                  <span className="sm:hidden text-[11px]">WhatsApp</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-300/80 bg-amber-50/60 text-amber-800 hover:bg-amber-100 text-xs h-9 px-2 sm:px-3 gap-1.5 shadow-xs shrink-0"
                  onClick={() => setIsWhatsappDialogOpen(true)}
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Conectar WhatsApp</span>
                  <span className="sm:hidden text-[11px]">WhatsApp</span>
                </Button>
              )}
            </div>

            <Button variant="ghost" size="sm" onClick={onGoBack} className="h-9 px-2 sm:px-3 text-xs shrink-0 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              <span className="hidden xs:inline">Trocar PDV</span>
            </Button>
        </div>
        <TabsContent value="venda" className="pb-24 lg:pb-0">
            <div className="flex flex-col lg:flex-row gap-2 md:gap-4 items-start">
                <Card className="flex-1 w-full lg:w-3/5 shadow-sm border-border/60">
                <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
                    <div className="flex justify-between items-center">
                        <div className='flex items-center gap-2'>
                            <CardTitle className="text-lg sm:text-xl font-bold">Cardápio</CardTitle>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setIsMenuSheetOpen(true)}>
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                    <CardDescription className="text-xs sm:text-sm">Vendendo em: <span className='font-semibold text-primary'>{pdv.nome}</span></CardDescription>
                </CardHeader>
                <CardContent className="p-2 sm:p-4 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    {menuItems === null && Array.from({length: 6}).map((_, i) => <Skeleton key={i} className="h-20 sm:h-24 w-full rounded-xl" />)}
                    {menuItems && menuItems.length === 0 && (
                      <div className='col-span-full py-12 text-center text-muted-foreground bg-muted/30 rounded-xl border border-dashed text-xs sm:text-sm'>
                        Nenhum item no cardápio para este PDV.
                      </div>
                    )}
                    {menuItems && menuItems.map(item => (
                    <Button 
                      key={item.id} 
                      variant="outline" 
                      className="min-h-[82px] sm:h-24 flex-col justify-between items-stretch p-2 sm:p-3 text-left hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 group relative overflow-hidden rounded-xl border-border/80 shadow-xs" 
                      onClick={() => addToCart(item)}
                    >
                        <span className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">{item.nome}</span>
                        <div className="flex items-center justify-between mt-auto pt-1 gap-1">
                          <span className="text-xs sm:text-base font-bold text-primary truncate">{formatCurrency(item.preco_centavos)}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">+</span>
                        </div>
                    </Button>
                    ))}
                </CardContent>
                </Card>

                <Card className="w-full lg:w-2/5 shadow-sm border-border/60" id="carrinho-card">
                    <CardHeader className="p-3 sm:p-4 md:p-6 pb-2">
                        <div className="flex justify-between items-center">
                            <CardTitle className='flex items-center gap-2 text-base sm:text-lg'><ShoppingCart className="w-4 h-4" /> Carrinho</CardTitle>
                            {cart.length > 0 && 
                                <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive hover:text-destructive h-7 px-2 text-xs">
                                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Limpar
                                </Button>
                            }
                        </div>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                        <ScrollArea className="max-h-48 sm:max-h-60">
                            {cart.length === 0 ? (
                                <p className="text-center text-muted-foreground py-4 text-xs sm:text-sm">Toque em um item do cardápio para adicionar.</p>
                            ): (
                                <div className="space-y-3">
                                {cart.map((item) => {
                                    const uniqueId = `${item.id}-${item.observation}`;
                                    return (
                                        <div key={uniqueId} className="flex justify-between items-center">
                                            <div>
                                                <div className="font-semibold flex items-center gap-2">{item.name} <Badge variant="secondary">{item.quantity}x</Badge></div>
                                                <p className="text-sm text-muted-foreground">{formatCurrency(item.price)}</p>
                                                {item.observation && <p className="text-xs text-blue-500 pl-1 max-w-xs truncate" title={item.observation}>OBS: {item.observation}</p>}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                    <ObservationDialog item={item} onSave={(obs) => updateItemObservation(uniqueId, obs)} />
                                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeFromCart(uniqueId)}><X className='h-4 w-4'/></Button>
                                            </div>
                                        </div>
                                    )
                                })}
                                </div>
                            )}
                        </ScrollArea>
                        <Separator className="my-2 md:my-4"/>
                        <form ref={formRef} action={formAction}>
                            <div className="space-y-3">
                                {!cardData ? (
                                    <div className="space-y-2.5">
                                        <Button 
                                            type="button" 
                                            onClick={() => setIsScannerOpen(true)}
                                            className="w-full h-14 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2.5 rounded-xl shadow-xs"
                                        >
                                            <Camera className="h-5 w-5" />
                                            <span>Ler Cartão (Câmera)</span>
                                        </Button>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Ou digite o código do cartão..."
                                                value={manualInput}
                                                onChange={(e) => {
                                                    setManualInput(e.target.value);
                                                    setCardError(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        validateAndSetCard(manualInput);
                                                    }
                                                }}
                                                className="h-11 text-center text-xs sm:text-sm font-mono flex-grow rounded-lg"
                                            />
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                disabled={!manualInput.trim() || isValidatingCard}
                                                onClick={() => validateAndSetCard(manualInput)}
                                                className="h-11 px-3 font-semibold shrink-0"
                                            >
                                                {isValidatingCard ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
                                            </Button>
                                        </div>
                                        {cardError && (
                                            <p className="text-xs text-destructive text-center font-medium bg-destructive/10 p-2 rounded-lg">
                                                {cardError}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-3 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                                                    ✓
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-foreground">
                                                        {cardData.nome_cliente || 'Cartão Cadastrado'}
                                                    </p>
                                                    <p className="font-mono text-[11px] text-muted-foreground">{cardData.qr_code_id}</p>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setCardData(null);
                                                    setQrCodeId('');
                                                    setManualInput('');
                                                    setCardError(null);
                                                }}
                                                className="text-xs text-muted-foreground hover:text-destructive h-7 px-2.5 rounded-lg"
                                            >
                                                Trocar
                                            </Button>
                                        </div>
                                        
                                        <div className="flex items-center justify-between pt-1.5 border-t border-emerald-500/20 text-xs">
                                            <span className="text-muted-foreground">Saldo disponível:</span>
                                            <span className={`font-bold text-sm ${cardData.saldo_centavos < total ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                {formatCurrency(cardData.saldo_centavos)}
                                            </span>
                                        </div>

                                        {cardData.saldo_centavos < total && (
                                            <p className="text-[11px] font-semibold text-destructive pt-0.5 text-center bg-destructive/10 p-1.5 rounded-md">
                                                ⚠️ Saldo insuficiente! Faltam {formatCurrency(total - cardData.saldo_centavos)}.
                                            </p>
                                        )}
                                    </div>
                                )}
                                <input type="hidden" name="qr_code_id" value={cardData?.qr_code_id || ''} />
                                <input type="hidden" name="pdv_id" value={pdv.id} />
                                <input type="hidden" name="pdv_nome" value={pdv.nome} />
                                <input type="hidden" name="items" value={JSON.stringify(cart)} />
                                <input type="hidden" name="total_venda" value={total} />
                                <input type="hidden" name="usuario_responsavel" value={user?.name || 'Sistema'} />
                                <input type="hidden" name="tenant_id" value={currentTenant?.id || ''} />
                                <input type="hidden" name="event_id" value={currentEvent?.id || ''} />
                                <SubmitButton 
                                    disabled={cart.length === 0 || !cardData} 
                                    hasItems={cart.length > 0}
                                    cardData={cardData}
                                    total={total}
                                />
                            </div>
                        </form>
                    </CardContent>
                    <CardFooter className='flex justify-between items-center text-xl md:text-2xl font-bold bg-muted/50 p-3 md:p-4 rounded-b-lg'>
                        <span>Total:</span>
                        <span>{formatCurrency(total)}</span>
                    </CardFooter>
                </Card>
            </div>

            {/* Floating Quick Action Bar for Mobile */}
            {cart.length > 0 && (
              <div className="lg:hidden fixed bottom-0 inset-x-0 p-3 bg-card/95 backdrop-blur-md border-t border-border shadow-2xl z-40 flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium truncate">
                    {cart.reduce((a, b) => a + b.quantity, 0)} {cart.reduce((a, b) => a + b.quantity, 0) === 1 ? 'item' : 'itens'} no carrinho
                  </p>
                  <p className="text-lg font-black text-foreground leading-tight">
                    {formatCurrency(total)}
                  </p>
                </div>
                <Button 
                  onClick={() => {
                    const el = document.getElementById('carrinho-card');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11 px-4 rounded-xl shadow-md flex items-center gap-2 shrink-0"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Cobrar / Cartão</span>
                </Button>
              </div>
            )}
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

      <PdvWhatsappDialog
        pdv={livePdv}
        open={isWhatsappDialogOpen}
        onOpenChange={setIsWhatsappDialogOpen}
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
