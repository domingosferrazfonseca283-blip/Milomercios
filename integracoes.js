import { supabase, currentUser } from './supabase-auth.js';

const providers = [
  { id: 'instagram', name: 'Instagram / Facebook', description: 'Publicação através das APIs oficiais da Meta.' },
  { id: 'whatsapp', name: 'WhatsApp Business', description: 'Contacto e mensagens através da API oficial da Meta.' },
  { id: 'google_ads', name: 'Google Ads', description: 'Campanhas através da API oficial do Google Ads.' },
  { id: 'tiktok', name: 'TikTok', description: 'Publicação através da Content Posting API oficial.' }
];

const statusEl = document.getElementById('integracoes-status');
const listEl = document.getElementById('integracoes-lista');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

async function carregar() {
  const user = await currentUser();
  if (!user) {
    statusEl.textContent = 'Inicie sessão como vendedor para gerir integrações.';
    listEl.innerHTML = '<p><a href="index.html">Voltar à página inicial</a></p>';
    return;
  }

  const { data, error } = await supabase
    .from('seller_integrations')
    .select('provider,external_account_id,status,scopes,updated_at')
    .eq('seller_id', user.id);

  if (error && error.code !== '42P01') {
    statusEl.textContent = `Não foi possível carregar as integrações: ${error.message}`;
    return;
  }

  const connected = new Map((data || []).map(item => [item.provider, item]));
  statusEl.textContent = 'Escolha uma plataforma para iniciar a autorização oficial.';
  listEl.innerHTML = providers.map(provider => {
    const item = connected.get(provider.id);
    const state = item?.status === 'connected' ? 'Ligada' : 'Não ligada';
    const action = item?.status === 'connected' ? 'Gerir conta' : 'Ligar conta';
    return `<article class="card" style="margin:12px 0;padding:18px">
      <h4>${escapeHtml(provider.name)}</h4>
      <p>${escapeHtml(provider.description)}</p>
      <p><strong>Estado:</strong> ${state}</p>
      <button class="btn" data-provider="${provider.id}">${action}</button>
    </article>`;
  }).join('');

  listEl.querySelectorAll('[data-provider]').forEach(button => {
    button.addEventListener('click', () => iniciarOAuth(button.dataset.provider));
  });
}

async function iniciarOAuth(provider) {
  const button = document.querySelector(`[data-provider="${provider}"]`);
  button.disabled = true;
  try {
    const user = await currentUser();
    if (!user) throw new Error('Sessão expirada. Entre novamente.');

    const response = await fetch(`/api/integrations/${encodeURIComponent(provider)}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sellerId: user.id, returnTo: `${location.origin}/integracoes.html` })
    });

    if (!response.ok) throw new Error('O servidor OAuth ainda não está configurado para esta plataforma.');
    const result = await response.json();
    if (!result.url) throw new Error('O servidor não devolveu o endereço de autorização.');
    location.href = result.url;
  } catch (error) {
    statusEl.textContent = error.message;
    button.disabled = false;
  }
}

carregar();
