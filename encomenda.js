import { supabase } from './supabase-config.js';
import { currentUser } from './supabase-auth.js';

const app = document.getElementById('tracking-app');
const money = value => `${Number(value || 0).toLocaleString('pt-AO')} Kz`;
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const labels = { pendente:'Pendente', confirmada:'Confirmada', em_preparacao:'Em preparação', enviada:'Enviada', entregue:'Entregue', cancelada:'Cancelada' };
const steps = [
  ['pendente','Encomenda recebida','Recebemos o seu pedido e estamos a validar os dados.'],
  ['confirmada','Encomenda confirmada','O pedido foi confirmado e seguirá para preparação.'],
  ['em_preparacao','Em preparação','O vendedor está a preparar os produtos.'],
  ['enviada','Enviada','A encomenda saiu para entrega.'],
  ['entregue','Entregue','A encomenda foi entregue.']
];

let realtimeChannel = null;
let currentOrder = null;

function normalStatus(order){ return String(order.estado || order.status || 'pendente').toLowerCase(); }

function timeline(status){
  if (status === 'cancelada') return `<div class="timeline"><div class="timeline-step cancelled current"><span class="timeline-dot"><i class="fas fa-xmark"></i></span><div class="timeline-content"><h3>Encomenda cancelada</h3><p>Esta encomenda foi cancelada.</p></div></div></div>`;
  let index = steps.findIndex(([key]) => key === status);
  if (index < 0) index = 0;
  return `<div class="timeline">${steps.map(([key,title,text],i) => `<div class="timeline-step ${i < index ? 'done' : ''} ${i === index ? 'current' : ''}"><span class="timeline-dot">${i < index ? '<i class="fas fa-check"></i>' : i + 1}</span><div class="timeline-content"><h3>${title}</h3><p>${i <= index ? text : 'Aguardando atualização do pedido.'}</p></div></div>`).join('')}</div>`;
}

function renderOrder(order, notice = ''){
  const status = normalStatus(order);
  const total = Number(order.total ?? order.valor_total ?? 0);
  const date = order.criado_em ? new Date(order.criado_em).toLocaleString('pt-AO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
  const ref = order.numero || order.id || '—';
  app.innerHTML = `<div class="tracking-hero"><span class="section-kicker">ACOMPANHAMENTO</span><h1>Encomenda #${escapeHtml(ref)}</h1><p>Veja o estado atual da sua compra.</p></div><section class="card tracking-card">${notice ? `<div class="tracking-live-notice" role="status"><i class="fas fa-arrows-rotate"></i><span>${escapeHtml(notice)}</span></div>` : ''}<div class="order-summary"><div class="summary-item"><span>Estado atual</span><strong>${escapeHtml(labels[status] || status || 'Em análise')}</strong></div><div class="summary-item"><span>Total</span><strong>${money(total)}</strong></div><div class="summary-item"><span>Data da encomenda</span><strong>${escapeHtml(date)}</strong></div></div><h2>Progresso da encomenda</h2>${timeline(status)}<div class="tracking-actions"><a class="btn" href="minha-conta.html">Ver todas as encomendas</a><a class="btn btn-secondary" href="index.html">Continuar a comprar</a></div></section>`;
}

function subscribeToOrder(orderId){
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase.channel(`milomercios-order-${orderId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, payload => {
      if (!payload?.new) return;
      currentOrder = { ...currentOrder, ...payload.new };
      renderOrder(currentOrder, 'O estado da encomenda foi atualizado.');
    })
    .subscribe();
}

async function init(){
  const user = await currentUser();
  const id = new URLSearchParams(location.search).get('id');
  if (!user) { app.innerHTML = `<div class="card empty-tracking"><i class="fas fa-user-lock"></i><h2>Inicie sessão</h2><p>Entre na sua conta para acompanhar esta encomenda.</p><a class="btn" href="login.html">Entrar</a></div>`; return; }
  if (!id) { app.innerHTML = `<div class="card empty-tracking"><i class="fas fa-receipt"></i><h2>Encomenda não encontrada</h2><p>Selecione uma encomenda na sua conta.</p><a class="btn" href="minha-conta.html">Ver encomendas</a></div>`; return; }

  const { data: order, error } = await supabase.from('orders').select('*').eq('id', id).eq('cliente_id', user.id).maybeSingle();
  if (error || !order) { app.innerHTML = `<div class="card empty-tracking"><i class="fas fa-circle-exclamation"></i><h2>Encomenda não encontrada</h2><p>Não foi possível localizar uma encomenda associada à sua conta.</p><a class="btn" href="minha-conta.html">Voltar à minha conta</a></div>`; return; }

  currentOrder = order;
  renderOrder(order);
  subscribeToOrder(id);
}

window.addEventListener('beforeunload', () => {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
});

init().catch(() => { app.innerHTML = `<div class="card empty-tracking"><i class="fas fa-circle-exclamation"></i><h2>Ocorreu um erro</h2><p>Tente novamente dentro de instantes.</p><a class="btn" href="minha-conta.html">Voltar à minha conta</a></div>`; });
