'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR" translate="no">
      <body style={{ fontFamily: 'sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h2>Algo deu errado</h2>
          <p style={{ color: '#666' }}>
            Não foi possível carregar o FestaPay. Desative a tradução automática do navegador e tente novamente.
          </p>
          <button
            onClick={() => {
              try {
                localStorage.removeItem('festapay_tenant_id');
                localStorage.removeItem('festapay_event_id');
              } catch {}
              reset();
              window.location.reload();
            }}
            style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #ccc', cursor: 'pointer' }}
          >
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
