import { supabase, currentUser } from './supabase-auth.js';

const app = document.getElementById('app');
const esc = v => String(v ?? '').replace(/[&<>\'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const money = v => `${Number(v || 0).toLocaleString('pt-AO')} Kz`;
const labels = { pendente:'Pendente', confirmada:'Confirmada', em_preparacao:'Em preparação', enviada:'Enviada', entregue:'Entregue', cancelada:'Cancelada' };
const statusLabel = s => labels[String(s || 'pendente').toLowerCase()] || s || 'Pendente';
const date = v => v ? new Date(v).toLocaleString('pt-AO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';

function customer(order){
  const c = order.customer || order.cliente || {};
  return {
    nome: c.nome || c.name || order.cliente_nome || order.nome_cliente || 'Não informado',
    telefone: c.telefone || c.phone || order.cliente_telefone || order.telefone || 'Não informado',
    email: c.email || order.cliente_email || order.email_cliente || 'Não informado',
    morada: c.morada || c.endereco || c.address || order.morada_entrega || order.endereco_entrega || 'Não informado'
  };
}

function sellerItems(order, userId){
  if (!Array.isArray(order.items)) return [];
  return order.items.filter(i => i && (i.vendedorId === userId || i.vendedor_id === userId || i.seller_id === userId));
}

function render(order, userId){
  const c = customer(order);
  const items = sellerItems(order,userId);
  const total = items.reduce((sum,i) => sum + (Number(i.preco ?? i.price) || 0) * (Number(i.quantidade ?? i.quantity) || 1), 0) || Number(order.total ?? order.valor_total ?? 0);
  const status = String(order.estado || order.status || 'pendente').toLowerCase();
  const itemHtml = items.length ? items.map(i => {
    const qty = Number(i.quantidade ?? i.quantity) || 1;
    const price = Number(i.preco ?? i.price) || 0;
    const image = i.imagem_url || i.imagem || i.image || '';
    return `<div class="item-row">${image ? `<img src="${esc(image)}" alt="${esc(i.nome || i.name || 'Produto')}">` : '<div></div>'}<div><div class="item-name">${esc(i.nome || i.name || 'Produto')}</div><div class="item-meta">Quantidade: ${qty} · Preço unitário: ${money(price)}</div></div><div class="item-price">${money(price * qty)}</div></div>`;
  }).join('') : '<p>Nenhum item desta encomenda pertence a esta loja ou os itens não estão disponíveis.</p>';

  app.innerHTML = `<section class="order-hero"><span class="section-kicker" style="color:#ffd28d">GESTÃO DE VENDAS</span><h1>Encomenda #${esc(order.numero || order.id)}</h1><p>Detalhes da venda e informações necessárias para preparar o pedido.</p><div class="order-actions"><a href="vendedor.html"><i class="fas fa-arrow-left"></i> Voltar ao painel</a><a href="encomenda.html?id=${encodeURIComponent(order.id)}" target="_blank" rel="noopener"><i class="fas fa-location-dot"></i> Ver acompanhamento</a></div></section>
  <section class="order-card"><h2>Resumo</h2><div class="summary-grid"><div class="summary-item"><span>Estado</span><strong><span class="status-badge">${esc(statusLabel(status))}</span></strong></div><div class="summary-item"><span>Total da encomenda</span><strong>${money(total)}</strong></div><div class="summary-item"><span>Data</span><strong>${esc(date(order.criado_em))}</strong></div></div></section>
  <section class="order-card"><h2>Cliente</h2><div class="info-grid"><div class="info-box"><span>Nome</span><strong>${esc(c.nome)}</strong></div><div class="info-box"><span>Telefone</span><strong>${esc(c.telefone)}</strong></div><div class="info-box"><span>Email</span><strong>${esc(c.email)}</strong></div><div class="info-box"><span>Morada / entrega</span><strong>${esc(c.morada)}</strong></div></div></section>
  <section class="order-card"><h2>Produtos desta venda</h2>${itemHtml}</section>`;
}

async function init(){
  const user = await currentUser();
  const id = new URLSearchParams(location.search).get('id');
  if (!user || !id) { app.innerHTML = '<div class="order-card error"><h2>Encomenda indisponível</h2><p>Inicie sessão como vendedor e abra uma encomenda válida.</p><a href="vendedor.html">Voltar ao painel</a></div>'; return; }
  const { data: order, error } = await supabase.from('orders').select('*').eq('id',id).contains('seller_ids',[user.id]).maybeSingle();
  if (error || !order) { app.innerHTML = '<div class="order-card error"><h2>Encomenda não encontrada</h2><p>Esta encomenda não está associada à sua loja.</p><a href="vendedor.html">Voltar ao painel</a></div>'; return; }
  render(order,user.id);
}

init().catch(error => { console.error(error); app.innerHTML = '<div class="order-card error"><h2>Ocorreu um erro</h2><p>Não foi possível carregar os detalhes da encomenda.</p><a href="vendedor.html">Voltar ao painel</a></div>'; });
