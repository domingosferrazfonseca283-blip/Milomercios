import { signUp, saveProfile, supabase } from './supabase-auth.js';

const ADMIN_EMAIL = 'domingosferrazfonseca283@gmail.com';

document.getElementById('btn-registar').addEventListener('click', async () => {
  const nome = document.getElementById('reg-nome').value.trim();
  const loja = document.getElementById('reg-loja').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const senha = document.getElementById('reg-senha').value;
  const tipo = document.getElementById('reg-tipo').value;

  if (!nome || !email || senha.length < 6) return alert('Preencha os campos obrigatórios. A senha deve ter pelo menos 6 caracteres.');
  if (tipo === 'vendedor' && !loja) return alert('Informe o nome da loja.');
  if (email === ADMIN_EMAIL && tipo !== 'admin') return alert('Este e-mail é reservado ao administrador.');

  try {
    const user = await signUp(email, senha, { nome, tipo: tipo === 'vendedor' ? 'vendedor' : 'cliente', nome_loja: loja });
    if (!user) throw new Error('Não foi possível criar a conta.');

    const perfil = {
      id: user.id,
      nome,
      email,
      tipo: email === ADMIN_EMAIL ? 'admin' : (tipo === 'vendedor' ? 'vendedor' : 'cliente'),
      nome_loja: tipo === 'vendedor' ? loja : null,
      plano_subscricao: 'mensal',
      subscricao_ativa: false,
      estado_conta: email === ADMIN_EMAIL ? 'ativo' : (tipo === 'vendedor' ? 'pendente' : 'ativo')
    };
    await saveProfile(perfil);

    if (tipo === 'vendedor') {
      const { error } = await supabase.from('stores').upsert({ id: user.id, nome_loja: loja });
      if (error) throw error;
    }

    alert(email === ADMIN_EMAIL
      ? 'Conta de administrador criada. Confirme o e-mail se o Supabase solicitar.'
      : tipo === 'vendedor'
        ? 'Conta de vendedor criada. Agora solicite a subscrição e aguarde a aprovação do administrador.'
        : 'Conta criada gratuitamente. Bem-vindo ao Milomércios!');
    location.href = tipo === 'vendedor' ? 'vendedor.html' : (email === ADMIN_EMAIL ? 'admin.html' : 'cliente.html');
  } catch (e) {
    alert('Erro ao criar conta: ' + (e?.message || e));
  }
});
