const products=[
 {name:'Smartphone Pro X',price:189900,tag:'Tecnologia',icon:'📱',description:'Smartphone moderno para trabalho, comunicação, entretenimento e uso diário.'},
 {name:'Kit Escritório Criativo',price:24900,tag:'Casa & Escritório',icon:'🖊️',description:'Kit prático para organizar o seu espaço de trabalho e estimular a criatividade.'},
 {name:'Guia do Empreendedor Digital',price:7500,tag:'eBook',icon:'📚',description:'eBook com orientações práticas para começar e organizar um negócio digital.'},
 {name:'Curso de Marketing Online',price:12900,tag:'Digital',icon:'💻',description:'Conteúdo introdutório para aprender estratégias de marketing e divulgação online.'}
];

const money=value=>new Intl.NumberFormat('pt-AO').format(value)+' Kz';
const grid=document.getElementById('productGrid');
const cartCount=document.getElementById('cartCount');
const cartItems=document.getElementById('cartItems');
const cartTotal=document.getElementById('cartTotal');
const overlay=document.getElementById('overlay');
const cartPanel=document.getElementById('cartPanel');
const productModal=document.getElementById('productModal');
let cart=JSON.parse(localStorage.getItem('milomercios_cart')||'[]');
let selectedProduct=0;

function saveCart(){localStorage.setItem('milomercios_cart',JSON.stringify(cart));renderCart();}
function cartQuantity(){return cart.reduce((sum,item)=>sum+item.qty,0);}
function addToCart(id){const item=cart.find(x=>x.id===id);if(item)item.qty++;else cart.push({id,qty:1});saveCart();}
function changeQty(id,delta){const item=cart.find(x=>x.id===id);if(!item)return;item.qty+=delta;if(item.qty<=0)cart=cart.filter(x=>x.id!==id);saveCart();}
function renderCart(){
 cartCount.textContent=cartQuantity();
 if(!cart.length){cartItems.innerHTML='<div class="empty-cart">🛒<h3>O seu carrinho está vazio</h3><p>Adicione produtos para começar a sua compra.</p></div>';cartTotal.textContent='0 Kz';return;}
 let total=0;
 cartItems.innerHTML=cart.map(item=>{const p=products[item.id];total+=p.price*item.qty;return `<div class="cart-row"><div class="cart-row-art">${p.icon}</div><div><h4>${p.name}</h4><p>${money(p.price*item.qty)}</p><div class="qty"><button data-minus="${item.id}">−</button><strong>${item.qty}</strong><button data-plus="${item.id}">+</button></div><button class="remove" data-remove="${item.id}">Remover</button></div></div>`}).join('');
 cartTotal.textContent=money(total);
 cartItems.querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>changeQty(Number(b.dataset.minus),-1));
 cartItems.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>changeQty(Number(b.dataset.plus),1));
 cartItems.querySelectorAll('[data-remove]').forEach(b=>{b.onclick=()=>{cart=cart.filter(x=>x.id!==Number(b.dataset.remove));saveCart();}});
}

function openCart(){cartPanel.classList.add('open');cartPanel.setAttribute('aria-hidden','false');overlay.classList.add('show');document.body.classList.add('lock');}
function closePanels(){cartPanel.classList.remove('open');cartPanel.setAttribute('aria-hidden','true');productModal.classList.remove('show');productModal.setAttribute('aria-hidden','true');overlay.classList.remove('show');document.body.classList.remove('lock');}
function openProduct(id){
 selectedProduct=id;const p=products[id];
 document.getElementById('modalArt').textContent=p.icon;
 document.getElementById('modalTag').textContent=p.tag;
 document.getElementById('modalName').textContent=p.name;
 document.getElementById('modalPrice').textContent=money(p.price);
 document.getElementById('modalDescription').textContent=p.description;
 productModal.classList.add('show');productModal.setAttribute('aria-hidden','false');overlay.classList.add('show');document.body.classList.add('lock');
}

grid.innerHTML=products.map((p,i)=>`<article class="product"><div class="product-art" data-product="${i}">${p.icon}</div><div class="product-info"><span class="tag">${p.tag}</span><h3 data-product="${i}">${p.name}</h3><div class="price">${money(p.price)}</div><button class="add" data-add="${i}">Adicionar ao carrinho</button></div></article>`).join('');

grid.querySelectorAll('[data-product]').forEach(el=>el.addEventListener('click',()=>openProduct(Number(el.dataset.product))));
grid.querySelectorAll('[data-add]').forEach(btn=>btn.addEventListener('click',()=>{addToCart(Number(btn.dataset.add));btn.textContent='✓ Adicionado';setTimeout(()=>btn.textContent='Adicionar ao carrinho',900)}));
document.getElementById('cartBtn').addEventListener('click',openCart);
document.getElementById('closeCart').addEventListener('click',closePanels);
document.getElementById('closeProduct').addEventListener('click',closePanels);
overlay.addEventListener('click',closePanels);
document.getElementById('modalAdd').addEventListener('click',()=>{addToCart(selectedProduct);closePanels();openCart();});
document.getElementById('checkoutBtn').addEventListener('click',()=>{if(!cart.length){alert('Adicione pelo menos um produto ao carrinho.');return;}alert('O carrinho está pronto! O próximo passo será ligar o checkout e o pagamento.');});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePanels();});
renderCart();
