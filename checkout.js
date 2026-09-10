import { supabase } from './supabase-config.js';
import { currentUser } from './supabase-auth.js';

const app = document.getElementById('checkout-app');
const cartKey = 'milomercios_cart';
const orderKey = 'milomercios_order';
let itensCarrinho = carregarCarrinho();
let utilizador = null;

const money = value => `${Number(value || 0).toLocaleString('pt-AO')} Kz`;

function carregarCarrinho() {
  try {
    const bruto = JSON.parse(localStorage.getItem(cartKey) || '[]');
    if (!Array.isArray(bruto)) return [];
    return bruto
      .map(item => ({
        ...item,
        quantidade: Math.max(1, Math.floor(Number(item.quantidade) || 1)),
        preco: Number(item.preco) || 0,
        vendedorId: String(item.vendedorId || '').trim()
      }))
      .filter(item => item.id && item.nome && item.preco > 0);
  } catch {
    return [];
  }
}

function calcularTotal(items) {
  return items.reduce((sum, item) => sum + item.preco * item.quantidade, 0);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'\"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[char]);
}

function render() {
  itensCarrinho = carregarCarrinho();

  if (!itensCarrinho.length) {
    app.innerHTML = `<section class="card success"><h2>Carrinho vazio</h2><p>Adicione produtos antes de continuar para o checkout.</p><a class="btn" href="index.html">Voltar à loja</a></section>`;
    return;
  }

  const total = calcularTotal(itensCarrinho);
  app.innerHTML = `<div class="grid"><section class="card"><h2>Dados do cliente</h2><form id="customer-form"><label>Nome completo *</label><input name="nome" required><div class="row"><div><label>Telefone *</label><input name="telefone" type="tel" required></div><div><label>E-mail</label><input name="email" type="email"></div></div><label>Morada / endereço *</label><textarea name="morada" required></textarea><label>Método de pagamento *</label><select name="pagamento" required><option value="">Selecione...</option><option value="transferencia">Transferência bancária</option><option value="multicaixa">Multicaixa / referência</option><option value="entrega">Pagamento na entrega</option></select><button class="btn" type="submit">Confirmar encomenda</button></form></section><aside class="card"><h2>Resumo da compra</h2>${itensCarrinho.map(item => `<div class="item"><span>${escapeHtml(item.nome)} × ${item.quantidade}</span><strong>${money(item.preco * item.quantidade)}</strong></div>`).join('')}<div class="total"><span>Total</span><span>${money(total)}</span></div><p>Preço e stock serão confirmados no servidor no momento da encomenda.</p></aside></div>`;
  document.getElementById('customer-form').addEventListener('submit', submitOrder);
}

async function submitOrder(event) {
  event.preventDefault();

  if (!utilizador) {
    alert('Inicie sessão para finalizar a encomenda.');
    location.href = 'login.html';
    return;
  }

  itensCarrinho = carregarCarrinho();
  if (!itensCarrinho.length) {
    render();
    return;
  }

  const form = new FormData(event.currentTarget);
  const customer = Object.fromEntries(form.entries());
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  button.textContent = 'A confirmar stock...';

  try {
    const { data, error } = await supabase.rpc('criar_encomenda_segura', {
      p_customer: customer,
      p_payment_method: customer.pagamento,
      p_items: itensCarrinho.map(item => ({ id: item.id, quantidade: item.quantidade }))
    });

    if (error) throw error;

    const result = typeof data === 'string' ? JSON.parse(data) : data;
    const order = {
      ...result,
      customer,
      paymentMethod: customer.pagamento,
      criadoEm: new Date().toISOString()
    };

    localStorage.setItem(orderKey, JSON.stringify(order));
    localStorage.removeItem(cartKey);
    renderConfirmation(order);
  } catch (error) {
    console.error(error);
    alert(error?.message || 'Não foi possível registar a encomenda.');
    button.disabled = false;
    button.textContent = 'Confirmar encomenda';
  }
}

function renderConfirmation(order) {
  app.innerHTML = `<section class="card success"><h2>Encomenda registada! ✅</h2><p>Obrigado, <strong>${escapeHtml(order.customer.nome)}</strong>.</p><p>Número da encomenda: <strong>${escapeHtml(order.orderId)}</strong></p><p>Total: <strong>${money(order.total)}</strong></p><p>Método escolhido: <strong>${escapeHtml(order.paymentMethod)}</strong></p><a class="btn" href="index.html">Voltar à loja</a></section>`;
}

async function init() {
  try {
    utilizador = await currentUser();
  } catch (error) {
    console.error(error);
    utilizador = null;
  }
  render();
}

init();
