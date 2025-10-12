import CreateCardForm from '@/components/cashier/CreateCardForm';
import RechargeForm from '@/components/cashier/RechargeForm';

export default async function CashierPage() {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <CreateCardForm />
      <RechargeForm />
    </div>
  );
}
