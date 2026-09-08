import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

document.getElementById('btn-registar').addEventListener('click', async () => {
  const nome = document.getElementById('reg-nome').value.trim();
  const loja = document.getElementById('reg-loja').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const senha = document.getElementById('reg-senha').value;
  const tipo = document.getElementById('reg-tipo').value;
  if (!nome || !email || senha.length < 6) return alert('Preencha os campos obrigatórios. A senha deve ter pelo menos 6 caracteres.');
  if (tipo === 'vendedor' && !loja) return alert('Informe o nome da loja.');
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    const perfil = tipo === 'vendedor'
      ? { nome, nomeLoja: loja, email, tipo:'vendedor', planoSubscricao:'mensal', subscricaoAtiva:false, estadoConta:'pendente', criadoEm:serverTimestamp() }
      : { nome, email, tipo:'cliente', estadoConta:'ativo', subscricaoAtiva:false, criadoEm:serverTimestamp() };
    await setDoc(doc(db, 'usuarios', cred.user.uid), perfil);
    if (tipo === 'vendedor') {
      await setDoc(doc(db, 'lojas', cred.user.uid), { vendedorId:cred.user.uid, nomeLoja:loja, descricaoLoja:'', localizacao:'', telefone:'', whatsapp:'', imagemUrl:'', atualizadoEm:serverTimestamp() });
      alert('Conta de vendedor criada. Agora solicite a subscrição e aguarde a aprovação do administrador.');
      location.href='vendedor.html';
    } else {
      alert('Conta criada gratuitamente. Bem-vindo ao Milomércios!');
      location.href='cliente.html';
    }
  } catch (e) { alert('Erro ao criar conta: ' + e.message); }
});
