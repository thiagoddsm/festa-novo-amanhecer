'use client';
import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { UserCog } from 'lucide-react';
import type { UserProfile, Pdv } from '@/lib/definitions';
import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const RoleAndPdvManager = ({ user, pdvs }: { user: UserProfile; pdvs: Pdv[] }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleUpdate = async (field: 'role' | 'pdvId', value: string | null) => {
    setIsUpdating(true);
    const userRef = doc(firestore, 'users', user.id);
    let updateData: any = {};

    if (field === 'role') {
        updateData.role = value;
        // If role is changed from PDV to something else, clear the pdvId
        if (user.role === 'PDV' && value !== 'PDV') {
            updateData.pdvId = null;
        }
    } else if (field === 'pdvId') {
        updateData.pdvId = value;
    }
    
    try {
      await updateDoc(userRef, updateData);
      toast({
        title: 'Sucesso!',
        description: `Os dados de ${user.name} foram atualizados.`
      });
    } catch (error) {
      console.error("Failed to update user:", error);
      toast({
        variant: 'destructive',
        title: 'Erro!',
        description: 'Não foi possível atualizar os dados do usuário.'
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Prevent role changes for the master admin
  if (user.email === 'thiagoddsm@gmail.com') {
    return <Badge>{user.role}</Badge>;
  }

  return (
    <div className="flex flex-col gap-2">
       <Select onValueChange={(value) => handleUpdate('role', value)} defaultValue={user.role} disabled={isUpdating}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione a função" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ADMIN">Administrador</SelectItem>
          <SelectItem value="CAIXA">Caixa</SelectItem>
          <SelectItem value="PDV">Ponto de Venda</SelectItem>
          <SelectItem value="VISITANTE">Visitante</SelectItem>
        </SelectContent>
      </Select>
      
      {user.role === 'PDV' && (
        <Select onValueChange={(value) => handleUpdate('pdvId', value)} defaultValue={user.pdvId} disabled={isUpdating || pdvs.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um PDV" />
          </SelectTrigger>
          <SelectContent>
            {pdvs.map(pdv => (
              <SelectItem key={pdv.id} value={pdv.id}>{pdv.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};


function useUsersAndPdvs() {
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [pdvs, setPdvs] = useState<Pdv[] | null>(null);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;
    
    const usersUnsubscribe = onSnapshot(collection(firestore, 'users'), (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setUsers(allUsers);
    });

    const pdvsUnsubscribe = onSnapshot(collection(firestore, 'pdvs'), (snapshot) => {
        const allPdvs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pdv));
        setPdvs(allPdvs);
    });

    return () => {
        usersUnsubscribe();
        pdvsUnsubscribe();
    };
  }, [firestore]);

  return { users, pdvs };
}

export default function UsersPage() {
  const { users, pdvs } = useUsersAndPdvs();
  const [isLoading, setIsLoading] = useState(true);

  const pdvNameMap = new Map(pdvs?.map(pdv => [pdv.id, pdv.nome]));

  const columns: ColumnDef<UserProfile>[] = [
    {
      accessorKey: 'name',
      header: 'Nome',
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'role',
      header: 'Função e PDV Associado',
      cell: ({ row }) => {
         const user = row.original;
         return <RoleAndPdvManager user={user} pdvs={pdvs || []} />;
      },
       filterFn: (row, id, value) => {
            return value.includes(row.getValue(id))
       },
    },
  ];

  useEffect(() => {
    if (users !== null && pdvs !== null) {
      setIsLoading(false);
    }
  }, [users, pdvs]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog />
            Gerenciar Usuários
          </CardTitle>
          <CardDescription>
            Visualize e gerencie as funções e permissões dos usuários do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <DataTable
              columns={columns}
              data={users || []}
              filterColumns={[
                { columnId: 'name', placeholder: 'Buscar por nome...' },
                { columnId: 'email', placeholder: 'Buscar por email...' },
                {
                  columnId: 'role',
                  placeholder: 'Filtrar por função...',
                  options: [
                    { value: 'ADMIN', label: 'Administrador' },
                    { value: 'CAIXA', label: 'Caixa' },
                    { value: 'PDV', label: 'Ponto de Venda' },
                    { value: 'VISITANTE', label: 'Visitante' },
                  ],
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
