'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Printer } from 'lucide-react';
import type { Card } from '@/lib/definitions';
import { toDataURL as generateQrCodeDataUrl } from 'qrcode';

export default function ReprintQrButton({ card }: { card: Card }) {
  const { toast } = useToast();

  const handlePrint = async () => {
    // Open the window immediately on user action to avoid popup blockers
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        variant: 'destructive',
        title: 'Erro de Impressão',
        description: 'Não foi possível abrir a janela de impressão. Verifique se os pop-ups estão bloqueados.',
      });
      return;
    }

    try {
      // Generate QR code data URL asynchronously
      const qrCodeDataUrl = await generateQrCodeDataUrl(card.qr_code_id, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 128,
      });

      // Now write the content to the opened window
      printWindow.document.write(`
        <html>
          <head>
            <title>FestaPay - Comprovante</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
              @page { 
                size: auto;
                margin: 0mm; 
              }
              body { 
                font-family: 'Inter', sans-serif;
                margin: 0; 
                padding: 0;
                display: flex; 
                flex-direction: column;
                align-items: center; 
                justify-content: center; 
                text-align: center;
                height: 100vh;
              }
              .content {
                text-align: center;
                break-inside: avoid;
              }
              .qr-id {
                font-family: monospace;
                font-size: 10px;
                margin-top: 4px;
              }
              .client-name {
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 6px;
              }
              .balance-label {
                 font-size: 12px;
                 font-weight: 500;
                 margin-top: 6px;
              }
              .balance-value {
                font-size: 20px;
                font-weight: 700;
              }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <div class="content">
              ${card.nome_cliente ? `<div class="client-name">${card.nome_cliente}</div>` : ''}
              <img src="${qrCodeDataUrl}" alt="QR Code" />
              <div class="qr-id">${card.qr_code_id}</div>
              <div class="balance-label">Saldo Atual</div>
              <div class="balance-value">${formatCurrency(card.saldo_centavos ?? 0)}</div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();

    } catch (err) {
       console.error("Failed to generate QR code for printing:", err);
       toast({
         variant: 'destructive',
         title: 'Erro de QR Code',
         description: 'Não foi possível gerar a imagem do QR code para impressão.',
       });
       printWindow.close(); // Close the window on error
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePrint}>
      <Printer className="mr-2 h-4 w-4" />
      Reimprimir
    </Button>
  );
}
