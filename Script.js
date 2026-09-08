import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

let produtos = [];
const app = document.getElementById('app');
const cartCount = document.getElementById('cart-count');
let categoriaAtual = 'todos';

function normalizarProduto(id, data) {
  return {
    id,
    nome: data.nome || 'Produto sem nome',
    preco: Number(data.preco || 0),
    stock: Math.max(0, Math.floor(Number(data.stock) || 0)),
    categoria: String(data.categoria || 'outros').toLowerCase(),
    descricao: data.descricao || '',
    img: data.img || data.imagemUrl || '',
    vendedorId: data.vendedorId || ''
  };
}

function renderizarLoja() {
  const lista = categoriaAtual === 'todos' ? produtos : produtos.filter(p => p.categoria === categoriaAtual);
  app.innerHTML = lista.length ? lista.map(prod => {
    const disponivel = prod.stock > 0;
    return `<div class="product-card">
      ${prod.img ? `<img src="${escapeHtml(prod.img)}" alt="${escapeHtml(prod.nome)}">` : '<div style="height:180px;display:flex;align-items:center;justify-content:center;background:#f1f3f5">Sem imagem</div>'}
      <h3>${escapeHtml(prod.nome)}</h3>
      <p>${Number(prod.preco).toLocaleString('pt-AO')} Kz</p>
      <p>${disponivel ? `Stock disponível: ${prod.stock}` : 'Esgotado'}</p>
      ${prod.descricao ? `<p>${escapeHtml(prod.descricao)}</p>` : ''}
      <button class="btn-buy" ${disponivel ? '' : 'disabled'} onclick="adicionarAoCarrinho('${escapeHtml(prod.id)}')"><i class="fas fa-cart-plus"></i> ${disponivel ? 'Comprar' : 'Esgotado'}</button>
    </div>`;
  }).join('') : '<p style="padding:20px">Nenhum produto aprovado nesta categoria.</p>';
}

function filter(categoria) { categoriaAtual = categoria; renderizarLoja(); }
window.filter = filter;

function adicionarAoCarrinho(id) {
  const produto = produtos.find(p => String(p.id) === String(id));
  if (!produto || produto.stock < 1) return alert('Este produto está esgotado.');
  const carrinho = JSON.parse(localStorage.getItem('milomercios_cart')) || [];
  const existente = carrinho.find(item => String(item.id) === String(produto.id));
  const quantidadeAtual = Number(existente?.quantidade) || 0;
  if (quantidadeAtual >= produto.stock) return alert(`Só existem ${produto.stock} unidades disponíveis.`);
  if (existente) existente.quantidade = quantidadeAtual + 1;
  else carrinho.push({ ...produto, quantidade: 1 });
  localStorage.setItem('milomercios_cart', JSON.stringify(carrinho));
  atualizarContador();
  alert(`Sucesso! ${produto.nome} adicionado ao carrinho.`);
}
window.adicionarAoCarrinho = adicionarAoCarrinho;

function atualizarContador() {
  const carrinho = JSON.parse(localStorage.getItem('milomercios_cart')) || [];
  cartCount.innerText = carrinho.reduce((total, item) => total + (Number(item.quantidade) || 1), 0);
}

async function carregarProdutos() {
  try {
    const snapshot = await getDocs(query(collection(db, 'produtos'), where('ativo', '==', true)));
    produtos = snapshot.docs.map(doc => normalizarProduto(doc.id, doc.data())).filter(p => p.preco > 0 && p.vendedorId);
    renderizarLoja();
  } catch (error) {
    console.error(error);
    app.innerHTML = '<p style="padding:20px">Não foi possível carregar os produtos. Tente novamente.</p>';
  }
}

function escapeHtml(v) { return String(v ?? '').replace(/[&<>'\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[c]); }
window.addEventListener('load', () => { atualizarContador(); carregarProdutos(); });
