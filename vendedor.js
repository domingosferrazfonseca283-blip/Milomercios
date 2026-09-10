import { supabase, currentUser, signOut, getProfile } from './supabase-auth.js';

const ADMIN_EMAIL = 'domingosferrazfonseca283@gmail.com';
const MAX_PRODUCT_IMAGE = 700 * 1024;
const MAX_PROOF = 700 * 1024;
const $ = id => document.getElementById(id);
let user;
let pedidoSubscricaoAtual = null;
let profile;

const money = v => `${Number(v || 0).toLocaleString('pt-AO')} Kz`;
const esc = v => String(v ?? '').replace(/[&<>\'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const lojaUrl = () => `loja.html?id=${encodeURIComponent(user.id)}`;

function formatData(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-AO');
}

function readImage(file, maxBytes = 700 * 1024, maxDimension = 1400) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Escolha uma imagem válida.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length * 0.75 > maxBytes && quality > 0.35) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        if (dataUrl.length * 0.75 > maxBytes) return reject(new Error('A imagem continua muito grande. Escolha uma imagem menor.'));
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function carregarPerfil() {
  const { data, error } = await supabase.from('stores').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  const p = data || {};
  $('loja-nome').value = p.nome_loja || profile?.nome_loja || '';
  $('loja-descricao').value = p.descricao || '';
  $('loja-localizacao').value = p.localizacao || '';
  $('loja-telefone').value = p.telefone || profile?.telefone || '';
  $('loja-whatsapp').value = p.whatsapp || profile?.whatsapp || '';
  $('loja-imagem').value = p.imagem_url || '';
  $('link-loja').href = lojaUrl();
}

async function guardarPerfil() {
  const nome = $('loja-nome').value.trim();
  if (!nome) return alert('Informe o nome da loja.');
  const payload = {
    id: user.id,
    nome_loja: nome,
    descricao: $('loja-descricao').value.trim(),
    localizacao: $('loja-localizacao').value.trim(),
    telefone: $('loja-telefone').value.trim(),
    whatsapp: $('loja-whatsapp').value.trim(),
    imagem_url: $('loja-imagem').value.trim(),
    atualizado_em: new Date().toISOString()
  };
  const { error } = await supabase.from('stores').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
  const { error: profileError } = await supabase.from('profiles').update({
    nome_loja: nome,
    telefone: payload.telefone,
    whatsapp: payload.whatsapp,
    atualizado_em: new Date().toISOString()
  }).eq('id', user.id);
  if (profileError) throw profileError;
  profile = { ...profile, ...payload };
  $('nome-loja').textContent = nome;
  $('perfil-status').textContent = 'Perfil guardado com sucesso.';
  $('link-loja').href = lojaUrl();
}

async function carregarSubscricao() {
  const { data: config, error: configError } = await supabase.from('subscription_config').select('*').eq('id', true).maybeSingle();
  if (configError) throw configError;
  const c = config || { plano: 'mensal', valor: 0, link_pagamento: '' };
  const plano = c.plano || 'mensal';
  const valor = Number(c.valor || 0);
  const link = String(c.link_pagamento || '').trim();

  $('sub-info').textContent = valor > 0
    ? `Plano disponível: ${plano} · ${money(valor)}. Após o pagamento, envie o comprovativo para análise.`
    : 'O administrador ainda não configurou o valor da subscrição.';

  $('sub-pagamento').innerHTML = link
    ? `Pagamento: <a href="${esc(link)}" target="_blank" rel="noopener">Abrir link de pagamento</a>. Depois envie o comprovativo abaixo.`
    : 'Pagamento: aguarde o administrador configurar o link de pagamento.';

  const { data: pedidos, error: pedidosError } = await supabase.from('subscription_requests').select('*').eq('vendedor_id', user.id).order('criado_em', { ascending: false });
  if (pedidosError) throw pedidosError;
  pedidoSubscricaoAtual = pedidos?.[0] || null;

  if (pedidoSubscricaoAtual) {
    const p = pedidoSubscricaoAtual;
    const comprovativo = p.comprovativo_imagem
      ? ` · <button type="button" class="btn-ver-comprovativo" data-image="${esc(p.comprovativo_imagem)}">Ver comprovativo</button>`
      : '';
    $('sub-pagamento').innerHTML += `<br>Último pedido: <strong>${esc(p.estado || 'aguardando_pagamento')}</strong>${p.criado_em ? ` · ${esc(formatData(p.criado_em))}` : ''}${comprovativo}`;
    $('comprovativo-area').style.display = ['pago', 'rejeitado'].includes(p.estado) ? 'none' : 'block';
    $('sub-pagamento').querySelector('.btn-ver-comprovativo')?.addEventListener('click', e => {
      const image = e.currentTarget.dataset.image;
      const w = window.open('', '_blank', 'noopener');
      if (w) w.document.write(`<title>Comprovativo</title><img src="${image}" style="max-width:100%;height:auto">`);
    });
  } else {
    $('comprovativo-area').style.display = 'none';
  }
}

$('comprovativo')?.addEventListener('change', () => {
  const file = $('comprovativo').files?.[0];
  const ok = file && file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024;
  $('btn-comprovativo').disabled = !ok;
  $('comprovativo-status').textContent = file && !ok ? 'Escolha uma imagem de comprovativo. A imagem será comprimida automaticamente.' : '';
});

$('btn-pedir').onclick = async () => {
  try {
    if (profile?.subscricao_ativa) return alert('A sua subscrição já está ativa.');
    const { data: c, error } = await supabase.from('subscription_config').select('*').eq('id', true).maybeSingle();
    if (error) throw error;
    const config = c || { plano: 'mensal', valor: 0, link_pagamento: '' };
    if (!Number(config.valor || 0)) return alert('O administrador ainda não configurou o valor da subscrição.');
    const { data: pedido, error: pedidoError } = await supabase.from('subscription_requests').insert({
      vendedor_id: user.id,
      email: user.email || '',
      admin_email: ADMIN_EMAIL,
      plano: config.plano || 'mensal',
      valor: Number(config.valor || 0),
      link_pagamento: config.link_pagamento || '',
      estado: 'aguardando_pagamento'
    }).select().single();
    if (pedidoError) throw pedidoError;
    pedidoSubscricaoAtual = pedido;
    $('comprovativo-area').style.display = 'block';
    $('comprovativo-status').textContent = 'Pedido criado. Faça o pagamento e envie o comprovativo.';
    await carregarSubscricao();
  } catch (e) { alert('Não foi possível criar o pedido: ' + e.message); }
};

$('btn-comprovativo')?.addEventListener('click', async () => {
  const file = $('comprovativo').files?.[0];
  if (!file) return alert('Selecione o comprovativo.');
  if (!file.type.startsWith('image/')) return alert('Por enquanto, envie o comprovativo como imagem (JPG, PNG ou semelhante).');
  if (!pedidoSubscricaoAtual?.id) return alert('Primeiro solicite uma subscrição.');
  if (pedidoSubscricaoAtual.estado === 'pago') return alert('Este pedido já foi pago.');

  const btn = $('btn-comprovativo');
  btn.disabled = true;
  $('comprovativo-progresso').style.display = 'block';
  $('barra-progresso').value = 20;
  $('progresso-texto').textContent = 'A comprimir...';
  $('comprovativo-status').textContent = 'A preparar comprovativo...';

  try {
    const comprovativo_imagem = await readImage(file, MAX_PROOF, 1200);
    $('barra-progresso').value = 80;
    $('progresso-texto').textContent = 'A guardar...';
    const { error } = await supabase.from('subscription_requests').update({
      comprovativo_imagem,
      comprovativo_nome: file.name,
      comprovativo_tipo: 'image/jpeg',
      comprovativo_enviado_em: new Date().toISOString(),
      estado: 'comprovativo_enviado'
    }).eq('id', pedidoSubscricaoAtual.id).eq('vendedor_id', user.id);
    if (error) throw error;
    pedidoSubscricaoAtual.comprovativo_imagem = comprovativo_imagem;
    pedidoSubscricaoAtual.estado = 'comprovativo_enviado';
    $('barra-progresso').value = 100;
    $('progresso-texto').textContent = '100%';
    $('comprovativo-status').textContent = 'Comprovativo enviado. Aguarde a confirmação do administrador.';
    await carregarSubscricao();
  } catch (e) {
    console.error(e);
    $('comprovativo-status').textContent = 'Não foi possível guardar o comprovativo: ' + e.message;
  } finally { btn.disabled = false; }
});

$('btn-logout').onclick = async () => {
  await signOut();
  location.href = 'login.html';
};

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
  if (file && !file.type.startsWith('image/')) return alert('A imagem do produto deve ser válida.');
  if (!profile?.subscricao_ativa || profile?.estado_conta !== 'ativo') return alert('A sua conta de vendedor precisa de estar ativa e com subscrição ativa.');

  const btn = $('btn-produto');
  btn.disabled = true;
  $('produto-status').textContent = 'A criar produto...';
  try {
    const { data: produto, error: insertError } = await supabase.from('products').insert({
      vendedor_id: user.id,
      nome,
      preco,
      stock,
      categoria: categoria || 'outros',
      descricao,
      imagem_url: '',
      ativo: false,
      estado_aprovacao: 'pendente'
    }).select().single();
    if (insertError) throw insertError;

    if (file) {
      $('produto-progresso').style.display = 'block';
      $('produto-barra').value = 30;
      $('produto-progresso-texto').textContent = 'A comprimir imagem...';
      $('produto-status').textContent = 'A preparar imagem...';
      const imagem_url = await readImage(file, MAX_PRODUCT_IMAGE, 1400);
      const { error: imageError } = await supabase.from('products').update({ imagem_url, atualizado_em: new Date().toISOString() }).eq('id', produto.id).eq('vendedor_id', user.id);
      if (imageError) throw imageError;
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
  const { data, error } = await supabase.from('products').select('*').eq('vendedor_id', user.id).order('criado_em', { ascending: false });
  if (error) throw error;
  $('produtos-list').innerHTML = (data || []).map(p => {
    const imagem = p.imagem_url ? `<img src="${esc(p.imagem_url)}" alt="${esc(p.nome)}" style="width:70px;height:70px;object-fit:cover;border-radius:8px">` : '';
    const estado = p.ativo ? 'Publicado' : (p.estado_aprovacao || 'Pendente');
    return `<div class="cart-item"><div>${imagem}<strong>${esc(p.nome)}</strong><br><span>${money(p.preco)} · Stock: ${Math.max(0, Math.floor(Number(p.stock) || 0))} · ${esc(estado)}</span></div></div>`;
  }).join('') || '<p>Nenhum produto.</p>';
}

async function carregarPedidos() {
  const el = $('pedidos-list');
  try {
    const { data, error } = await supabase.from('orders').select('*').contains('seller_ids', [user.id]).order('criado_em', { ascending: false });
    if (error) throw error;
    el.innerHTML = (data || []).map(p => {
      const it = Array.isArray(p.items) ? p.items.filter(i => i.vendedorId === user.id || i.vendedor_id === user.id) : [];
      const total = it.reduce((a, i) => a + (Number(i.preco) || 0) * (Number(i.quantidade) || 1), 0);
      return `<div class="cart-item"><div><strong>Encomenda #${esc(p.id)}</strong><br>Cliente: ${esc(p.customer?.nome || p.customer?.name || '')}<br>Itens: ${it.map(i => esc(i.nome) + ' × ' + (i.quantidade || 1)).join(', ')}<br>Total: ${money(total)}</div><select data-id="${p.id}" data-status="${esc(p.order_status || '')}"><option value="aguardando_pagamento">Aguardando pagamento</option><option value="recebido">Recebida</option><option value="em_preparacao">Em preparação</option><option value="enviado">Enviada</option><option value="concluido">Concluída</option><option value="cancelado">Cancelada</option></select></div>`;
    }).join('') || '<p>Nenhuma encomenda.</p>';
    el.querySelectorAll('select').forEach(x => {
      x.value = x.dataset.status || 'aguardando_pagamento';
      x.onchange = async () => {
        const { error: updateError } = await supabase.from('orders').update({ order_status: x.value, atualizado_em: new Date().toISOString() }).eq('id', x.dataset.id).contains('seller_ids', [user.id]);
        if (updateError) {
          alert('Não foi possível atualizar o estado: ' + updateError.message);
          await carregarPedidos();
          return;
        }
        alert('Estado atualizado.');
      };
    });
  } catch (e) { el.textContent = 'Não foi possível carregar encomendas: ' + e.message; }
}

async function iniciar() {
  user = await currentUser();
  if (!user) return location.href = 'login.html';
  profile = await getProfile(user.id);
  if (!profile || profile.tipo !== 'vendedor') {
    alert('Área exclusiva para vendedores.');
    return location.href = profile?.tipo === 'admin' ? 'admin.html' : 'index.html';
  }
  $('nome-loja').textContent = profile.nome_loja || 'Minha loja';
  $('email').textContent = user.email || '';
  $('estado').textContent = profile.estado_conta === 'bloqueado' ? 'Conta bloqueada' : profile.subscricao_ativa ? 'Conta ativa' : 'Aguardando subscrição';
  $('sub-info').textContent = profile.subscricao_ativa ? 'Subscrição ativa.' : 'A carregar...';
  await carregarPerfil();
  await carregarSubscricao();
  await carregarProdutos();
  await carregarPedidos();
}

iniciar().catch(e => {
  console.error(e);
  alert('Não foi possível carregar a área do vendedor: ' + e.message);
});
