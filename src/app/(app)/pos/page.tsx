'use client';

import SaleForm from "@/components/pos/SaleForm";
import { getPdvById, getPdvs } from "@/lib/data";
import type { Pdv } from "@/lib/definitions";
import { useState, useEffect } from "react";

export default function PosPage() {
  const [pdvs, setPdvs] = useState<Pdv[]>([]);
  
  // O papel do usuário é agora fixo, pois não há login
  const userRole = 'CAIXA'; // or 'PDV'
  const userPdvId = 4; // Example PDV ID for a PDV user

  useEffect(() => {
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
  }, []);

  if (pdvs.length === 0) {
    return <div>Ponto de Venda não configurado corretamente ou sem permissão.</div>
  }

  return (
    <div className="mx-auto max-w-md">
      <SaleForm pdvs={pdvs} selectedPdvId={userRole === 'PDV' ? userPdvId : undefined} />
    </div>
  );
}
