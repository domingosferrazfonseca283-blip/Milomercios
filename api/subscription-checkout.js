// Placeholder seguro para integração de pagamento de subscrições.
// NÃO coloque chaves secretas neste ficheiro se ele for servido pelo GitHub Pages.
// A integração real deverá correr num backend/Cloud Function.
export function validarPedidoSubscricao({ vendedorId, plano, valor }) {
  if (!vendedorId || !['semanal', 'mensal'].includes(plano) || !Number.isFinite(Number(valor)) || Number(valor) <= 0) throw new Error('Pedido de subscrição inválido.');
  return { vendedorId, plano, valor: Number(valor) };
}
