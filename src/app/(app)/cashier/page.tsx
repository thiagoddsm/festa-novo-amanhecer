'use client';
import CreateCardForm from '@/components/cashier/CreateCardForm';
import RechargeForm from '@/components/cashier/RechargeForm';
import CheckBalanceForm from '@/components/cashier/CheckBalanceForm';
import TransferBalanceForm from '@/components/cashier/TransferBalanceForm';

export default function CashierPage() {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
      <CreateCardForm />
      <RechargeForm />
      <CheckBalanceForm />
      <TransferBalanceForm />
    </div>
  );
}
