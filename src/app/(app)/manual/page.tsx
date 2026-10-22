'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BookUser, CreditCard, ShoppingCart, QrCode, PlusCircle, Wallet, Search, Package, Users, List, UserCog, BookText } from 'lucide-react';
import Image from 'next/image';

const Step = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string; }) => (
    <div className="flex items-start gap-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground mt-1">
            {icon}
        </div>
        <div>
            <h4 className="font-semibold">{title}</h4>
            <p className="text-muted-foreground">{description}</p>
        </div>
    </div>
);


export default function ManualPage() {

  return (
    <div className="flex flex-col gap-8">
       <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <BookUser size={28} />
                    Manual de Operações - FestaPay
                </CardTitle>
                <CardDescription>
                    Um guia rápido para treinar a equipe de Caixa e Ponto de Venda (PDV).
                </CardDescription>
            </CardHeader>
        </Card>

      <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger className="text-xl font-bold">
            <div className="flex items-center gap-3">
                <CreditCard className="h-6 w-6" />
                Função: Operador de Caixa
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            <h3 className="font-semibold text-lg text-primary">Suas principais responsabilidades são criar e recarregar os cartões dos participantes.</h3>
            <Step 
                icon={<PlusCircle size={16}/>}
                title="1. Criar um Novo Cartão"
                description="Na seção 'Novo Cartão', preencha o nome (opcional), o telefone (obrigatório) e o valor do saldo inicial que o cliente deseja. Clique em 'Criar Novo Cartão' e entregue o comprovante com o QR Code impresso para o cliente."
            />
            <Step 
                icon={<Wallet size={16}/>}
                title="2. Recarregar um Cartão Existente"
                description="Na seção 'Recarregar Saldo', clique no ícone de QR Code para abrir a câmera. Escaneie o cartão do cliente, digite o valor da recarga e clique em 'Recarregar Saldo'. O novo saldo é atualizado na hora."
            />
             <Step 
                icon={<Search size={16}/>}
                title="3. Consultar Saldo"
                description="Na seção 'Consultar Saldo', escaneie o QR Code do cliente para verificar o saldo atual e o status do cartão rapidamente, sem precisar fazer uma recarga."
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-2">
          <AccordionTrigger className="text-xl font-bold">
            <div className="flex items-center gap-3">
                <ShoppingCart className="h-6 w-6" />
                Função: Operador de Ponto de Venda (PDV)
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-6">
            <h3 className="font-semibold text-lg text-primary">Sua função é registrar os pedidos dos clientes e receber o pagamento via QR Code.</h3>
            <Step 
                icon={<Package size={16}/>}
                title="1. Registrar um Pedido"
                description="Na aba 'Venda', clique nos itens do cardápio para adicioná-los ao carrinho. A quantidade e o valor total são atualizados automaticamente. Para adicionar observações (ex: 'sem queijo'), clique no ícone de balão de mensagem ao lado do item no carrinho."
            />
            <Step 
                icon={<QrCode size={16}/>}
                title="2. Realizar o Pagamento"
                description="Com os itens no carrinho, clique no ícone de QR Code no campo 'ID do cliente' para escanear o cartão do participante. Após a leitura, clique em 'Finalizar Venda'. O sistema aprovará a venda se houver saldo suficiente."
            />
            <Step 
                icon={<BookText size={16}/>}
                title="3. Acompanhar e Entregar Pedidos"
                description="Vá para a aba 'Pedidos'. Os novos pedidos aparecerão em 'Preparo'. Quando a comida/bebida ficar pronta, basta clicar no botão verde 'Marcar como Pronto' (no celular ou computador). O sistema avisa o cliente no WhatsApp que o pedido está pronto! Ao entregar, clique em 'Marcar Entregue'."
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
