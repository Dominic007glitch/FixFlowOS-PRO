import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, LogIn, Smartphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';

function traduzirErro(erro) {
  const codigo = erro && erro.code ? erro.code : '';

  if (
    codigo === 'auth/invalid-credential' ||
    codigo === 'auth/wrong-password' ||
    codigo === 'auth/user-not-found' ||
    codigo === 'auth/invalid-email'
  ) {
    return 'E-mail ou senha incorretos.';
  }
  if (codigo === 'auth/too-many-requests') {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  if (codigo === 'auth/network-request-failed') {
    return 'Sem conexão com a internet.';
  }
  return erro && erro.message ? erro.message : 'Não foi possível entrar.';
}

export default function Login() {
  const { usuario, carregando, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!carregando && usuario) {
    return <Navigate to={usuario.cargo === 'superadmin' ? '/superadmin' : '/'} replace />;
  }

  async function handleSubmit(evento) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);

    try {
      const perfil = await login(email.trim(), password);
      navigate(perfil.cargo === 'superadmin' ? '/superadmin' : '/', { replace: true });
    } catch (e) {
      setErro(traduzirErro(e));
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600">
            <Smartphone className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">FixFlowOS Pro</h1>
          <p className="mt-1 text-sm text-slate-400">Gestão de ordens de serviço para assistências técnicas</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <div>
            <label className="label-base" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="input-base"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="label-base" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="input-base"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {erro && (
            <div className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">{erro}</div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={enviando}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Esqueceu a senha? Solicite ao administrador do sistema.
        </p>
      </div>
    </div>
  );
}
