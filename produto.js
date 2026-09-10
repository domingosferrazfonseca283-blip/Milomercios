import { supabase } from './supabase-config.js';
import { currentUser } from './supabase-auth.js';

const el = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money = v => `${Number(v || 0).toLocaleString('pt-AO')} Kz`;

let produto = null;
let quantidade = 1;
let utilizador = null;

function atualizarCarrinho() {
  const cart = JSON.parse(localStorage.getItem('milomercios_cart')) || [];
  const count = el('cart-count');
  if (count) count.textContent = cart.reduce((t, i) => t + (Number(i.quantidade) || 1), 0);
}

function adicionar() {
  if (!produto || produto.stock < 1) return alert('Este produto está esgotado.');
  const cart = JSON.parse(localStorage.getItem('milomercios_cart')) || [];
  const item = cart.find(i => String(i.id) === String(produto.id));
  const atual = Number(item?.quantidade) || 0;
  if (atual + quantidade > produto.stock) return alert(`Só existem ${produto.stock} unidades disponíveis.`);
  if (item) item.quantidade = atual + quantidade;
  else cart.push({ ...produto, quantidade });
  localStorage.setItem('milomercios_cart', JSON.stringify(cart));
  atualizarCarrinho();
  alert('Produto adicionado ao carrinho.');
}

function estrelas(n) {
  const v = Math.max(0, Math.min(5, Number(n) || 0));
  return '★'.repeat(Math.round(v)) + '☆'.repeat(5 - Math.round(v));
}

function render() {
  const box = el('produto');
  if (!produto) {
    box.className = 'notice';
    box.innerHTML = '<i class="fas fa-box-open"></i><h2>Produto não encontrado</h2><p>Este produto pode ter sido removido ou ainda não foi aprovado.</p>';
    return;
  }

  const disponivel = produto.stock > 0;
  const imagem = produto.img ? `<img class="detail-image" src="${esc(produto.img)}" alt="${esc(produto.nome)}">` : '<div class="detail-image placeholder"><i class="fas fa-image"></i></div>';
  const media = produto.avaliacaoMedia || 0;
  const qtd = produto.avaliacaoQuantidade || 0;

  box.className = 'detail-card';
  box.innerHTML = `<div>${imagem}</div><div class="detail-info"><span class="section-kicker">${esc(produto.categoria)}</span><h1>${esc(produto.nome)}</h1><div class="rating-summary"><span class="stars">${estrelas(media)}</span><strong>${media ? media.toFixed(1) : '—'}</strong><span>${qtd} ${qtd === 1 ? 'avaliação' : 'avaliações'}</span></div><div class="detail-price">${money(produto.preco)}</div><div class="detail-stock ${disponivel ? 'stock-ok' : 'stock-out'}">${disponivel ? `<i class="fas fa-circle-check"></i> ${produto.stock} unidades disponíveis` : '<i class="fas fa-circle-xmark"></i> Produto esgotado'}</div><p class="detail-description">${esc(produto.descricao || 'Sem descrição disponível.')}</p><div class="detail-actions"><div class="qty"><button id="menos" type="button">−</button><span id="quantidade">1</span><button id="mais" type="button">+</button></div><button id="add" class="btn-buy" ${disponivel ? '' : 'disabled'}><i class="fas fa-cart-plus"></i> Adicionar ao carrinho</button></div><div class="store-box"><strong><i class="fas fa-store"></i> Loja do vendedor</strong><p style="color:var(--muted);margin:4px 0 10px">Veja outros produtos deste vendedor.</p><a class="btn" href="loja.html?id=${encodeURIComponent(produto.vendedorId)}">Visitar loja</a></div></div>`;

  el('menos').onclick = () => {
    quantidade = Math.max(1, quantidade - 1);
    el('quantidade').textContent = quantidade;
  };
  el('mais').onclick = () => {
    quantidade = Math.min(produto.stock, quantidade + 1);
    el('quantidade').textContent = quantidade;
  };
  el('add').onclick = adicionar;
}

async function carregarAvaliacoes() {
  const box = el('avaliacoes-lista');
  if (!box || !produto) return;
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('id,nota,comentario,cliente_id,criado_em')
      .eq('produto_id', produto.id)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    const reviews = data || [];
    box.innerHTML = reviews.length ? reviews.map(r => `<article class="review"><div><span class="stars">${estrelas(r.nota)}</span><strong>${esc(r.nota)}/5</strong></div><p>${esc(r.comentario || 'Sem comentário.')}</p></article>`).join('') : '<p class="muted">Ainda não existem avaliações.</p>';
  } catch (e) {
    console.error(e);
    box.innerHTML = '<p class="muted">Não foi possível carregar as avaliações.</p>';
  }
}

async function enviarAvaliacao() {
  if (!utilizador) return alert('Inicie sessão para avaliar.');
  const nota = Number(document.querySelector('input[name="nota"]:checked')?.value || 0);
  const comentario = el('comentario-avaliacao').value.trim();
  if (!nota) return alert('Escolha uma nota.');

  try {
    const { error } = await supabase.from('reviews').insert({
      produto_id: produto.id,
      cliente_id: utilizador.id,
      nota,
      comentario: comentario || null
    });
    if (error) throw error;
    alert('Avaliação enviada com sucesso!');
    location.reload();
  } catch (e) {
    console.error(e);
    alert(e?.message || 'Não foi possível enviar a avaliação.');
  }
}

function renderAvaliacaoForm() {
  const area = el('avaliacao-form');
  if (!area) return;
  area.innerHTML = utilizador ? `<h3>Avaliar este produto</h3><div class="star-input">${[5,4,3,2,1].map(n => `<label><input type="radio" name="nota" value="${n}"><span>${'★'.repeat(n)}</span></label>`).join('')}</div><textarea id="comentario-avaliacao" maxlength="1000" placeholder="Conte a sua experiência (opcional)"></textarea><button class="btn-buy" id="enviar-avaliacao" type="button">Enviar avaliação</button>` : '<p>Entre na sua conta para avaliar este produto.</p>';
  const b = el('enviar-avaliacao');
  if (b) b.onclick = enviarAvaliacao;
}

async function carregar() {
  atualizarCarrinho();
  utilizador = await currentUser();
  renderAvaliacaoForm();

  const id = new URLSearchParams(location.search).get('id');
  if (!id) return render();

  try {
    const { data: d, error } = await supabase
      .from('products')
      .select('id,nome,preco,stock,categoria,descricao,imagem_url,vendedor_id,avaliacao_media,avaliacao_quantidade')
      .eq('id', id)
      .eq('ativo', true)
      .maybeSingle();

    if (error) throw error;
    if (!d) return render();

    produto = {
      id: d.id,
      nome: d.nome || 'Produto sem nome',
      preco: Number(d.preco || 0),
      stock: Math.max(0, Math.floor(Number(d.stock) || 0)),
      categoria: String(d.categoria || 'outros'),
      descricao: d.descricao || '',
      img: d.imagem_url || '',
      vendedorId: d.vendedor_id || '',
      avaliacaoMedia: Number(d.avaliacao_media || 0),
      avaliacaoQuantidade: Number(d.avaliacao_quantidade || 0)
    };

    document.title = `${produto.nome} | Milomércios`;
    render();
    await carregarAvaliacoes();
  } catch (e) {
    console.error(e);
    el('produto').innerHTML = '<i class="fas fa-triangle-exclamation"></i><h2>Não foi possível carregar o produto</h2><p>Tente novamente.</p>';
  }
}

carregar();
