import { supabase } from './supabase-auth.js';

const ALERTS_KEY = 'milomercios_admin_alerts';
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));

const config = {
  subscription_requests: { label: 'Novo pedido de subscrição', target: '#subscricoes-admin' },
  products: { label: 'Novo produto para aprovação', target: '#produtos-admin' },
  profiles: { label: 'Novo vendedor registado', target: '#vendedores-admin' },
  orders: { label: 'Nova encomenda recebida', target: '#encomendas-admin' }
};

let alerts = JSON.parse(localStorage.getItem(ALERTS_KEY) || '[]');

function save() { localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts.slice(0, 20))); }
function render() {
  let box = $('admin-live-alerts'); if (!box) return;
  if (!alerts.length) { box.innerHTML = '<div class="live-empty">Sem novos alertas nesta sessão.</div>'; return; }
  box.innerHTML = alerts.map((a, i) => `<article class="live-alert"><div><strong>${esc(a.label)}</strong><small>${esc(new Date(a.at).toLocaleString('pt-AO'))}</small></div><div class="live-actions"><a href="${a.target}">Ver</a><button data-remove="${i}" aria-label="Remover alerta">×</button></div></article>`).join('');
  box.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => { alerts.splice(Number(btn.dataset.remove), 1); save(); render(); }));
}

function addAlert(type) {
  const item = config[type]; if (!item) return;
  alerts.unshift({ type, label: item.label, target: item.target, at: new Date().toISOString() });
  alerts = alerts.slice(0, 20); save(); render();
  const alert = $('admin-alert');
  if (alert) { alert.style.display = 'block'; alert.textContent = `🔔 ${item.label}.`; setTimeout(() => { if (alert) alert.style.display = 'none'; }, 7000); }
}

function subscribe(table) {
  const item = config[table];
  return supabase.channel(`admin-live-${table}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, () => addAlert(table))
    .subscribe();
}

function boot() {
  render();
  Object.keys(config).forEach(subscribe);
}

window.limparAlertasAdmin = () => { alerts = []; save(); render(); };
boot();