import { auth, db, functions } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-functions.js';
import { supabase, SUPABASE_BUCKET, SUPABASE_IMAGES_BUCKET } from './supabase-config.js';

const ADMIN_EMAIL = 'domingosferrazfonseca283@gmail.com';
const MAX_PRODUCT_IMAGE = 8 * 1024 * 1024;
const MAX_PROOF = 10 * 1024 * 1024;
const $ = id => document.getElementById(id);
let user;
let pedidoSubscricaoAtual = null;

const money = v => `${Number(v || 0).toLocaleString('pt-AO')} Kz`;
const esc = v => String(v ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const safeName = name => String(name || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
const lojaUrl = () => `loja.html?id=${encodeURIComponent(user.uid)}`;
const criarUploadAssinado = httpsCallable(functions, 'criarUploadAssinado');
const obterUrlComprovativo = httpsCallable(functions, 'obterUrlComprovativo');

function formatData(value) {
  if (!value) return '';
  const d = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-AO');
}

async function uploadViaSupabase(bucket, path, file) {
  const result = await criarUploadAssinado({ bucket, path });
  const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(path, result.data.token, file);
  if (error) throw error;
  return path;
}

async function carregarPerfil() {
  const s = await getDoc(doc(db, 'lojas', user.uid));
  const p = s.exists() ? s.data() : {};
  $('loja-nome').value = p.nomeLoja || '';
  $('loja-descricao').value = p.descricao || p.descricaoLoja || '';
  $('loja-localizacao').value = p.localizacao || '';
  $('loja-telefone').value = p.telefone || '';
  $('loja-whatsapp').value = p.whatsapp || '';
  $('loja-imagem').value = p.imagemUrl || p.logoUrl || '';
  $('link-loja').href = lojaUrl();
}

async function guardarPerfil() {
  const nome = $('loja-nome').value.trim();
  if (!nome) return alert('Informe o nome da loja.');
  const perfil = {
    vendedorId: user.uid,
    nomeLoja: nome,
    descricao: $('loja-descricao').value.trim(),
    localizacao: $('loja-localizacao').value.trim(),
    telefone: $('loja-telefone').value.trim(),
    whatsapp: $('loja-whatsapp').value.trim(),
    imagemUrl: $('loja-imagem').value.trim(),
    atualizadoEm: serverTimestamp()
  };
  await setDoc(doc(db, 'lojas', user.uid), perfil, { merge: true });
  $('nome-loja').textContent = nome;
  $('perfil-status').textContent = 'Perfil guardado com sucesso.';
  $('link-loja').href = lojaUrl();
}

async function carregarSubscricao() {
  const configSnap = await getDoc(doc(db, 'configuracao', 'subscricao'));
  const config = configSnap.exists() ? configSnap.data() : {};
  const plano = config.plano || 'mensal';
  const valor = Number(config.valor || 0);
  const link = String(config.linkPagamento || '').trim();

  $('sub-info').textContent = valor > 0
    ? `Plano disponível: ${plano} · ${money(valor)}. Após o pagamento, envie o comprovativo para análise.`
    : 'O administrador ainda não configurou o valor da subscrição.';

  $('sub-pagamento').innerHTML = link
    ? `Pagamento: <a href="${esc(link)}" target="_blank" rel="noopener">Abrir link de pagamento</a>. Depois envie o comprovativo abaixo.`
    : 'Pagamento: aguarde o administrador configurar o link de pagamento.';

  const pedidosSnap = await getDocs(query(collection(db, 'pedidosSubscricao'), where('vendedorId', '==', user.uid)));
  const pedidos = pedidosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  pedidos.sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));
  pedidoSubscricaoAtual = pedidos[0] || null;

  if (pedidoSubscricaoAtual) {
    const p = pedidoSubscricaoAtual;
    const comprovativo = p.comprovativoPath
      ? ` · <button type="button" class="btn-ver-comprovativo" data-path="${esc(p.comprovativoPath)}">Ver comprovativo</button>`
      : '';
    $('sub-pagamento').innerHTML += `<br>Último pedido: <strong>${esc(p.estado || 'aguardando_pagamento')}</strong>${p.criadoEm ? ` · ${esc(formatData(p.criadoEm))}` : ''}${comprovativo}`;
    $('comprovativo-area').style.display = ['pago', 'rejeitado'].includes(p.estado) ? 'none' : 'block';
    $('sub-pagamento').querySelector('.btn-ver-comprovativo')?.addEventListener('click', async e => {
      const button = e.currentTarget;
      button.disabled = true;
      try {
        const result = await obterUrlComprovativo({ path: button.dataset.path });
        window.open(result.data.url, '_blank', 'noopener');
      } catch (error) {
        alert('Não foi possível abrir o comprovativo: ' + error.message);
      } finally { button.disabled = false; }
    });
  } else {
    $('comprovativo-area').style.display = 'none';
  }
}

$('comprovativo')?.addEventListener('change', () => {
  const file = $('comprovativo').files?.[0];
  const ok = file && file.size <= MAX_PROOF && (file.type.startsWith('image/') || file.type === 'application/pdf');
  $('btn-comprovativo').disabled = !ok;
  $('comprovativo-status').textContent = file && !ok ? 'Escolha uma imagem ou PDF com no máximo 10 MB.' : '';
});

$('btn-pedir').onclick = async () => {
  try {
    const s = await getDoc(doc(db, 'configuracao', 'subscricao'));
    const c = s.exists() ? s.data() : { plano: 'mensal', valor: 0, linkPagamento: '' };
    if (!Number(c.valor || 0)) return alert('O administrador ainda não configurou o valor da subscrição.');
    const pedido = await addDoc(collection(db, 'pedidosSubscricao'), {
      vendedorId: user.uid,
      email: user.email || '',
      adminEmail: ADMIN_EMAIL,
      plano: c.plano || 'mensal',
      valor: Number(c.valor || 0),
      linkPagamento: c.linkPagamento || '',
      estado: 'aguardando_pagamento',
      criadoEm: serverTimestamp()
    });
    pedidoSubscricaoAtual = { id: pedido.id, vendedorId: user.uid, plano: c.plano || 'mensal', valor: Number(c.valor || 0), estado: 'aguardando_pagamento' };
    $('comprovativo-area').style.display = 'block';
    $('comprovativo-status').textContent = 'Pedido criado. Faça o pagamento e envie o comprovativo.';
    await carregarSubscricao();
  } catch (e) { alert('Não foi possível criar o pedido: ' + e.message); }
};

$('btn-comprovativo')?.addEventListener('click', async () => {
  const file = $('comprovativo').files?.[0];
  if (!file) return alert('Selecione o comprovativo.');
  if (file.size > MAX_PROOF) return alert('O comprovativo não pode ultrapassar 10 MB.');
  if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) return alert('Envie uma imagem ou PDF.');
  if (!pedidoSubscricaoAtual?.id) return alert('Primeiro solicite uma subscrição.');
  if (pedidoSubscricaoAtual.estado === 'pago') return alert('Este pedido já foi pago.');

  const btn = $('btn-comprovativo');
  btn.disabled = true;
  $('comprovativo-progresso').style.display = 'block';
  $('barra-progresso').value = 0;
  $('progresso-texto').textContent = 'A preparar...';
  $('comprovativo-status').textContent = 'A enviar comprovativo...';

  try {
    const path = `comprovativos/${user.uid}/${pedidoSubscricaoAtual.id}_${safeName(file.name)}`;
    await uploadViaSupabase(SUPABASE_BUCKET, path, file);
    $('barra-progresso').value = 100;
    $('progresso-texto').textContent = '100%';
    await updateDoc(doc(db, 'pedidosSubscricao', pedidoSubscricaoAtual.id), {
      comprovativoPath: path,
      comprovativoNome: file.name,
      comprovativoTipo: file.type,
      comprovativoEnviadoEm: serverTimestamp(),
      estado: 'comprovativo_enviado'
    });
    pedidoSubscricaoAtual.estado = 'comprovativo_enviado';
    $('comprovativo-status').textContent = 'Comprovativo enviado. Aguarde a confirmação do administrador.';
    await carregarSubscricao();
  } catch (e) {
    console.error(e);
    $('comprovativo-status').textContent = 'Não foi possível enviar o comprovativo: ' + e.message;
  } finally { btn.disabled = false; }
});

$('btn-logout').onclick = () => signOut(auth);
$('btn-perfil').onclick = async () => {
  try { await guardarPerfil(); }
  catch (e) { console.error(e); $('perfil-status').textContent = 'Não foi possível guardar o perfil: ' + e.message; }
};

$('btn-produto').onclick = async () => {
  const nome = $('produto-nome').value.trim();
  const preco = Number($('produto-preco').value);
  const stock = Math.floor(Number($('produto-stock').value));
  const categoria = $('produto-categoria').value.trim();
  const descricao = $('produto-descricao').value.trim();
  const file = $('produto-imagem').files?.[0];
  if (!nome || preco <= 0 || !Number.isFinite(stock) || stock < 0) return alert('Informe nome, preço e stock válidos.');
  if (file && (!file.type.startsWith('image/') || file.size > MAX_PRODUCT_IMAGE)) return alert('A imagem deve ser válida e ter no máximo 8 MB.');

  const btn = $('btn-produto');
  btn.disabled = true;
  $('produto-status').textContent = 'A criar produto...';
  try {
    const produtoRef = await addDoc(collection(db, 'produtos'), {
      vendedorId: user.uid, nome, preco, stock, categoria, descricao, imagemUrl: '', ativo: false,
      estadoAprovacao: 'pendente', criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp()
    });

    if (file) {
      $('produto-progresso').style.display = 'block';
      $('produto-barra').value = 0;
      $('produto-progresso-texto').textContent = 'A preparar...';
      $('produto-status').textContent = 'A enviar imagem...';
      const path = `produtos/${user.uid}/${produtoRef.id}/${safeName(file.name)}`;
      await uploadViaSupabase(SUPABASE_IMAGES_BUCKET, path, file);
      const { data } = supabase.storage.from(SUPABASE_IMAGES_BUCKET).getPublicUrl(path);
      await updateDoc(produtoRef, { imagemUrl: data.publicUrl, imagemPath: path, atualizadoEm: serverTimestamp() });
      $('produto-barra').value = 100;
      $('produto-progresso-texto').textContent = '100%';
    }

    $('produto-status').textContent = 'Produto enviado para aprovação do administrador.';
    $('produto-nome').value = ''; $('produto-preco').value = ''; $('produto-stock').value = '';
    $('produto-categoria').value = ''; $('produto-descricao').value = ''; $('produto-imagem').value = '';
    $('produto-progresso').style.display = 'none';
    await carregarProdutos();
  } catch (e) {
    console.error(e);
    $('produto-status').textContent = 'Não foi possível enviar o produto: ' + e.message;
  } finally { btn.disabled = false; }
};

async function carregarProdutos() {
  const s = await getDocs(query(collection(db, 'produtos'), where('vendedorId', '==', user.uid)));
  $('produtos-list').innerHTML = s.docs.map(d => {
    const p = d.data();
    const imagem = p.imagemUrl ? `<img src="${esc(p.imagemUrl)}" alt="${esc(p.nome)}" style="width:70px;height:70px;object-fit:cover;border-radius:8px">` : '';
    return `<div class="cart-item"><div>${imagem}<strong>${esc(p.nome)}</strong><br><span>${money(p.preco)} · Stock: ${Math.max(0, Math.floor(Number(p.stock) || 0))} · ${p.ativo ? 'Publicado' : 'Pendente'}</span></div></div>`;
  }).join('') || '<p>Nenhum produto.</p>';
}

async function carregarPedidos() {
  const el = $('pedidos-list');
  try {
    const s = await getDocs(query(collection(db, 'pedidos'), where('sellerIds', 'array-contains', user.uid)));
    el.innerHTML = s.docs.map(d => {
      const p = d.data();
      const it = (p.items || []).filter(i => i.vendedorId === user.uid);
      const total = it.reduce((a, i) => a + (Number(i.preco) || 0) * (Number(i.quantidade) || 1), 0);
      return `<div class="cart-item"><div><strong>Encomenda #${esc(d.id)}</strong><br>Cliente: ${esc(p.customer?.nome || '')}<br>Itens: ${it.map(i => esc(i.nome) + ' × ' + i.quantidade).join(', ')}<br>Total: ${money(total)}</div><select data-id="${d.id}"><option value="aguardando_pagamento">Aguardando pagamento</option><option value="recebido">Recebida</option><option value="em_preparacao">Em preparação</option><option value="enviado">Enviada</option><option value="concluido">Concluída</option><option value="cancelado">Cancelada</option></select></div>`;
    }).join('') || '<p>Nenhuma encomenda.</p>';
    el.querySelectorAll('select').forEach(x => x.onchange = async () => {
      await updateDoc(doc(db, 'pedidos', x.dataset.id), { orderStatus: x.value });
      alert('Estado atualizado.');
    });
  } catch (e) { el.textContent = 'Não foi possível carregar encomendas: ' + e.message; }
}

onAuthStateChanged(auth, async u => {
  if (!u) return location.href = 'login.html';
  user = u;
  const s = await getDoc(doc(db, 'usuarios', u.uid));
  const v = s.exists() ? s.data() : {};
  if (v.tipo !== 'vendedor') {
    alert('Área exclusiva para vendedores.');
    return location.href = v.tipo === 'admin' ? 'admin.html' : 'index.html';
  }
  $('nome-loja').textContent = v.nomeLoja || 'Minha loja';
  $('email').textContent = u.email || '';
  $('estado').textContent = v.estadoConta === 'bloqueado' ? 'Conta bloqueada' : v.subscricaoAtiva ? 'Conta ativa' : 'Aguardando subscrição';
  $('sub-info').textContent = v.subscricaoAtiva ? 'Subscrição ativa.' : 'A carregar...';
  await carregarPerfil();
  await carregarSubscricao();
  await carregarProdutos();
  await carregarPedidos();
});
