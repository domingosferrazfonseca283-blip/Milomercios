const products=[
 {name:'Smartphone Pro X',price:'189.900 Kz',tag:'Tecnologia',icon:'📱'},
 {name:'Kit Escritório Criativo',price:'24.900 Kz',tag:'Casa & Escritório',icon:'🖊️'},
 {name:'Guia do Empreendedor Digital',price:'7.500 Kz',tag:'eBook',icon:'📚'},
 {name:'Curso de Marketing Online',price:'12.900 Kz',tag:'Digital',icon:'💻'}
];
let cart=0;
const grid=document.getElementById('productGrid');
products.forEach((p,i)=>{grid.insertAdjacentHTML('beforeend',`<article class="product"><div class="product-art">${p.icon}</div><div class="product-info"><span class="tag">${p.tag}</span><h3>${p.name}</h3><div class="price">${p.price}</div><button class="add" data-id="${i}">Adicionar ao carrinho</button></div></article>`)});
document.querySelectorAll('.add').forEach(btn=>btn.addEventListener('click',()=>{cart++;document.getElementById('cartCount').textContent=cart;btn.textContent='✓ Adicionado';setTimeout(()=>btn.textContent='Adicionar ao carrinho',900)}));
document.getElementById('cartBtn').addEventListener('click',()=>alert(cart?`Você tem ${cart} item(ns) no carrinho.`:'O seu carrinho está vazio.'));
