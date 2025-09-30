import SaleForm from "@/components/pos/SaleForm";
import { getPdvs } from "@/lib/data";

export default function PosPage() {
  const pdvs = getPdvs();
  return (
    <div className="mx-auto max-w-md">
      <SaleForm pdvs={pdvs} />
    </div>
  );
}
