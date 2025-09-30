'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { login } from '@/lib/actions';
import type { Pdv } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const initialState = {
  status: 'success' as 'success' | 'error',
  message: '',
};

function LoginButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : 'Entrar'}
    </Button>
  );
}

export function LoginForm({ pdvs }: { pdvs: Pdv[] }) {
  const [state, formAction] = useActionState(login, initialState);
  const { toast } = useToast();
  const [role, setRole] = useState('CAIXA');

  useEffect(() => {
    if (state?.status === 'error' && state.message) {
      toast({
        variant: 'destructive',
        title: 'Erro de Login',
        description: state.message,
      });
    }
  }, [state, toast]);

  return (
    <Tabs value={role} onValueChange={setRole} defaultValue="CAIXA" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="CAIXA">Caixa</TabsTrigger>
        <TabsTrigger value="PDV">Ponto de Venda</TabsTrigger>
      </TabsList>
      <form action={formAction}>
        <input type="hidden" name="role" value={role} />
        <TabsContent value="CAIXA">
          <Card>
            <CardHeader>
              <CardTitle>Acesso do Caixa</CardTitle>
              <CardDescription>Use a senha para acessar o sistema completo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password-caixa">Senha</Label>
                <Input id="password-caixa" name="password" type="password" placeholder="••••••••" required />
              </div>
              <LoginButton />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="PDV">
          <Card>
            <CardHeader>
              <CardTitle>Acesso do PDV</CardTitle>
              <CardDescription>Selecione a barraca e digite a senha.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pdvId">Ponto de Venda</Label>
                <Select name="pdvId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a barraca" />
                  </SelectTrigger>
                  <SelectContent>
                    {pdvs.map((pdv) => (
                      <SelectItem key={pdv.id} value={String(pdv.id)}>{pdv.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-pdv">Senha</Label>
                <Input id="password-pdv" name="password" type="password" placeholder="••••••••" required />
              </div>
              <LoginButton />
            </CardContent>
          </Card>
        </TabsContent>
      </form>
    </Tabs>
  );
}
