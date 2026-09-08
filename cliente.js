import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money = v => `${Number(v || 0).toLocaleString('pt-AO')} Kz`;
const labelStatus = s => ({aguardando_pagamento:'Aguardando pagamento',recebido:'Recebida',em_preparacao:'Em preparação',enviado:'Enviada',concluido:'Concluída',cancelado:'Cancelada'}[s] || s || 'Em processamento');
let user;

onAuthStateChanged(auth, async u => {
  if (!u) return location.href = 'login.html';
  user = u;
  $('email').value = u.email || '';
  try {
    const snap = await getDoc(doc(db, 'usuarios', u.uid));
    const p = snap.exists() ? snap.data() : {};
    $('nome').value = p.nome || p.nomeCliente || '';
    $('telefone').value = p.telefone || p.whatsapp || '';
    $('morada').value = p.morada || p.endereco || '';
    $('boas-vindas').textContent = `Olá, ${p.nome || p.nomeCliente || 'cliente'}!`;
    await carregarPedidos();
  } catch (e) {
    $('perfil-status').textContent = 'Não foi possível carregar o perfil.';
    console.error(e);
  }
});

$('btn-sair').onclick = () => signOut(auth);

$('btn-salvar').onclick = async () => {
  if (!user) return;
  const nome = $('nome').value.trim(), telefone = $('telefone').value.trim(), morada = $('morada').value.trim();
  if (!nome) return alert('Informe o seu nome.');
  try {
    const ref = doc(db, 'usuarios', user.uid);
    const atual = await getDoc(ref);
    const p = atual.exists() ? atual.data() : {};
    await setDoc(ref, { nome, telefone, morada, tipo: p.tipo || 'cliente', estadoConta: p.estadoConta || 'ativo', subscricaoAtiva: p.subscricaoAtiva === true, atualizadoEm: serverTimestamp() }, { merge: true });
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
    const snap = await getDocs(query(collection(db, 'pedidos'), where('clienteId', '==', user.uid)));
    const pedidos = snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => dataMs(b.criadoEm) - dataMs(a.criadoEm));
    status.textContent = `${pedidos.length} ${pedidos.length === 1 ? 'encomenda encontrada' : 'encomendas encontradas'}`;
    el.innerHTML = pedidos.length ? pedidos.map(renderPedido).join('') : '<div class="empty"><i class="fas fa-box-open"></i><p>Ainda não fez nenhuma encomenda.</p><a class="btn-secondary" href="index.html">Explorar produtos</a></div>';
  } catch (e) {
    console.error(e); status.textContent = 'Não foi possível carregar as encomendas.';
  }
}

function dataMs(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  const n = Date.parse(v); return Number.isNaN(n) ? 0 : n;
}
function dataTexto(v) { const ms = dataMs(v); return ms ? new Date(ms).toLocaleString('pt-AO') : 'Data não disponível'; }
function renderPedido(p) {
  const itens = Array.isArray(p.items) ? p.items : [];
  const total = Number(p.total || itens.reduce((a,i) => a + (Number(i.preco)||0)*(Number(i.quantidade)||1), 0));
  const estado = p.orderStatus || p.status || 'aguardando_pagamento';
  return `<article class="order"><div class="order-top"><div><strong>Encomenda #${esc(p.id.slice(0,8).toUpperCase())}</strong><div class="muted">${esc(dataTexto(p.criadoEm))}</div></div><span class="badge">${esc(labelStatus(estado))}</span></div><div class="order-items">${itens.map(i => { const href = i.id ? `produto.html?id=${encodeURIComponent(i.id)}` : '#'; return `<div><a href="${href}">${esc(i.nome || 'Produto')}</a> × ${Number(i.quantidade)||1} — ${money((Number(i.preco)||0)*(Number(i.quantidade)||1))}</div>`; }).join('')}</div><strong>Total: ${money(total)}</strong>${p.paymentStatus ? `<div class="muted">Pagamento: ${esc(p.paymentStatus)}</div>` : ''}</article>`;
}
