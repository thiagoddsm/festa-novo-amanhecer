import type { TenantEvent } from './definitions';

/**
 * Normaliza e ordena eventos por relevância para o usuário:
 * 1. Eventos do ano mais recente (ex: 2026 antes de 2025).
 * 2. Eventos de produção/oficiais antes de eventos de teste (ex: Festa Oficial antes de "Teste 2026").
 * 3. Status ATIVO antes de inativo.
 * 4. Data de criação mais recente.
 */
export function sortTenantEvents(events: TenantEvent[]): TenantEvent[] {
  return [...events].sort((a, b) => {
    // 1. Extrai o ano de 4 dígitos do nome (ex: 2026 vs 2025)
    const yearA = parseInt(a.name?.match(/\b(20\d\d)\b/)?.[1] || '0', 10);
    const yearB = parseInt(b.name?.match(/\b(20\d\d)\b/)?.[1] || '0', 10);
    if (yearA !== yearB) return yearB - yearA;

    // 2. Não-teste antes de teste
    const isTestA = a.name?.toLowerCase().includes('teste') ? 1 : 0;
    const isTestB = b.name?.toLowerCase().includes('teste') ? 1 : 0;
    if (isTestA !== isTestB) return isTestA - isTestB;

    // 3. Status ATIVO antes de inativo
    const isActiveA = (a as any).status === 'ACTIVE' || a.active ? 1 : 0;
    const isActiveB = (b as any).status === 'ACTIVE' || b.active ? 1 : 0;
    if (isActiveA !== isActiveB) return isActiveB - isActiveA;

    // 4. Data mais recente
    const timeA = a.date?.seconds || (a as any).created_at?.seconds || 0;
    const timeB = b.date?.seconds || (b as any).created_at?.seconds || 0;
    return timeB - timeA;
  });
}

/**
 * Normaliza ID / slug de tenant lidando com legados e typos como 'igreja-batista-da-manh-'.
 */
export function normalizeTenantId(tenantId: string | undefined | null): string {
  if (!tenantId) return '';
  if (tenantId === 'igreja-batista-da-manh-') return 'igreja-batista-da-manha';
  return tenantId;
}
