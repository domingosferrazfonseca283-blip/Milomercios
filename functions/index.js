const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
setGlobalOptions({ region: 'africa-south1', maxInstances: 10 });
const db = getFirestore();
function cleanText(value, max = 500) { return String(value ?? '').trim().slice(0, max); }

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
