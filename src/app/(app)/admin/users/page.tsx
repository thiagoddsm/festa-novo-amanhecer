'use client';
import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { UserCog } from 'lucide-react';
import type { UserProfile } from '@/lib/definitions';
import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';


const RoleSelector = ({ user }: { user: UserProfile }) => {
  const [currentRole, setCurrentRole] = useState(user.role);
  const [isUpdating, setIsUpdating] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleRoleChange = async (newRole: 'ADMIN' | 'CAIXA' | 'PDV' | 'VISITANTE') => {
    if (newRole === currentRole) return;
    setIsUpdating(true);
    const userRef = doc(firestore, 'users', user.id);
    try {
      await updateDoc(userRef, { role: newRole });
      setCurrentRole(newRole);
      toast({
        title: 'Sucesso!',
        description: `A função de ${user.name} foi atualizada para ${newRole}.`
      });
    } catch (error) {
      console.error("Failed to update role:", error);
      toast({
        variant: 'destructive',
        title: 'Erro!',
        description: 'Não foi possível atualizar a função do usuário.'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Select onValueChange={handleRoleChange} defaultValue={currentRole} disabled={isUpdating}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Selecione a função" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ADMIN">Administrador</SelectItem>
        <SelectItem value="CAIXA">Caixa</SelectItem>
        <SelectItem value="PDV">Ponto de Venda (PDV)</SelectItem>
        <SelectItem value="VISITANTE">Visitante</SelectItem>
      </SelectContent>
    </Select>
  );
};


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
    header: 'Função',
    cell: ({ row }) => {
       const user = row.original;
       // Prevent role changes for the master admin
       if (user.email === 'thiagoddsm@gmail.com') {
         return <Badge>{user.role}</Badge>;
       }
       return <RoleSelector user={user} />;
    },
  },
   {
    accessorKey: 'pdvId',
    header: 'PDV Associado',
    cell: ({ row }) => row.getValue('pdvId') || 'N/A',
  }
];

function useUsers() {
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;
    const usersCollection = collection(firestore, 'users');
    const unsubscribe = onSnapshot(usersCollection, (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setUsers(allUsers);
    });
    return () => unsubscribe();
  }, [firestore]);

  return users;
}

export default function UsersPage() {
  const users = useUsers();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (users !== null) {
      setIsLoading(false);
    }
  }, [users]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog />
            Gerenciar Usuários
          </CardTitle>
          <CardDescription>
            Visualize e gerencie as funções dos usuários do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <DataTable columns={columns} data={users || []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
