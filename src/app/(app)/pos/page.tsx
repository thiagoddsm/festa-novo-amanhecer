import SaleForm from "@/components/pos/SaleForm";
import { getPdvById, getPdvs } from "@/lib/data";
import { checkAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Pdv } from "@/lib/definitions";

export default async function PosPage() {
  const { user } = await checkAuth();
  if (!user) {
    redirect('/login');
  }

  let pdvs: Pdv[] = [];
  if (user.role === 'CAIXA') {
    pdvs = getPdvs();
  } else if (user.role === 'PDV' && user.pdvId) {
    const pdv = getPdvById(user.pdvId);
    if (pdv) {
      pdvs = [pdv];
    }
  }

  if (pdvs.length === 0) {
    // Handle case where PDV user has no valid PDV
    return <div>Ponto de Venda não configurado corretamente.</div>
  }

  return (
    <div className="mx-auto max-w-md">
      <SaleForm pdvs={pdvs} selectedPdvId={user.pdvId} />
    </div>
  );
}
