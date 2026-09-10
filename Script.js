import { supabase } from './supabase-config.js';

let produtos = [];
const app = document.getElementById('app');
const cartCount = document.getElementById('cart-count');
const status = document.getElementById('catalog-status');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
let categoriaAtual = 'todos';
let pesquisaAtual = '';

function normalizarProduto(data) {
  return {
    id: data.id,
    nome: data.nome || 'Produto sem nome',
    preco: Number(data.preco || 0),
    stock: Math.max(0, Math.floor(Number(data.stock) || 0)),
    categoria: String(data.categoria || 'outros').toLowerCase(),
    descricao: data.descricao || '',
    img: data.imagem_url || '',
    vendedorId: data.vendedor_id || ''
  };
}

function renderizarLoja() {
  let lista = categoriaAtual === 'todos' ? [...produtos] : produtos.filter(p => p.categoria === categoriaAtual);
  if (pesquisaAtual) {
    const termo = pesquisaAtual.toLocaleLowerCase('pt-AO');
    lista = lista.filter(p => `${p.nome} ${p.descricao} ${p.categoria}`.toLocaleLowerCase('pt-AO').includes(termo));
  }
  const ordenacao = sortSelect?.value || 'relevancia';
  if (ordenacao === 'preco-menor') lista.sort((a,b)=>a.preco-b.preco);
  if (ordenacao === 'preco-maior') lista.sort((a,b)=>b.preco-a.preco);
  if (ordenacao === 'nome') lista.sort((a,b)=>a.nome.localeCompare(b.nome,'pt'));

  if (status) status.textContent = `${lista.length} ${lista.length === 1 ? 'produto encontrado' : 'produtos encontrados'}`;
  app.innerHTML = lista.length ? lista.map(prod => {
    const disponivel = prod.stock > 0;
    const imagem = prod.img ? `<a href="produto.html?id=${encodeURIComponent(prod.id)}"><img src="${escapeHtml(prod.img)}" alt="${escapeHtml(prod.nome)}" loading="lazy"></a>` : `<a href="produto.html?id=${encodeURIComponent(prod.id)}" class="product-image-placeholder"><i class="fas fa-image"></i></a>`;
    return `<article class="product-card">${imagem}<h3 title="${escapeHtml(prod.nome)}"><a href="produto.html?id=${encodeURIComponent(prod.id)}" style="color:inherit;text-decoration:none">${escapeHtml(prod.nome)}</a></h3><p class="product-price">${Number(prod.preco).toLocaleString('pt-AO')} Kz</p><p class="${disponivel?'stock-ok':'stock-out'}">${disponivel ? `<i class="fas fa-circle-check"></i> ${prod.stock} em stock` : '<i class="fas fa-circle-xmark"></i> Esgotado'}</p><p class="product-description">${prod.descricao ? escapeHtml(prod.descricao) : ''}</p><p style="font-size:.78rem;margin:0 3px 10px"><a href="loja.html?id=${encodeURIComponent(prod.vendedorId)}" style="color:var(--primaria);font-weight:700;text-decoration:none"><i class="fas fa-store"></i> Ver loja</a></p><button class="btn-buy" ${disponivel?'':'disabled'} onclick="adicionarAoCarrinho('${escapeHtml(prod.id)}')"><i class="fas fa-cart-plus"></i> ${disponivel?'Adicionar ao carrinho':'Esgotado'}</button></article>`;
  }).join('') : `<div class="empty-state"><i class="fas fa-box-open"></i><h3>Nenhum produto encontrado</h3><p>Tente outra pesquisa ou escolha uma categoria diferente.</p></div>`;
}

function filter(categoria) {
  categoriaAtual = categoria;
  document.querySelectorAll('.categories button').forEach(btn => btn.classList.toggle('active', btn.dataset.category === categoria));
  renderizarLoja();
}
window.filter = filter;

function adicionarAoCarrinho(id) {
  const produto = produtos.find(p => String(p.id) === String(id));
  if (!produto || produto.stock < 1) return alert('Este produto está esgotado.');
  const carrinho = JSON.parse(localStorage.getItem('milomercios_cart')) || [];
  const existente = carrinho.find(item => String(item.id) === String(produto.id));
  const quantidadeAtual = Number(existente?.quantidade) || 0;
  if (quantidadeAtual >= produto.stock) return alert(`Só existem ${produto.stock} unidades disponíveis.`);
  if (existente) existente.quantidade = quantidadeAtual + 1;
  else carrinho.push({...produto, quantidade:1});
  localStorage.setItem('milomercios_cart', JSON.stringify(carrinho));
  atualizarContador();
  alert(`Sucesso! ${produto.nome} adicionado ao carrinho.`);
}
window.adicionarAoCarrinho = adicionarAoCarrinho;

function atualizarContador() {
  const carrinho = JSON.parse(localStorage.getItem('milomercios_cart')) || [];
  if (cartCount) cartCount.innerText = carrinho.reduce((total,item)=>total+(Number(item.quantidade)||1),0);
}

async function carregarProdutos() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id,nome,preco,stock,categoria,descricao,imagem_url,vendedor_id')
      .eq('ativo', true)
      .gt('preco', 0)
      .gt('stock', 0);
    if (error) throw error;
    produtos = (data || []).map(normalizarProduto).filter(p => p.vendedorId);
    renderizarLoja();
  } catch(error) {
    console.error(error);
    if (status) status.textContent = 'Erro ao carregar o catálogo';
    app.innerHTML = '<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><h3>Não foi possível carregar os produtos</h3><p>Verifique a ligação e tente novamente.</p></div>';
  }
}

function escapeHtml(v){return String(v??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]);}
window.addEventListener('load',()=>{atualizarContador();if(searchInput)searchInput.addEventListener('input',()=>{pesquisaAtual=searchInput.value.trim();renderizarLoja();});if(sortSelect)sortSelect.addEventListener('change',renderizarLoja);carregarProdutos();});
