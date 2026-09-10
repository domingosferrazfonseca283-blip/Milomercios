import { supabase } from './supabase-config.js';
import { currentUser, signOut, getProfile } from './supabase-auth.js';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money = v => `${Number(v || 0).toLocaleString('pt-AO')} Kz`;
const labelStatus = s => ({aguardando_pagamento:'Aguardando pagamento',recebido:'Recebida',em_preparacao:'Em preparação',enviado:'Enviada',concluido:'Concluída',cancelado:'Cancelada'}[s] || s || 'Em processamento');
let user;

async function iniciar() {
  user = await currentUser();
  if (!user) return location.href = 'login.html';
  $('email').value = user.email || '';
  try {
    const p = await getProfile(user.id) || {};
    $('nome').value = p.nome || '';
    $('telefone').value = p.telefone || p.whatsapp || '';
    $('morada').value = p.morada || '';
    $('boas-vindas').textContent = `Olá, ${p.nome || 'cliente'}!`;
    await carregarPedidos();
  } catch (e) {
    $('perfil-status').textContent = 'Não foi possível carregar o perfil.';
    console.error(e);
  }
}

$('btn-sair').onclick = async () => { await signOut(); location.href = 'login.html'; };

$('btn-salvar').onclick = async () => {
  if (!user) return;
  const nome = $('nome').value.trim(), telefone = $('telefone').value.trim(), morada = $('morada').value.trim();
  if (!nome) return alert('Informe o seu nome.');
  try {
    const { error } = await supabase.from('profiles').update({ nome, telefone, morada, atualizado_em: new Date().toISOString() }).eq('id', user.id);
    if (error) throw error;
    $('boas-vindas').textContent = `Olá, ${nome}!`;
    $('perfil-status').textContent = 'Dados guardados com sucesso.';
  } catch (e) {
    console.error(e); $('perfil-status').textContent = 'Erro ao guardar os dados.';
    alert('Não foi possível guardar os dados: ' + e.message);
  }
};

async function carregarPedidos() {
  const el = $('pedidos'), status = $('pedidos-status');
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id,items,total,payment_status,order_status,criado_em')
      .eq('cliente_id', user.id)
      .order('criado_em', { ascending: false });
    if (error) throw error;
    const pedidos = data || [];
    status.textContent = `${pedidos.length} ${pedidos.length === 1 ? 'encomenda encontrada' : 'encomendas encontradas'}`;
    el.innerHTML = pedidos.length ? pedidos.map(renderPedido).join('') : '<div class="empty"><i class="fas fa-box-open"></i><p>Ainda não fez nenhuma encomenda.</p><a class="btn-secondary" href="index.html">Explorar produtos</a></div>';
  } catch (e) {
    console.error(e); status.textContent = 'Não foi possível carregar as encomendas.';
  }
}

function dataTexto(v) { const ms = Date.parse(v || ''); return Number.isNaN(ms) ? 'Data não disponível' : new Date(ms).toLocaleString('pt-AO'); }
function renderPedido(p) {
  const itens = Array.isArray(p.items) ? p.items : [];
  const total = Number(p.total || itens.reduce((a,i) => a + (Number(i.preco)||0)*(Number(i.quantidade)||1), 0));
  const estado = p.order_status || 'aguardando_pagamento';
  return `<article class="order"><div class="order-top"><div><strong>Encomenda #${esc(p.id.slice(0,8).toUpperCase())}</strong><div class="muted">${esc(dataTexto(p.criado_em))}</div></div><span class="badge">${esc(labelStatus(estado))}</span></div><div class="order-items">${itens.map(i => { const href = i.id ? `produto.html?id=${encodeURIComponent(i.id)}` : '#'; return `<div><a href="${href}">${esc(i.nome || 'Produto')}</a> × ${Number(i.quantidade)||1} — ${money((Number(i.preco)||0)*(Number(i.quantidade)||1))}</div>`; }).join('')}</div><strong>Total: ${money(total)}</strong>${p.payment_status ? `<div class="muted">Pagamento: ${esc(p.payment_status)}</div>` : ''}</article>`;
}

iniciar();
