import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, query, where, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

const ADMIN_EMAIL = 'domingosferrazfonseca283@gmail.com';
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money = v => `${Number(v || 0).toLocaleString('pt-AO')} Kz`;

onAuthStateChanged(auth, async user => {
  if (!user) return location.href = 'login.html';
  const s = await getDoc(doc(db, 'usuarios', user.uid));
  const p = s.exists() ? s.data() : {};
  if (p.tipo !== 'admin' || (user.email || '').toLowerCase() !== ADMIN_EMAIL) {
    alert('Acesso exclusivo do administrador.');
    return location.href = p.tipo === 'vendedor' ? 'vendedor.html' : 'index.html';
  }
  $('admin-info').textContent = 'Administrador único: ' + ADMIN_EMAIL;
  await carregarConfig();
  await Promise.all([carregarVendedores(), carregarProdutos(), carregarPedidosSubscricao()]);
});

$('btn-logout').onclick = () => signOut(auth);

async function carregarConfig() {
  const s = await getDoc(doc(db, 'configuracao', 'subscricao'));
  if (s.exists()) {
    $('sub-plano').value = s.data().plano || 'mensal';
    $('sub-valor').value = s.data().valor || '';
    $('sub-link').value = s.data().linkPagamento || '';
  }
}

$('btn-sub').onclick = async () => {
  const valor = Number($('sub-valor').value);
  const link = $('sub-link').value.trim();
  if (!valor || valor <= 0) return alert('Informe um valor válido.');
  if (link && !/^https:\/\//i.test(link)) return alert('O link deve começar por https://');
  await setDoc(doc(db, 'configuracao', 'subscricao'), {
    plano: $('sub-plano').value,
    valor,
    linkPagamento: link,
    atualizadoEm: serverTimestamp()
  }, { merge: true });
  alert('Configuração guardada.');
};

async function carregarVendedores() {
  const s = await getDocs(query(collection(db, 'usuarios'), where('tipo', '==', 'vendedor')));
  const vs = s.docs.map(d => ({ id: d.id, ...d.data() }));
  $('total-vendedores').textContent = vs.length;
  $('total-ativos').textContent = vs.filter(v => v.subscricaoAtiva === true && v.estadoConta === 'ativo').length;
  $('vendedores-list').innerHTML = vs.map(v => `<div class="cart-item"><div><strong>${esc(v.nomeLoja || 'Sem nome')}</strong><br>${esc(v.email || '')} · ${esc(v.estadoConta || 'pendente')} · subscrição ${v.subscricaoAtiva ? 'ativa' : 'inativa'}</div><div><button class="btn" onclick="conta('${v.id}',${v.estadoConta === 'ativo'})">${v.estadoConta === 'ativo' ? 'Bloquear' : 'Aprovar'}</button> <button class="btn" onclick="sub('${v.id}',${v.subscricaoAtiva === true})">${v.subscricaoAtiva ? 'Retirar' : 'Conceder'} subscrição</button></div></div>`).join('') || '<p>Nenhum vendedor.</p>';
}

async function carregarProdutos() {
  const s = await getDocs(collection(db, 'produtos'));
  const ps = s.docs.map(d => ({ id: d.id, ...d.data() }));
  $('total-produtos').textContent = ps.length;
  $('produtos-list').innerHTML = ps.map(p => `<div class="cart-item"><div><strong>${esc(p.nome || 'Produto')}</strong><br>${money(p.preco)} · stock ${Math.max(0, Math.floor(Number(p.stock) || 0))} · ${p.ativo ? 'publicado' : esc(p.estadoAprovacao || 'pendente')}</div>${p.imagemUrl ? `<a href="${esc(p.imagemUrl)}" target="_blank" rel="noopener">Ver imagem</a>` : ''}<button class="btn" onclick="produto('${p.id}',${p.ativo === true})">${p.ativo ? 'Ocultar' : 'Aprovar'}</button></div>`).join('') || '<p>Nenhum produto.</p>';
}

async function carregarPedidosSubscricao() {
  const s = await getDocs(collection(db, 'pedidosSubscricao'));
  const ps = s.docs.map(d => ({ id: d.id, ...d.data() }));
  ps.sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));
  $('pedidos-sub-list').innerHTML = ps.map(p => {
    const estado = p.estado || 'aguardando_pagamento';
    const comprovativo = p.comprovativoUrl
      ? `<p><a href="${esc(p.comprovativoUrl)}" target="_blank" rel="noopener">Abrir comprovativo${p.comprovativoNome ? ` (${esc(p.comprovativoNome)})` : ''}</a></p>`
      : '<p>Sem comprovativo enviado.</p>';
    const acoes = estado === 'pago'
      ? '<strong>Pagamento confirmado · vendedor ativo</strong>'
      : `<button class="btn" onclick="pagar('${p.id}','${p.vendedorId}','${p.plano || 'mensal'}')">Confirmar pagamento</button> <button class="btn" onclick="rejeitar('${p.id}')">Rejeitar</button>`;
    return `<div class="cart-item"><div><strong>${esc(p.email || p.vendedorId || '')}</strong><br>${esc(p.plano || 'mensal')} · ${money(p.valor)} · estado: <strong>${esc(estado)}</strong>${p.criadoEm ? `<br>Pedido: ${esc(formatData(p.criadoEm))}` : ''}${p.comprovativoEnviadoEm ? `<br>Comprovativo: ${esc(formatData(p.comprovativoEnviadoEm))}` : ''}${comprovativo}</div><div>${acoes}</div></div>`;
  }).join('') || '<p>Nenhum pedido.</p>';
}

function formatData(value) {
  if (!value) return '';
  const d = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-AO');
}

window.conta = async (id, ativa) => {
  await updateDoc(doc(db, 'usuarios', id), { estadoConta: ativa ? 'bloqueado' : 'ativo', atualizadoEm: serverTimestamp() });
  await carregarVendedores();
};

window.sub = async (id, ativa) => {
  await updateDoc(doc(db, 'usuarios', id), { subscricaoAtiva: !ativa, atualizadoEm: serverTimestamp() });
  await carregarVendedores();
};

window.produto = async (id, ativo) => {
  await updateDoc(doc(db, 'produtos', id), { ativo: !ativo, estadoAprovacao: !ativo ? 'aprovado' : 'oculto', atualizadoEm: serverTimestamp() });
  await carregarProdutos();
};

window.pagar = async (id, vendedor, plano) => {
  const d = new Date();
  plano === 'semanal' ? d.setDate(d.getDate() + 7) : d.setMonth(d.getMonth() + 1);
  await updateDoc(doc(db, 'pedidosSubscricao', id), { estado: 'pago', pagoEm: serverTimestamp(), aprovadoPor: ADMIN_EMAIL });
  await updateDoc(doc(db, 'usuarios', vendedor), {
    subscricaoAtiva: true,
    planoSubscricao: plano,
    proximaCobrancaEm: Timestamp.fromDate(d),
    estadoConta: 'ativo',
    atualizadoEm: serverTimestamp()
  });
  await carregarPedidosSubscricao();
  await carregarVendedores();
  alert('Pagamento confirmado e vendedor ativado.');
};

window.rejeitar = async id => {
  if (!confirm('Rejeitar este comprovativo/pedido de subscrição?')) return;
  await updateDoc(doc(db, 'pedidosSubscricao', id), { estado: 'rejeitado', rejeitadoEm: serverTimestamp(), rejeitadoPor: ADMIN_EMAIL });
  await carregarPedidosSubscricao();
  alert('Pedido rejeitado.');
};
