import CreateCardForm from '@/components/cashier/CreateCardForm';
import RechargeForm from '@/components/cashier/RechargeForm';
import { checkAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function CashierPage() {
  const { user } = await checkAuth();
  if (user?.role !== 'CAIXA') {
    redirect('/login');
  }

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <CreateCardForm />
      <RechargeForm />
    </div>
  );
}
