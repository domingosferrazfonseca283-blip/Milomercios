const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { createClient } = require('@supabase/supabase-js');

initializeApp();
setGlobalOptions({ region: 'africa-south1', maxInstances: 10 });
const db = getFirestore();
const SUPABASE_SERVICE_ROLE_KEY = defineSecret('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_URL = 'https://bnrypbkenfvzvugilrfi.supabase.co';
const ADMIN_EMAIL = 'domingosferrazfonseca283@gmail.com';
const PROOF_BUCKET = 'milomercios';
const IMAGE_BUCKET = 'milomercios-imagens';

function cleanText(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function getSupabase() { return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.value(), { auth: { persistSession: false, autoRefreshToken: false } }); }

async function isAdmin(request) {
  if (!request.auth?.token?.email_verified || request.auth.token.email !== ADMIN_EMAIL) return false;
  const snap = await db.collection('usuarios').doc(request.auth.uid).get();
  return snap.exists && snap.data().tipo === 'admin';
}

exports.criarUploadAssinado = onCall({ secrets: [SUPABASE_SERVICE_ROLE_KEY] }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Inicie sessão para enviar ficheiros.');
  const data = request.data || {};
  const bucket = cleanText(data.bucket, 80);
  const path = cleanText(data.path, 500);
  if (![PROOF_BUCKET, IMAGE_BUCKET].includes(bucket)) throw new HttpsError('invalid-argument', 'Bucket inválido.');
  if (!path || path.includes('..') || path.startsWith('/')) throw new HttpsError('invalid-argument', 'Caminho inválido.');

  const admin = await isAdmin(request);
  if (!admin && !path.startsWith(`${request.auth.uid}/`) && !path.startsWith(`comprovativos/${request.auth.uid}/`) && !path.startsWith(`produtos/${request.auth.uid}/`)) {
    throw new HttpsError('permission-denied', 'Não pode enviar este ficheiro.');
  }
  if (bucket === PROOF_BUCKET && !admin && !path.startsWith(`comprovativos/${request.auth.uid}/`)) throw new HttpsError('permission-denied', 'Caminho de comprovativo inválido.');
  if (bucket === IMAGE_BUCKET && !admin && !path.startsWith(`produtos/${request.auth.uid}/`)) throw new HttpsError('permission-denied', 'Caminho de imagem inválido.');

  const { data: signed, error } = await getSupabase().storage.from(bucket).createSignedUploadUrl(path);
  if (error) throw new HttpsError('internal', 'Não foi possível preparar o envio: ' + error.message);
  return { path, token: signed.token };
});

exports.obterUrlComprovativo = onCall({ secrets: [SUPABASE_SERVICE_ROLE_KEY] }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Inicie sessão.');
  const path = cleanText(request.data?.path, 500);
  if (!path || !path.startsWith('comprovativos/')) throw new HttpsError('invalid-argument', 'Comprovativo inválido.');
  const admin = await isAdmin(request);
  if (!admin && !path.startsWith(`comprovativos/${request.auth.uid}/`)) throw new HttpsError('permission-denied', 'Sem permissão para ver este comprovativo.');
  const { data, error } = await getSupabase().storage.from(PROOF_BUCKET).createSignedUrl(path, 3600);
  if (error) throw new HttpsError('not-found', 'Comprovativo não encontrado.');
  return { url: data.signedUrl };
});

exports.criarEncomenda = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'É necessário iniciar sessão para comprar.');
  const data = request.data || {}, rawItems = Array.isArray(data.items) ? data.items : [], customer = data.customer && typeof data.customer === 'object' ? data.customer : {}, paymentMethod = cleanText(data.paymentMethod, 40);
  if (!rawItems.length) throw new HttpsError('invalid-argument', 'O carrinho está vazio.');
  if (!['transferencia', 'multicaixa', 'entrega'].includes(paymentMethod)) throw new HttpsError('invalid-argument', 'Método de pagamento inválido.');
  const requested = new Map();
  for (const item of rawItems) { const id = cleanText(item?.id, 150), quantidade = Math.floor(Number(item?.quantidade)); if (!id || !Number.isFinite(quantidade) || quantidade < 1 || quantidade > 999) throw new HttpsError('invalid-argument', 'Há um item com quantidade inválida.'); requested.set(id, (requested.get(id) || 0) + quantidade); }
  const productRefs = [...requested.keys()].map(id => db.collection('produtos').doc(id)), orderRef = db.collection('pedidos').doc();
  const result = await db.runTransaction(async transaction => {
    const snapshots = []; for (const ref of productRefs) snapshots.push(await transaction.get(ref));
    const authoritativeItems = [], sellerIds = new Set(); let total = 0;
    snapshots.forEach((snap, index) => { if (!snap.exists) throw new HttpsError('failed-precondition', 'Um dos produtos já não existe.'); const product = snap.data(), id = productRefs[index].id, quantidade = requested.get(id), stock = Math.max(0, Math.floor(Number(product.stock) || 0)), preco = Number(product.preco) || 0, vendedorId = cleanText(product.vendedorId, 150); if (product.ativo !== true || !vendedorId || preco <= 0) throw new HttpsError('failed-precondition', `O produto ${id} não está disponível.`); if (stock < quantidade) throw new HttpsError('failed-precondition', `Stock insuficiente para ${cleanText(product.nome, 120)}. Disponível: ${stock}.`); sellerIds.add(vendedorId); total += preco * quantidade; authoritativeItems.push({ id, nome: cleanText(product.nome, 200), preco, categoria: cleanText(product.categoria, 100), descricao: cleanText(product.descricao, 1000), img: cleanText(product.img || product.imagemUrl, 1000), vendedorId, quantidade }); transaction.update(productRefs[index], { stock: stock - quantidade, atualizadoEm: FieldValue.serverTimestamp() }); });
    transaction.create(orderRef, { clienteId: request.auth.uid, customer: { nome: cleanText(customer.nome, 150), telefone: cleanText(customer.telefone, 50), email: cleanText(customer.email, 200), morada: cleanText(customer.morada, 500) }, items: authoritativeItems, total, sellerIds: [...sellerIds], paymentMethod, paymentStatus: 'pendente', orderStatus: 'aguardando_pagamento', criadoEm: FieldValue.serverTimestamp() }); return { total, sellerIds: [...sellerIds] };
  }); return { orderId: orderRef.id, total: result.total, sellerIds: result.sellerIds };
});

exports.criarAvaliacao = onCall(async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Inicie sessão para avaliar.');
  const data = request.data || {}, produtoId = cleanText(data.produtoId, 150), nota = Math.floor(Number(data.nota)), comentario = cleanText(data.comentario, 1000);
  if (!produtoId || !Number.isInteger(nota) || nota < 1 || nota > 5) throw new HttpsError('invalid-argument', 'Informe uma nota entre 1 e 5.');
  const productRef = db.collection('produtos').doc(produtoId), reviewRef = db.collection('avaliacoes').doc(`${request.auth.uid}_${produtoId}`);
  await db.runTransaction(async transaction => {
    const [productSnap, existingReview, ordersSnap] = await Promise.all([transaction.get(productRef), transaction.get(reviewRef), db.collection('pedidos').where('clienteId', '==', request.auth.uid).get()]);
    if (!productSnap.exists || productSnap.data().ativo !== true) throw new HttpsError('not-found', 'Produto não encontrado.');
    if (existingReview.exists) throw new HttpsError('already-exists', 'Já avaliou este produto.');
    const bought = ordersSnap.docs.some(s => (s.data().items || []).some(i => i.id === produtoId && ['recebido','em_preparacao','enviado','concluido'].includes(s.data().orderStatus)));
    if (!bought) throw new HttpsError('permission-denied', 'Só pode avaliar produtos de uma encomenda válida.');
    const p = productSnap.data(), totalAnterior = Number(p.avaliacaoTotal || 0), quantidadeAnterior = Number(p.avaliacaoQuantidade || 0), novaQuantidade = quantidadeAnterior + 1;
    transaction.create(reviewRef, { produtoId, clienteId: request.auth.uid, nota, comentario, criadoEm: FieldValue.serverTimestamp() });
    transaction.update(productRef, { avaliacaoTotal: totalAnterior + nota, avaliacaoQuantidade: novaQuantidade, avaliacaoMedia: Number(((totalAnterior + nota) / novaQuantidade).toFixed(2)) });
  }); return { ok: true };
});
