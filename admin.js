import { supabase, currentUser, signOut, getProfile } from './supabase-auth.js';

const ADMIN_EMAIL = 'domingosferrazfonseca283@gmail.com';
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const money = v => `${Number(v || 0).toLocaleString('pt-AO')} Kz`;
const date = v => { const d = new Date(v); return v && !Number.isNaN(d.getTime()) ? d.toLocaleString('pt-AO') : '—'; };
const statusLabel = v => ({pendente:'Pendente',confirmada:'Confirmada',em_preparacao:'Em preparação',enviada:'Enviada',entregue:'Entregue',cancelada:'Cancelada',rascunho:'Rascunho',ativo:'Ativo',bloqueado:'Bloqueado',aprovado:'Aprovado',rejeitado:'Rejeitado',oculto:'Oculto',pago:'Pago',comprovativo_enviado:'Comprovativo enviado',aguardando_pagamento:'Aguardando pagamento'}[v] || v || '—');
const orderStatuses = ['pendente','confirmada','em_preparacao','enviada','entregue','cancelada'];
let cache = { vendedores: [], produtos: [], pedidos: [], campanhas: [], subscricoes: [] };

async function requireAdmin() {
  const user = await currentUser();
  if (!user) { location.href = 'login.html'; return null; }
  const profile = await getProfile(user.id);
  if (!profile || profile.tipo !== 'admin' || (user.email || '').toLowerCase() !== ADMIN_EMAIL || profile.estado_conta !== 'ativo') {
    alert('Acesso exclusivo do administrador.'); location.href = profile?.tipo === 'vendedor' ? 'vendedor.html' : 'index.html'; return null;
  }
  if ($('admin-email')) $('admin-email').textContent = `Administrador único: ${ADMIN_EMAIL}`;
  return { user, profile };
}

async function adminWrite(table, payload, column, value) {
  const session = await requireAdmin(); if (!session) return false;
  let q = supabase.from(table).update(payload); if (column) q = q.eq(column, value);
  const { error } = await q;
  if (error) { alert(`Não foi possível atualizar: ${error.message}`); return false; }
  return true;
}

async function carregarVendedores() {
  const { data, error } = await supabase.from('profiles').select('*').eq('tipo','vendedor').order('criado_em',{ascending:false});
  if (error) throw error; cache.vendedores = data || [];
  const term = ($('filter-vendedor')?.value || '').toLowerCase(); const estado = $('filter-vendedor-estado')?.value || ''; const sub = $('filter-vendedor-sub')?.value || '';
  const rows = cache.vendedores.filter(v => (!term || `${v.nome_loja||''} ${v.email||''}`.toLowerCase().includes(term)) && (!estado || v.estado_conta === estado) && (!sub || (sub === 'ativa' ? v.subscricao_ativa === true : v.subscricao_ativa !== true)));
  $('vendedores-list').innerHTML = rows.map(v => `<article class="admin-item"><div class="admin-item-main"><h3>${esc(v.nome_loja || 'Sem nome')}</h3><div class="meta">${esc(v.email||'')}<br>Conta: <span class="badge ${v.estado_conta==='ativo'?'good':v.estado_conta==='bloqueado'?'bad':'pending'}">${esc(statusLabel(v.estado_conta||'pendente'))}</span> · Subscrição: ${v.subscricao_ativa?'ativa':'inativa'}</div></div><div class="admin-buttons"><button class="btn-ok" onclick="conta('${esc(v.id)}',${v.estado_conta==='ativo'})">${v.estado_conta==='ativo'?'Bloquear':'Aprovar'}</button><button class="btn-neutral" onclick="sub('${esc(v.id)}',${v.subscricao_ativa===true})">${v.subscricao_ativa?'Retirar':'Conceder'} subscrição</button></div></article>`).join('') || '<div class="empty">Nenhum vendedor encontrado.</div>';
  $('kpi-vendedores').textContent = cache.vendedores.length;
}

async function carregarProdutos() {
  const { data, error } = await supabase.from('products').select('*').order('criado_em',{ascending:false});
  if (error) throw error; cache.produtos = data || [];
  const term = ($('filter-produto')?.value || '').toLowerCase(); const estado = $('filter-produto-estado')?.value || '';
  const rows = cache.produtos.filter(p => (!term || `${p.nome||''} ${p.categoria||''}`.toLowerCase().includes(term)) && (!estado || (p.estado_aprovacao||'pendente') === estado || (estado==='aprovado' && p.ativo===true)));
  $('produtos-admin-list').innerHTML = rows.map(p => `<article class="admin-item"><div class="admin-item-main"><h3>${esc(p.nome||'Produto')}</h3><div class="meta">${money(p.preco)} · Stock ${Math.max(0,Math.floor(Number(p.stock)||0))}<br>Estado: <span class="badge ${p.ativo?'good':(p.estado_aprovacao==='rejeitado'?'bad':'pending')}">${esc(statusLabel(p.ativo?'aprovado':(p.estado_aprovacao||'pendente')))}</span>${p.criado_em?' · '+esc(date(p.criado_em)):''}</div></div><div class="admin-buttons">${p.imagem_url?`<a class="btn-neutral" style="padding:9px 11px;border-radius:9px;text-decoration:none" href="${esc(p.imagem_url)}" target="_blank" rel="noopener">Ver imagem</a>`:''}<button class="btn-ok" onclick="produto('${esc(p.id)}',${p.ativo===true})">${p.ativo?'Ocultar':'Aprovar'}</button>${!p.ativo?`<button class="btn-no" onclick="rejeitarProduto('${esc(p.id)}')">Rejeitar</button>`:''}</div></article>`).join('') || '<div class="empty">Nenhum produto encontrado.</div>';
  $('kpi-produtos').textContent = cache.produtos.length;
}

async function carregarSubscricoes() {
  const { data, error } = await supabase.from('subscription_requests').select('*').order('criado_em',{ascending:false});
  if (error) throw error; cache.subscricoes = data || [];
  const rows = cache.subscricoes; const pending = rows.filter(p => !['pago','rejeitado'].includes(p.estado));
  $('subscricoes-list').innerHTML = rows.map(p => { const estado=p.estado||'aguardando_pagamento'; return `<article class="admin-item"><div class="admin-item-main"><h3>${esc(p.email||p.vendedor_id||'Vendedor')}</h3><div class="meta">Plano ${esc(p.plano||'mensal')} · ${money(p.valor)}<br>Estado: <span class="badge ${estado==='pago'?'good':estado==='rejeitado'?'bad':'pending'}">${esc(statusLabel(estado))}</span> · ${esc(date(p.criado_em))}${p.comprovativo_enviado_em?' · Enviado '+esc(date(p.comprovativo_enviado_em)):''}${p.comprovativo_imagem?`<br><a href="${esc(p.comprovativo_imagem)}" target="_blank" rel="noopener">Abrir comprovativo</a>`:'<br>Sem comprovativo'}</div></div><div class="admin-buttons">${estado==='pago'?'<strong>Confirmado</strong>':`<button class="btn-ok" onclick="pagar('${esc(p.id)}','${esc(p.vendedor_id)}','${esc(p.plano||'mensal')}')">Confirmar pagamento</button><button class="btn-no" onclick="rejeitar('${esc(p.id)}')">Rejeitar</button>`}</div></article>`; }).join('') || '<div class="empty">Nenhum pedido de subscrição.</div>';
  return pending.length;
}

async function carregarPedidos() {
  const { data, error } = await supabase.from('orders').select('*').order('criado_em',{ascending:false}).limit(100);
  if (error) throw error; cache.pedidos=data||[];
  const term=($('filter-encomenda')?.value||'').toLowerCase(); const estado=$('filter-encomenda-estado')?.value||'';
  const rows=cache.pedidos.filter(p => (!estado || (p.estado||p.status||'pendente')===estado) && (!term || JSON.stringify(p).toLowerCase().includes(term)));
  const total = cache.pedidos.reduce((n,p)=>n+Number(p.total||p.valor_total||0),0);
  if ($('kpi-volume')) $('kpi-volume').textContent=money(total);
  $('encomendas-admin-list').innerHTML=rows.map(p=>{const st=p.estado||p.status||'pendente'; const safeId=esc(p.id); return `<article class="admin-item"><div class="admin-item-main"><h3>Encomenda #${safeId}</h3><div class="meta">Cliente: ${esc(p.customer?.nome||p.customer?.name||p.cliente_id||'—')}<br>Total: <span class="order-total">${money(p.total||p.valor_total)}</span> · <span class="badge ${st==='entregue'?'good':st==='cancelada'?'bad':'pending'}">${esc(statusLabel(st))}</span><br>${esc(date(p.criado_em))}</div></div><div class="admin-buttons"><select aria-label="Estado da encomenda #${safeId}" id="estado-${safeId}">${orderStatuses.map(s=>`<option value="${s}" ${s===st?'selected':''}>${statusLabel(s)}</option>`).join('')}</select><button class="btn-ok" onclick="estadoEncomenda('${safeId}')">Guardar estado</button><a class="btn-neutral" style="padding:9px 11px;border-radius:9px;text-decoration:none" href="encomenda.html?id=${encodeURIComponent(p.id)}">Acompanhar</a></div></article>`;}).join('')||'<div class="empty">Nenhuma encomenda encontrada.</div>';
  $('kpi-encomendas').textContent=cache.pedidos.length;
}

async function carregarCampanhas() {
  const { data, error } = await supabase.from('campaigns').select('*').order('criado_em',{ascending:false}).limit(100);
  if (error) throw error; cache.campanhas=data||[];
  const conv=cache.campanhas.reduce((n,c)=>n+Number(c.conversoes||0),0);
  $('kpi-conversoes').textContent=conv;
  $('campanhas-admin-list').innerHTML=cache.campanhas.map(c=>`<article class="admin-item"><div class="admin-item-main"><h3>${esc(c.nome||'Campanha')}</h3><div class="meta">Vendedor: ${esc(c.vendedor_id)}<br>${Number(c.cliques||0)} cliques · ${Number(c.conversoes||0)} conversões · ${Number(c.cliques||0)?((Number(c.conversoes||0)/Number(c.cliques||0))*100).toFixed(1):'0'}% conversão<br>Estado: ${esc(statusLabel(c.estado))}</div></div></article>`).join('')||'<div class="empty">Nenhuma campanha encontrada.</div>';
}

async function refresh() {
  const admin=await requireAdmin(); if(!admin) return;
  const results=await Promise.allSettled([carregarVendedores(),carregarProdutos(),carregarSubscricoes(),carregarPedidos(),carregarCampanhas()]);
  const failed=results.filter(r=>r.status==='rejected');
  const pendingVendedores=cache.vendedores.filter(v=>v.estado_conta!=='ativo').length;
  const pendingProdutos=cache.produtos.filter(p=>!p.ativo).length;
  const pendingSubscricoes=cache.subscricoes.filter(p=>!['pago','rejeitado'].includes(p.estado)).length;
  $('kpi-pendentes').textContent=pendingVendedores+pendingProdutos+pendingSubscricoes;
  const alert=$('admin-alert'); if(failed.length){alert.style.display='block';alert.textContent=`Algumas áreas não puderam ser carregadas (${failed.length}). Verifique as tabelas/RLS do Supabase.`;}else{alert.style.display='none';}
}

window.conta=async(id,ativa)=>{if(!confirm(ativa?'Bloquear este vendedor?':'Aprovar este vendedor?'))return;if(await adminWrite('profiles',{estado_conta:ativa?'bloqueado':'ativo',atualizado_em:new Date().toISOString()},'id',id))refresh();};
window.sub=async(id,ativa)=>{if(await adminWrite('profiles',{subscricao_ativa:!ativa,atualizado_em:new Date().toISOString()},'id',id))refresh();};
window.produto=async(id,ativo)=>{if(await adminWrite('products',{ativo:!ativo,estado_aprovacao:!ativo?'aprovado':'oculto',atualizado_em:new Date().toISOString()},'id',id))refresh();};
window.rejeitarProduto=async id=>{if(!confirm('Rejeitar este produto?'))return;if(await adminWrite('products',{ativo:false,estado_aprovacao:'rejeitado',atualizado_em:new Date().toISOString()},'id',id))refresh();};
window.pagar=async(id,vendedor,plano)=>{const d=new Date();plano==='semanal'?d.setDate(d.getDate()+7):d.setMonth(d.getMonth()+1);if(!await adminWrite('subscription_requests',{estado:'pago',pago_em:new Date().toISOString(),aprovado_por:ADMIN_EMAIL},'id',id))return;if(!await adminWrite('profiles',{subscricao_ativa:true,plano_subscricao:plano,proxima_cobranca_em:d.toISOString(),estado_conta:'ativo',atualizado_em:new Date().toISOString()},'id',vendedor))return;alert('Pagamento confirmado e vendedor ativado.');refresh();};
window.rejeitar=async id=>{if(!confirm('Rejeitar este pedido?'))return;if(await adminWrite('subscription_requests',{estado:'rejeitado',rejeitado_em:new Date().toISOString(),rejeitado_por:ADMIN_EMAIL},'id',id))refresh();};
window.estadoEncomenda=async id=>{const select=$(`estado-${id}`); const estado=select?.value; if(!orderStatuses.includes(estado)){alert('Estado inválido.');return;} if(!confirm(`Alterar a encomenda #${id} para “${statusLabel(estado)}”?`))return; if(await adminWrite('orders',{estado,status:estado,atualizado_em:new Date().toISOString()},'id',id)){alert('Estado da encomenda atualizado.');refresh();}};

$('btn-admin-refresh')?.addEventListener('click',refresh); $('btn-admin-logout')?.addEventListener('click',async()=>{await signOut();location.href='login.html';});
['filter-vendedor','filter-vendedor-estado','filter-vendedor-sub','filter-produto','filter-produto-estado','filter-encomenda','filter-encomenda-estado'].forEach(id=>$(id)?.addEventListener('input',()=>{ if(id.startsWith('filter-vendedor')) carregarVendedores(); else if(id.startsWith('filter-produto')) carregarProdutos(); else carregarPedidos(); }));
refresh();