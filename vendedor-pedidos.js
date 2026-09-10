const pedidos = document.getElementById('pedidos-list');

function adicionarLinksDetalhe(){
  pedidos?.querySelectorAll('.seller-order-row').forEach(row => {
    if (row.querySelector('[data-order-detail]')) return;
    const id = row.dataset.orderId;
    if (!id) return;
    const area = row.querySelector('[data-order-status]')?.parentElement;
    if (!area) return;
    const link = document.createElement('a');
    link.href = `vendedor-encomenda.html?id=${encodeURIComponent(id)}`;
    link.dataset.orderDetail = '1';
    link.innerHTML = '<i class="fas fa-eye"></i> Ver detalhes';
    link.style.cssText = 'display:block;margin-top:8px;text-align:center;padding:8px 10px;border:1px solid var(--linha);border-radius:9px;text-decoration:none;font-weight:800;color:var(--primaria);background:#f7f9fb';
    area.appendChild(link);
  });
}

if (pedidos) {
  new MutationObserver(adicionarLinksDetalhe).observe(pedidos,{childList:true,subtree:true});
  adicionarLinksDetalhe();
}
