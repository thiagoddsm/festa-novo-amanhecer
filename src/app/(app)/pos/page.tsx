'use client';

import SaleForm from "@/components/pos/SaleForm";
import { getPdvById, getPdvs } from "@/lib/data";
import { useUser } from "@/firebase"; // Using client-side user
import type { Pdv } from "@/lib/definitions";
import { useState, useEffect } from "react";

export default function PosPage() {
  const { user, loading } = useUser();
  const [pdvs, setPdvs] = useState<Pdv[]>([]);
  
  // This would come from the user's profile in a real app
  const userRole = 'CAIXA'; // or 'PDV'
  const userPdvId = 4; // Example PDV ID for a PDV user

  useEffect(() => {
    // In a real app, you would fetch the user's role from your database
    // based on the authenticated user.
    // For now, we'll simulate it.
    let availablePdvs: Pdv[] = [];
    if (userRole === 'CAIXA') {
      availablePdvs = getPdvs();
    } else if (userRole === 'PDV' && userPdvId) {
      const pdv = getPdvById(userPdvId);
      if (pdv) {
        availablePdvs = [pdv];
      }
    }
    setPdvs(availablePdvs);
  }, [user]);
  

  if (loading) {
    return <div>Carregando...</div>
  }

  if (pdvs.length === 0 && !loading) {
    return <div>Ponto de Venda não configurado corretamente ou sem permissão.</div>
  }

  return (
    <div className="mx-auto max-w-md">
      <SaleForm pdvs={pdvs} selectedPdvId={userRole === 'PDV' ? userPdvId : undefined} />
    </div>
  );
}
