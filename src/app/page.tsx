import { redirect } from 'next/navigation';
import { checkAuth } from '@/lib/auth';

export default async function HomePage() {
  const { user } = await checkAuth();
  if (user) {
    if (user.role === 'CAIXA') {
      redirect('/cashier');
    } else if (user.role === 'PDV') {
      redirect('/pos');
    }
  }
  redirect('/login');
}
