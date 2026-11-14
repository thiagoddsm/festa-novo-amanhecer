'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, buildCardAppUrl } from '@/lib/utils';
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
      const qrPayload = buildCardAppUrl(card.qr_code_id, 'https://festanovoamanhecer.com.br');
      // Generate QR code data URL asynchronously
      const qrCodeDataUrl = await generateQrCodeDataUrl(qrPayload, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 148,
      });

      // Now write the content to the opened window
      printWindow.document.write(`
        <html>
          <head>
            <title>FestaPay - Cartão de Consumo</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap');
              @page { 
                size: auto;
                margin: 0mm; 
              }
              body { 
                font-family: 'Inter', Arial, sans-serif;
                color: #000;
                margin: 0; 
                padding: 8px 4px;
                display: flex; 
                flex-direction: column;
                align-items: center; 
                justify-content: flex-start; 
                text-align: center;
              }
              .content {
                text-align: center;
                break-inside: avoid;
                width: 100%;
                max-width: 240px;
              }
              .event-header {
                font-size: 11px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                line-height: 1.2;
              }
              .event-sub {
                font-size: 10px;
                font-weight: 600;
                margin-bottom: 6px;
                padding-bottom: 5px;
                border-bottom: 1.5px solid #000;
              }
              .client-name {
                font-size: 16px;
                font-weight: 800;
                margin: 6px 0 4px 0;
                line-height: 1.2;
              }
              .qr-img {
                display: block;
                margin: 0 auto;
              }
              .qr-id {
                font-family: monospace;
                font-size: 9.5px;
                font-weight: 600;
                margin-top: 2px;
              }
              .balance-box {
                margin: 6px 0;
                padding: 4px 0;
                border-top: 1px dashed #000;
                border-bottom: 1px dashed #000;
              }
              .balance-label {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
              }
              .balance-value {
                font-size: 20px;
                font-weight: 800;
                line-height: 1.15;
              }
              .section-box {
                text-align: left;
                margin-top: 6px;
                padding: 5px 6px;
                border: 1px solid #000;
                border-radius: 6px;
              }
              .section-title {
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
                text-align: center;
                margin-bottom: 3px;
                padding-bottom: 2px;
                border-bottom: 1px dotted #000;
              }
              .section-list {
                margin: 0;
                padding: 0;
                list-style: none;
                font-size: 9.5px;
                font-weight: 600;
                line-height: 1.35;
              }
              .section-list li {
                margin-top: 2px;
              }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <div class="content">
              <div class="event-header">Festa Novo Amanhecer 2026</div>
              <div class="event-sub">Cartão de Consumo • FestaPay</div>

              ${card.nome_cliente ? `<div class="client-name">${card.nome_cliente}</div>` : ''}
              <img class="qr-img" src="${qrCodeDataUrl}" alt="QR Code" />
              <div class="qr-id">${card.qr_code_id}</div>

              <div class="balance-box">
                <div class="balance-label">Saldo Atual</div>
                <div class="balance-value">${formatCurrency(card.saldo_centavos ?? 0)}</div>
              </div>

              <div class="section-box">
                <div class="section-title">1. Como usar este papel</div>
                <ul class="section-list">
                  <li>• <strong>Nas Barracas:</strong> apresente este QR Code para comprar.</li>
                  <li>• <strong>No Caixa:</strong> apresente para recarregar ou consultar saldo.</li>
                </ul>
              </div>

              <div class="section-box">
                <div class="section-title">2. Use também pelo Celular</div>
                <ul class="section-list">
                  <li>Aponte a câmera do celular para este QR Code para:</li>
                  <li>✓ Conferir seu <strong>Saldo</strong> ao vivo</li>
                  <li>✓ Ver seu <strong>Extrato</strong> de compras/recargas</li>
                  <li>✓ Acompanhar <strong>Pedidos</strong> na fila</li>
                  <li>✓ Acessar seu <strong>QR Code Digital</strong></li>
                </ul>
              </div>
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
