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
import CreateUserDialog from '@/components/admin/CreateUserDialog';

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
      const role = row.getValue('role') as string;
      return <Badge>{role}</Badge>;
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
      <div className="flex justify-between items-center">
        <div/>
        <CreateUserDialog />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog />
            Gerenciar Usuários
          </CardTitle>
          <CardDescription>
            Crie e gerencie os usuários do sistema.
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
