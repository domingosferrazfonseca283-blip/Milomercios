import { supabase, currentUser, getProfile } from './supabase-auth.js';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>\'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const money = v => `${Number(v || 0).toLocaleString('pt-AO')} Kz`;
let user;
let products = [];

function sugerir(produto) {
  const categoria = String(produto.categoria || 'outros').toLowerCase();
  const nome = produto.nome || 'este produto';
  const preco = money(produto.preco);
  const mapa = {
    moda: ['Pessoas interessadas em moda, estilo e novidades', ['Instagram', 'Facebook', 'WhatsApp']],
    beleza: ['Pessoas interessadas em beleza, cuidados pessoais e autocuidado', ['Instagram', 'Facebook', 'WhatsApp']],
    tecnologia: ['Pessoas interessadas em tecnologia, gadgets e produtividade', ['Facebook', 'Instagram', 'Google']],
    casa: ['Pessoas interessadas em casa, decoração e organização', ['Facebook', 'Instagram', 'WhatsApp']],
    alimentos: ['Pessoas interessadas em alimentação e produtos locais', ['Instagram', 'Facebook', 'WhatsApp']]
  };
  const [publico, canais] = mapa[categoria] || ['Pessoas que procuram produtos semelhantes e boas oportunidades de compra', ['Facebook', 'Instagram', 'WhatsApp']];
  return {
    publico,
    canais,
    titulo: `${nome}: uma escolha que vale a pena conhecer`,
    texto: `Conheça ${nome}, disponível na Milomércios por ${preco}. Descubra os detalhes, veja a disponibilidade e fale diretamente com o vendedor. Uma oportunidade para quem procura qualidade e praticidade.`,
    chamada: 'Ver produto e comprar'
  };
}

function linkRastreio(campaignId, productId, channel) {
  const url = new URL('rastreio.html', location.href);
  url.searchParams.set('c', campaignId);
  url.searchParams.set('p', productId);
  url.searchParams.set('src', channel.toLowerCase());
  return url.href;
}

async function carregar() {
  user = await currentUser();
  if (!user) return location.href = 'login.html';
  const profile = await getProfile(user.id);
  if (!profile?.subscricao_ativa || profile?.estado_conta !== 'ativo') {
    $('estado-campanha').textContent = 'Ative a conta de vendedor e a subscrição para criar campanhas.';
    $('btn-gerar').disabled = true;
  }
  const { data, error } = await supabase.from('products').select('id,nome,preco,categoria,descricao,imagem_url').eq('vendedor_id', user.id).eq('ativo', true).order('criado_em', { ascending: false });
  if (error) throw error;
  products = data || [];
  $('produto-campanha').innerHTML = products.length
    ? products.map(p => `<option value="${esc(p.id)}">${esc(p.nome)} · ${money(p.preco)}</option>`).join('')
    : '<option value="">Nenhum produto publicado</option>';
  $('btn-gerar').disabled = !products.length || $('btn-gerar').disabled;
  await carregarCampanhas();
}

function renderPreview(c) {
  $('campanha-preview').style.display = 'block';
  $('preview-titulo').textContent = c.titulo;
  $('preview-texto').textContent = c.texto;
  $('preview-publico').textContent = c.publico;
  $('preview-canais').textContent = c.canais.join(' · ');
  $('preview-cta').textContent = c.chamada;
}

$('btn-gerar').onclick = () => {
  const produto = products.find(p => String(p.id) === String($('produto-campanha').value));
  if (!produto) return;
  renderPreview(sugerir(produto));
  $('campanha-nome').value = `Divulgação — ${produto.nome}`;
  $('estado-campanha').textContent = 'Sugestão criada. Reveja o conteúdo antes de guardar.';
};

$('btn-guardar-campanha').onclick = async () => {
  const produto = products.find(p => String(p.id) === String($('produto-campanha').value));
  if (!produto || !$('preview-titulo').textContent) return alert('Gere primeiro uma campanha.');
  const btn = $('btn-guardar-campanha'); btn.disabled = true;
  try {
    const { data, error } = await supabase.from('campaigns').insert({
      vendedor_id: user.id,
      produto_id: produto.id,
      nome: $('campanha-nome').value.trim() || `Divulgação — ${produto.nome}`,
      objetivo: $('campanha-objetivo').value,
      publico: $('preview-publico').textContent,
      canais: $('preview-canais').textContent.split(' · ').filter(Boolean),
      titulo: $('preview-titulo').textContent,
      texto: $('preview-texto').textContent,
      chamada: $('preview-cta').textContent,
      estado: 'rascunho'
    }).select('id').single();
    if (error) throw error;

    const campaignId = data.id;
    const links = (await Promise.resolve($('preview-canais').textContent.split(' · ').filter(Boolean)))
      .map(channel => `${channel}: ${linkRastreio(campaignId, produto.id, channel)}`)
      .join('\n');
    $('estado-campanha').innerHTML = `<strong>Campanha guardada.</strong><br>Links rastreáveis por canal:<br><textarea readonly rows="4" style="width:100%;margin-top:8px">${esc(links)}</textarea>`;
    await carregarCampanhas();
  } catch (e) {
    console.error(e);
    alert('Não foi possível guardar a campanha. Execute a migração de tracking no Supabase.');
  } finally { btn.disabled = false; }
};

async function carregarCampanhas() {
  const { data, error } = await supabase.from('campaigns').select('id,nome,estado,cliques,conversoes,criado_em').eq('vendedor_id', user.id).order('criado_em', { ascending: false });
  if (error) { $('campanhas-lista').innerHTML = '<p>Execute a migração do Centro de Divulgação no Supabase para ativar o histórico.</p>'; return; }
  $('campanhas-lista').innerHTML = (data || []).map(c => {
    const cliques = Number(c.cliques || 0);
    const conversoes = Number(c.conversoes || 0);
    const taxa = cliques ? ((conversoes / cliques) * 100).toFixed(1) : '0.0';
    return `<div class="campaign-row"><strong>${esc(c.nome)}</strong><span>${esc(c.estado)} · ${cliques} cliques · ${conversoes} vendas · ${taxa}% conversão</span></div>`;
  }).join('') || '<p>Ainda não existem campanhas.</p>';
}

carregar().catch(e => { console.error(e); $('estado-campanha').textContent = 'Não foi possível carregar o Centro de Divulgação.'; });
