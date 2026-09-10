import { supabase } from './supabase-config.js';

const params = new URLSearchParams(location.search);
const campaignId = params.get('c');
const productId = params.get('p');
const channel = (params.get('src') || 'outro').toLowerCase().slice(0, 40);
const attributionKey = 'milomercios_attribution';
const sessionKey = 'milomercios_tracking_session';

function sessionId() {
  let value = localStorage.getItem(sessionKey);
  if (!value) {
    value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(sessionKey, value);
  }
  return value;
}

async function track() {
  if (!campaignId || !productId) throw new Error('Link de campanha inválido.');

  const attribution = {
    campaignId,
    productId,
    channel,
    sessionId: sessionId(),
    capturedAt: new Date().toISOString()
  };
  localStorage.setItem(attributionKey, JSON.stringify(attribution));

  const { error } = await supabase.rpc('registar_clique_campanha', {
    p_campaign_id: campaignId,
    p_product_id: productId,
    p_channel: channel,
    p_session_id: attribution.sessionId
  });
  if (error) console.warn('Rastreio de clique não disponível:', error.message);

  location.replace(`produto.html?id=${encodeURIComponent(productId)}`);
}

track().catch(error => {
  console.error(error);
  location.replace(productId ? `produto.html?id=${encodeURIComponent(productId)}` : 'index.html');
});
