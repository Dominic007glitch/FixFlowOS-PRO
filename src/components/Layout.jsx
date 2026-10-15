import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import {
  BarChart3,
  ClipboardList,
  Loader2,
  LogOut,
  Menu,
  Package,
  ShoppingCart,
  Smartphone,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { db } from '../firebase/config.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { CARGOS, getPlano } from '../utils/planos.js';

const ITENS_MENU = [
  { para: '/', rotulo: 'Ordens de Serviço', icone: ClipboardList, cargos: ['dono', 'vendedor', 'tecnico'], fim: true },
  { para: '/vendas', rotulo: 'Vendas / PDV', icone: ShoppingCart, cargos: ['dono', 'vendedor'] },
  { para: '/caixa', rotulo: 'Caixa', icone: Wallet, cargos: ['dono', 'vendedor'] },
  { para: '/estoque', rotulo: 'Estoque', icone: Package, cargos: ['dono', 'vendedor'] },
  { para: '/financeiro', rotulo: 'Financeiro', icone: BarChart3, cargos: ['dono'] },
  { para: '/equipe', rotulo: 'Equipe / RH', icone: Users, cargos: ['dono'] },
];

export default function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [loja, setLoja] = useState(null);
  const [erro, setErro] = useState('');
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    let ativo = true;

    getDoc(doc(db, 'lojas', usuario.lojaId))
      .then((snap) => {
        if (!ativo) return;
        if (snap.exists()) {
          setLoja({ id: snap.id, ...snap.data() });
        } else {
          setErro('Loja não encontrada.');
        }
      })
      .catch((e) => {
        console.error(e);
        if (ativo) setErro('Não foi possível carregar os dados da loja.');
      });

    return () => {
      ativo = false;
    };
  }, [usuario.lojaId]);

  async function sair() {
    await logout();
    navigate('/login', { replace: true });
  }

  if (erro) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="card max-w-md text-center">
          <p className="text-red-300">{erro}</p>
          <button type="button" className="btn-secondary mt-4" onClick={sair}>
            Sair
          </button>
        </div>
      </div>
    );
  }

  if (!loja) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  const itensVisiveis = ITENS_MENU.filter((item) => item.cargos.includes(usuario.cargo));

  return (
    <div className="min-h-screen bg-slate-950">
      {menuAberto && (
        <div className="no-print fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMenuAberto(false)} />
      )}

      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-slate-900 transition-transform lg:translate-x-0 ${
          menuAberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
            <Smartphone className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">FixFlowOS Pro</p>
            <p className="truncate text-xs text-slate-400">{loja.nome}</p>
          </div>
          <button type="button" className="ml-auto text-slate-400 lg:hidden" onClick={() => setMenuAberto(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {itensVisiveis.map((item) => {
            const Icone = item.icone;
            return (
              <NavLink
                key={item.para}
                to={item.para}
                end={item.fim}
                onClick={() => setMenuAberto(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`
                }
              >
                <Icone className="h-5 w-5" />
                {item.rotulo}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <p className="truncate text-sm font-medium text-white">{usuario.nome}</p>
          <p className="truncate text-xs text-slate-400">
            {CARGOS[usuario.cargo]} · {getPlano(loja.plano).nome}
          </p>
          <button type="button" onClick={sair} className="btn-secondary mt-3 w-full">
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setMenuAberto(true)} className="text-slate-300">
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-sm font-semibold text-white">{loja.nome}</span>
        </header>

        <main className="p-4 lg:p-6">
          <Outlet context={{ loja }} />
        </main>
      </div>
    </div>
  );
}
