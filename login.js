import { signIn, getProfile, saveProfile } from './supabase-auth.js';

const ADMIN_EMAIL = 'domingosferrazfonseca283@gmail.com';
const btn = document.getElementById('btn-login');

btn?.addEventListener('click', async () => {
  const email = document.getElementById('log-email').value.trim().toLowerCase();
  const senha = document.getElementById('log-senha').value;
  if (!email || !senha) return alert('Preencha todos os campos.');

  btn.disabled = true;
  try {
    const user = await signIn(email, senha);
    let profile = await getProfile(user.id);

    if (!profile) {
      if (email !== ADMIN_EMAIL) throw new Error('Perfil da conta não encontrado. Faça o registo novamente.');
      profile = await saveProfile({ id: user.id, email: ADMIN_EMAIL, nome: 'Administrador Milomércios', tipo: 'admin', estado_conta: 'ativo', subscricao_ativa: false });
    }

    if (email === ADMIN_EMAIL && profile.tipo !== 'admin') {
      profile = await saveProfile({ id: user.id, email: ADMIN_EMAIL, nome: profile.nome || 'Administrador Milomércios', tipo: 'admin', estado_conta: 'ativo', subscricao_ativa: false });
    }

    if (profile.tipo === 'admin' && email === ADMIN_EMAIL) location.href = 'admin.html';
    else if (profile.tipo === 'vendedor') location.href = 'vendedor.html';
    else location.href = 'cliente.html';
  } catch (e) {
    const msg = e?.message || '';
    alert(msg.toLowerCase().includes('invalid login credentials') ? 'E-mail ou senha incorretos.' : 'Erro ao entrar: ' + msg);
  } finally {
    btn.disabled = false;
  }
});
