import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { Loader2, Pencil, Plus, Printer, Search, Tag } from 'lucide-react';
import { db } from '../firebase/config.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import OSModal from '../components/OSModal.jsx';
import { STATUS_OS } from '../services/osService.js';
import { docsParaLista } from '../utils/firestore.js';
import { formatarData } from '../utils/datas.js';
import { formatarMoeda, parseValor } from '../utils/masks.js';
import { imprimirEtiqueta, imprimirViaCliente } from '../utils/printOS.js';

const COR_STATUS = {
  'Aguardando orçamento': 'bg-amber-900/40 text-amber-300 border-amber-800',
  'Em análise': 'bg-sky-900/40 text-sky-300 border-sky-800',
  'Aguardando peça': 'bg-orange-900/40 text-orange-300 border-orange-800',
  'Em reparo': 'bg-indigo-900/40 text-indigo-300 border-indigo-800',
  Pronto: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  Entregue: 'bg-slate-800 text-slate-300 border-slate-700',
  Cancelada: 'bg-red-900/40 text-red-300 border-red-800',
};

export default function Dashboard() {
  const { usuario } = useAuth();
  const { loja } = useOutletContext();

  const [ordens, setOrdens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modalAberto, setModalAberto] = useState(false);
  const [osEditando, setOsEditando] = useState(null);
  const [aviso, setAviso] = useState('');

  const podeCriar = usuario.cargo === 'dono' || usuario.cargo === 'vendedor';

  useEffect(() => {
    const cancelar = onSnapshot(
      collection(db, 'lojas', loja.id, 'ordens'),
      (snap) => {
        setOrdens(docsParaLista(snap));
        setCarregando(false);
      },
      (e) => {
        console.error(e);
        setErro('Não foi possível carregar as ordens de serviço.');
        setCarregando(false);
      }
    );
    return () => cancelar();
  }, [loja.id]);

  // Ordenação FIXA: da mais recente para a mais antiga
  const ordenadas = useMemo(() => [...ordens].sort((a, b) => Number(b.numeroOS) - Number(a.numeroOS)), [ordens]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return ordenadas.filter((os) => {
      if (filtroStatus !== 'todos' && os.status !== filtroStatus) return false;
      if (!termo) return true;
      return [os.numeroOS, os.clienteNome, os.clienteTelefone, os.aparelho, os.imei].some((campo) =>
        String(campo || '').toLowerCase().includes(termo)
      );
    });
  }, [ordenadas, busca, filtroStatus]);

  const abertas = ordens.filter((o) => o.status !== 'Entregue' && o.status !== 'Cancelada').length;
  const prontas = ordens.filter((o) => o.status === 'Pronto').length;

  function abrirNova() {
    setOsEditando(null);
    setModalAberto(true);
  }

  function abrirEdicao(os) {
    setOsEditando(os);
    setModalAberto(true);
  }

  function aoSalvar() {
    setModalAberto(false);
    setOsEditando(null);
    setAviso('OS salva com sucesso.');
    setTimeout(() => setAviso(''), 4000);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Ordens de Serviço</h1>
          <p className="text-sm text-slate-400">Da mais recente para a mais antiga</p>
        </div>
        {podeCriar && (
          <button type="button" className="btn-primary" onClick={abrirNova}>
            <Plus className="h-4 w-4" />
            Nova OS
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card">
          <p className="text-xs text-slate-400">Em andamento</p>
          <p className="text-2xl font-bold text-white">{abertas}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Prontas para retirar</p>
          <p className="text-2xl font-bold text-emerald-300">{prontas}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Total de OS</p>
          <p className="text-2xl font-bold text-white">{ordens.length}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input className="input-base pl-9" placeholder="Buscar por nº, cliente, telefone, aparelho ou IMEI" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <select className="input-base sm:w-56" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="todos">Todas as situações</option>
          {STATUS_OS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {aviso && <div className="rounded-lg border border-emerald-900 bg-emerald-950/60 px-3 py-2 text-sm text-emerald-300">{aviso}</div>}
      {erro && <div className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">{erro}</div>}

      <div className="card overflow-x-auto p-0">
        {carregando ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          </div>
        ) : filtradas.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            {ordens.length === 0 ? 'Nenhuma OS cadastrada ainda.' : 'Nenhuma OS encontrada com esse filtro.'}
          </p>
        ) : (
          <table className="min-w-full divide-y divide-slate-800">
            <thead>
              <tr>
                <th className="th-base">Nº</th>
                <th className="th-base">Data</th>
                <th className="th-base">Cliente</th>
                <th className="th-base">Aparelho</th>
                <th className="th-base">Situação</th>
                <th className="th-base text-right">Valor</th>
                <th className="th-base text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtradas.map((os) => {
                const valor = parseValor(os.valor);
                return (
                  <tr key={os.id} className="hover:bg-slate-800/40">
                    <td className="td-base font-bold text-white">#{os.numeroOS}</td>
                    <td className="td-base whitespace-nowrap">{formatarData(os.criadoEm)}</td>
                    <td className="td-base">
                      <div className="font-medium">{os.clienteNome}</div>
                      <div className="text-xs text-slate-500">{os.clienteTelefone}</div>
                    </td>
                    <td className="td-base">{os.aparelho}</td>
                    <td className="td-base">
                      <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs ${COR_STATUS[os.status] || COR_STATUS.Entregue}`}>
                        {os.status}
                      </span>
                    </td>
                    <td className="td-base whitespace-nowrap text-right">{valor > 0 ? formatarMoeda(valor) : 'Orçamento'}</td>
                    <td className="td-base">
                      <div className="flex justify-end gap-1">
                        <button type="button" className="rounded p-2 text-slate-300 hover:bg-slate-700" title="Editar" onClick={() => abrirEdicao(os)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" className="rounded p-2 text-slate-300 hover:bg-slate-700" title="Via do Cliente" onClick={() => imprimirViaCliente(os, loja.nome)}>
                          <Printer className="h-4 w-4" />
                        </button>
                        <button type="button" className="rounded p-2 text-slate-300 hover:bg-slate-700" title="Etiqueta" onClick={() => imprimirEtiqueta(os, loja.nome)}>
                          <Tag className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalAberto && (
        <OSModal
          loja={loja}
          usuario={usuario}
          os={osEditando}
          onClose={() => {
            setModalAberto(false);
            setOsEditando(null);
          }}
          onSalvo={aoSalvar}
        />
      )}
    </div>
  );
}
