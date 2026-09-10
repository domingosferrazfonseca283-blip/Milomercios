import { supabase, currentUser, signOut, getProfile } from './supabase-auth.js';

const ADMIN_EMAIL = 'domingosferrazfonseca283@gmail.com';
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>'\"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;' }[c]));
const money = v => `${Number(v || 0).toLocaleString('pt-AO')} Kz`;

async function requireAdmin() {
  const user = await currentUser();
  if (!user) { location.href = 'login.html'; return null; }
  const profile = await getProfile(user.id);
  if (!profile || profile.tipo !== 'admin' || (user.email || '').toLowerCase() !== ADMIN_EMAIL || profile.estado_conta !== 'ativo') {
    alert('Acesso exclusivo do administrador.');
    location.href = profile?.tipo === 'vendedor' ? 'vendedor.html' : 'index.html';
    return null;
  }
  $('admin-info').textContent = `Administrador único: ${ADMIN_EMAIL}`;
  return { user, profile };
}

async function adminWrite(table, payload, filterColumn, filterValue) {
  const session = await requireAdmin();
  if (!session) return false;
  let q = supabase.from(table).update(payload);
  if (filterColumn) q = q.eq(filterColumn, filterValue);
  const { error } = await q;
  if (error) { alert(`Não foi possível atualizar ${table}: ${error.message}`); return false; }
  return true;
}

async function init() {
  try {
    const session = await requireAdmin();
    if (!session) return;
    await Promise.all([carregarVendedores(), carregarProdutos(), carregarPedidosSubscricao()]);
  } catch (e) { console.error(e); alert('Não foi possível carregar o painel: ' + (e?.message || e)); }
}

$('btn-logout').onclick = async () => { try { await signOut(); } finally { location.href = 'login.html'; } };

async function carregarVendedores() {
  const { data, error } = await supabase.from('profiles').select('*').eq('tipo', 'vendedor').order('criado_em', { ascending: false });
  if (error) throw error;
  const vs = data || [];
  $('total-vendedores').textContent = vs.length;
  $('total-ativos').textContent = vs.filter(v => v.subscricao_ativa === true && v.estado_conta === 'ativo').length;
  $('vendedores-list').innerHTML = vs.map(v => `<div class="cart-item"><div><strong>${esc(v.nome_loja || 'Sem nome')}</strong><br>${esc(v.email || '')} · ${esc(v.estado_conta || 'pendente')} · subscrição ${v.subscricao_ativa ? 'ativa' : 'inativa'}</div><div><button class="btn" onclick="conta('${esc(v.id)}',${v.estado_conta === 'ativo'})">${v.estado_conta === 'ativo' ? 'Bloquear' : 'Aprovar'}</button> <button class="btn" onclick="sub('${esc(v.id)}',${v.subscricao_ativa === true})">${v.subscricao_ativa ? 'Retirar' : 'Conceder'} subscrição</button></div></div>`).join('') || '<p>Nenhum vendedor.</p>';
}

async function carregarProdutos() {
  const { data, error } = await supabase.from('products').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  const ps = data || [];
  $('total-produtos').textContent = ps.length;
  $('produtos-list').innerHTML = ps.map(p => `<div class="cart-item"><div><strong>${esc(p.nome || 'Produto')}</strong><br>${money(p.preco)} · stock ${Math.max(0, Math.floor(Number(p.stock) || 0))} · ${p.ativo ? 'publicado' : esc(p.estado_aprovacao || 'pendente')}</div>${p.imagem_url ? `<a href="${esc(p.imagem_url)}" target="_blank" rel="noopener">Ver imagem</a>` : ''}<button class="btn" onclick="produto('${esc(p.id)}',${p.ativo === true})">${p.ativo ? 'Ocultar' : 'Aprovar'}</button></div>`).join('') || '<p>Nenhum produto.</p>';
}

async function carregarPedidosSubscricao() {
  const { data, error } = await supabase.from('subscription_requests').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  const ps = data || [];
  $('pedidos-sub-list').innerHTML = ps.map(p => {
    const estado = p.estado || 'aguardando_pagamento';
    const comprovativo = p.comprovativo_imagem ? `<p><a href="${esc(p.comprovativo_imagem)}" target="_blank" rel="noopener">Abrir comprovativo${p.comprovativo_nome ? ` (${esc(p.comprovativo_nome)})` : ''}</a></p>` : '<p>Sem comprovativo enviado.</p>';
    const acoes = estado === 'pago' ? '<strong>Pagamento confirmado · vendedor ativo</strong>' : `<button class="btn" onclick="pagar('${esc(p.id)}','${esc(p.vendedor_id)}','${esc(p.plano || 'mensal')}')">Confirmar pagamento</button> <button class="btn" onclick="rejeitar('${esc(p.id)}')">Rejeitar</button>`;
    return `<div class="cart-item"><div><strong>${esc(p.email || p.vendedor_id || '')}</strong><br>${esc(p.plano || 'mensal')} · ${money(p.valor)} · estado: <strong>${esc(estado)}</strong>${p.criado_em ? `<br>Pedido: ${esc(formatData(p.criado_em))}` : ''}${p.comprovativo_enviado_em ? `<br>Comprovativo: ${esc(formatData(p.comprovativo_enviado_em))}` : ''}${comprovativo}</div><div>${acoes}</div></div>`;
  }).join('') || '<p>Nenhum pedido.</p>';
}

function formatData(value) { const d = new Date(value); return value && !Number.isNaN(d.getTime()) ? d.toLocaleString('pt-AO') : ''; }

window.conta = async (id, ativa) => {
  if (!confirm(ativa ? 'Bloquear este vendedor?' : 'Aprovar este vendedor?')) return;
  if (await adminWrite('profiles', { estado_conta: ativa ? 'bloqueado' : 'ativo', atualizado_em: new Date().toISOString() }, 'id', id)) await carregarVendedores();
};
window.sub = async (id, ativa) => {
  if (await adminWrite('profiles', { subscricao_ativa: !ativa, atualizado_em: new Date().toISOString() }, 'id', id)) await carregarVendedores();
};
window.produto = async (id, ativo) => {
  if (await adminWrite('products', { ativo: !ativo, estado_aprovacao: !ativo ? 'aprovado' : 'oculto', atualizado_em: new Date().toISOString() }, 'id', id)) await carregarProdutos();
};
window.pagar = async (id, vendedor, plano) => {
  const d = new Date(); plano === 'semanal' ? d.setDate(d.getDate() + 7) : d.setMonth(d.getMonth() + 1);
  if (!(await adminWrite('subscription_requests', { estado: 'pago', pago_em: new Date().toISOString(), aprovado_por: ADMIN_EMAIL }, 'id', id))) return;
  if (!(await adminWrite('profiles', { subscricao_ativa: true, plano_subscricao: plano, proxima_cobranca_em: d.toISOString(), estado_conta: 'ativo', atualizado_em: new Date().toISOString() }, 'id', vendedor))) return;
  await carregarPedidosSubscricao(); await carregarVendedores(); alert('Pagamento confirmado e vendedor ativado.');
};
window.rejeitar = async id => {
  if (!confirm('Rejeitar este comprovativo/pedido de subscrição?')) return;
  if (await adminWrite('subscription_requests', { estado: 'rejeitado', rejeitado_em: new Date().toISOString(), rejeitado_por: ADMIN_EMAIL }, 'id', id)) { await carregarPedidosSubscricao(); alert('Pedido rejeitado.'); }
};
init();