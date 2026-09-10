import { supabase } from './supabase-config.js';
import { currentUser } from './supabase-auth.js';

const money = value => `${Number(value || 0).toLocaleString('pt-AO')} Kz`;
const escapeHtml = value => String(value ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const statusLabel = value => ({pendente:'Pendente',confirmada:'Confirmada',em_preparacao:'Em preparação',enviada:'Enviada',entregue:'Entregue',cancelada:'Cancelada'}[value] || value || 'Em análise');
const statusClass = value => `order-status status-${String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;

async function init() {
  const user = await currentUser();
  if (!user) {
    document.getElementById('account-email').textContent = 'Inicie sessão para consultar as suas encomendas.';
    document.getElementById('orders-list').innerHTML = '<div class="empty-state"><i class="fas fa-user-lock"></i><h3>Sessão necessária</h3><p>Entre na sua conta para ver o seu histórico.</p><a class="btn" href="login.html">Entrar</a></div>';
    return;
  }
  document.getElementById('account-email').textContent = user.email || 'Conta Milomércios';
  const { data, error } = await supabase.from('orders').select('*').eq('cliente_id', user.id).order('criado_em', { ascending: false });
  if (error) { document.getElementById('orders-list').innerHTML = '<div class="empty-state"><i class="fas fa-circle-exclamation"></i><p>Não foi possível carregar as encomendas agora.</p></div>'; return; }
  const orders = data || [];
  document.getElementById('stat-encomendas').textContent = orders.length;
  document.getElementById('stat-total').textContent = money(orders.reduce((sum, o) => sum + Number(o.total || o.valor_total || 0), 0));
  if (!orders.length) { document.getElementById('orders-list').innerHTML = '<div class="empty-state"><i class="fas fa-bag-shopping"></i><h3>Ainda não tem encomendas</h3><p>Explore o marketplace e encontre o que procura.</p><a class="btn" href="index.html">Explorar produtos</a></div>'; return; }
  document.getElementById('orders-list').innerHTML = orders.map(order => {
    const total = Number(order.total || order.valor_total || 0);
    const status = order.estado || order.status || 'pendente';
    const date = order.criado_em ? new Date(order.criado_em).toLocaleDateString('pt-AO', {day:'2-digit',month:'2-digit',year:'numeric'}) : '—';
    const ref = order.numero || order.id || '—';
    return `<article class="order-card"><div><span class="order-id">#${escapeHtml(ref)}</span><strong>${money(total)}</strong><small>${date}</small></div><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="${statusClass(status)}">${escapeHtml(statusLabel(status))}</span><a class="btn btn-small" href="encomenda.html?id=${encodeURIComponent(order.id)}">Acompanhar</a></div></article>`;
  }).join('');
}
init().catch(() => { document.getElementById('orders-list').innerHTML = '<div class="empty-state">Não foi possível carregar a conta.</div>'; });
