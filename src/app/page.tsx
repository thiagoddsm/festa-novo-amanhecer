import { redirect } from 'next/navigation';
import { checkAuth } from '@/lib/auth';

export default async function HomePage() {
  const { user } = await checkAuth();
  if (user) {
    if (user.role === 'CAIXA') {
      redirect('/dashboard');
    } else if (user.role === 'PDV') {
      redirect('/pos');
    }
  }
  redirect('/login');
}
