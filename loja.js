import { supabase } from './supabase-config.js';

const esc = v => String(v ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money = v => `${Number(v || 0).toLocaleString('pt-AO')} Kz`;
const el = id => document.getElementById(id);

function cartCount() {
  const c = JSON.parse(localStorage.getItem('milomercios_cart')) || [];
  const count = el('cart-count');
  if (count) count.textContent = c.reduce((t, i) => t + (Number(i.quantidade) || 1), 0);
}

function add(p) {
  const c = JSON.parse(localStorage.getItem('milomercios_cart')) || [];
  const i = c.find(x => String(x.id) === String(p.id));
  const q = Number(i?.quantidade) || 0;
  if (q >= p.stock) return alert(`Só existem ${p.stock} unidades disponíveis.`);
  if (i) i.quantidade = q + 1;
  else c.push({ ...p, quantidade: 1 });
  localStorage.setItem('milomercios_cart', JSON.stringify(c));
  cartCount();
  alert('Produto adicionado ao carrinho.');
}

async function carregar() {
  cartCount();
  const sellerId = new URLSearchParams(location.search).get('id');
  const head = el('store-head');
  const products = el('products');

  if (!sellerId) {
    head.innerHTML = '<div><h1>Loja não encontrada</h1><p>Identificador do vendedor em falta.</p></div>';
    products.innerHTML = '';
    return;
  }

  try {
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id,nome_loja,descricao,localizacao,telefone,whatsapp,imagem_url')
      .eq('id', sellerId)
      .maybeSingle();

    if (storeError) throw storeError;

    if (!store) {
      head.innerHTML = '<div><h1>Loja ainda não configurada</h1><p>Este vendedor ainda não criou o perfil público.</p></div>';
    } else {
      const nome = store.nome_loja || 'Loja do vendedor';
      const imagem = store.imagem_url || '';
      head.innerHTML = `${imagem ? `<img class="store-logo" src="${esc(imagem)}" alt="${esc(nome)}">` : '<div class="store-avatar"><i class="fas fa-store"></i></div>'}<div><h1>${esc(nome)}</h1>${store.descricao ? `<p>${esc(store.descricao)}</p>` : '<p>Produtos disponíveis no Milomércios</p>'}${store.localizacao ? `<div class="store-meta"><i class="fas fa-location-dot"></i> ${esc(store.localizacao)}</div>` : ''}${store.telefone ? `<div class="store-meta"><i class="fas fa-phone"></i> ${esc(store.telefone)}</div>` : ''}${store.whatsapp ? `<div class="store-actions"><a class="store-contact" href="https://wa.me/${encodeURIComponent(store.whatsapp.replace(/\D/g,''))}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> WhatsApp</a></div>` : ''}</div>`;
      document.title = `${nome} | Milomércios`;
    }

    if (head) head.setAttribute('data-seller', sellerId);

    const { data: rows, error: productsError } = await supabase
      .from('products')
      .select('id,nome,preco,stock,categoria,descricao,imagem_url,vendedor_id')
      .eq('vendedor_id', sellerId)
      .eq('ativo', true);

    if (productsError) throw productsError;

    const lista = (rows || []).map(p => ({
      id: p.id,
      nome: p.nome || 'Produto sem nome',
      preco: Number(p.preco || 0),
      stock: Math.max(0, Math.floor(Number(p.stock) || 0)),
      img: p.imagem_url || '',
      descricao: p.descricao || '',
      vendedorId: p.vendedor_id || sellerId
    })).filter(p => p.preco > 0);

    products.innerHTML = lista.length ? lista.map(p => {
      const img = p.img ? `<img src="${esc(p.img)}" alt="${esc(p.nome)}" loading="lazy">` : '<div class="placeholder"><i class="fas fa-image"></i></div>';
      return `<article class="store-card">${img}<h3><a href="produto.html?id=${encodeURIComponent(p.id)}">${esc(p.nome)}</a></h3><p class="price">${money(p.preco)}</p><p class="${p.stock ? 'stock-ok' : 'stock-out'}">${p.stock ? `${p.stock} em stock` : 'Esgotado'}</p><button class="btn-buy" ${p.stock ? '' : 'disabled'} data-id="${esc(p.id)}">${p.stock ? 'Adicionar ao carrinho' : 'Esgotado'}</button></article>`;
    }).join('') : '<div class="store-empty"><i class="fas fa-box-open"></i><h3>Nenhum produto publicado</h3><p>Esta loja ainda não tem produtos disponíveis.</p></div>';

    products.querySelectorAll('button[data-id]').forEach(b => {
      b.onclick = () => {
        const p = lista.find(x => x.id === b.dataset.id);
        if (p) add(p);
      };
    });
  } catch (e) {
    console.error(e);
    products.innerHTML = '<div class="store-empty"><i class="fas fa-triangle-exclamation"></i><h3>Não foi possível carregar a loja</h3><p>Tente novamente.</p></div>';
  }
}

carregar();
