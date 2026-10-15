import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config.js';

const AuthContext = createContext(null);

// Busca o perfil no Firestore e devolve um objeto LIMPO (sem spread do objeto do Firebase).
async function carregarPerfil(currentUser) {
  const superSnap = await getDoc(doc(db, 'superadmins', currentUser.uid));

  if (superSnap.exists()) {
    const dadosSuper = superSnap.data();
    return {
      uid: currentUser.uid,
      email: currentUser.email,
      nome: dadosSuper.nome || 'Super Admin',
      cargo: 'superadmin',
      lojaId: null,
    };
  }

  const userSnap = await getDoc(doc(db, 'usuarios', currentUser.uid));

  if (!userSnap.exists()) {
    throw new Error('Seu usuário não está cadastrado em nenhuma loja. Fale com o administrador.');
  }

  const dados = userSnap.data();

  if (dados.ativo === false) {
    throw new Error('Seu acesso está desativado. Fale com o dono da loja.');
  }

  const lojaSnap = await getDoc(doc(db, 'lojas', dados.lojaId));

  if (!lojaSnap.exists() || lojaSnap.data().ativo === false) {
    throw new Error('A loja está desativada ou não existe. Fale com o administrador.');
  }

  return {
    uid: currentUser.uid,
    email: currentUser.email,
    nome: dados.nome,
    cargo: dados.cargo,
    lojaId: dados.lojaId,
  };
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const cancelar = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUsuario(null);
        setCarregando(false);
        return;
      }

      try {
        const perfil = await carregarPerfil(currentUser);
        setUsuario(perfil);
      } catch (erro) {
        console.error('Erro ao carregar perfil:', erro);
        await signOut(auth);
        setUsuario(null);
      } finally {
        setCarregando(false);
      }
    });

    return () => cancelar();
  }, []);

  // O login só termina DEPOIS de o perfil estar no estado.
  // Assim o navigate('/') da tela de Login nunca cai numa rota protegida "vazia" (bug do login duplo).
  async function login(email, password) {
    const credencial = await signInWithEmailAndPassword(auth, email, password);

    try {
      const perfil = await carregarPerfil(credencial.user);
      setUsuario(perfil);
      return perfil;
    } catch (erro) {
      await signOut(auth);
      setUsuario(null);
      throw erro;
    }
  }

  async function logout() {
    await signOut(auth);
    setUsuario(null);
  }

  const valor = { usuario, carregando, login, logout };

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return contexto;
}
