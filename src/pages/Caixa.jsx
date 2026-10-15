import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { ArrowDownCircle, ArrowUpCircle, Loader2, Lock, Unlock } from 'lucide-react';
import { db } from '../firebase/config.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { abrirCaixa, calcularResumo, fecharCaixa, lancarMovimento } from '../services/caixaService.js';
import { docsParaLista } from '../utils/firestore.js';
import { formatarDataHora, paraDate } from '../utils/datas.js';
import { filtrarValor, formatarMoeda, parseValor } from '../utils/masks.js';

function timestampMs(valor) {
  const data = paraDate(valor);
  return data ? data.getTime() : 0;
}

const ROTULO_TIPO = { venda: 'Venda', suprimento: 'Suprimento', sangria: 'Sangria' };

export default function Caixa() {
  const { usuario } = useAuth();
  const { loja } = useOutletContext();

  const [sessoes, setSessoes] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [valorAbertura, setValorAbertura] = useState('');
  const [tipoMov, setTipoMov] = useState(null);
  const [valorMov, setValorMov] = useState('');
  const [descMov, setDescMov] = useState('');
  const [fechando, setFechando] = useState(false);
  const [valorContado, setValorContado] = useState('');
  const [erro, setErro] = useState('');
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    const cancelar = onSnapshot(
      collection(db, 'lojas', loja.id, 'caixaSessoes'),
      (snap) => {
        setSessoes(docsParaLista(snap));
        setCarregando(false);
      },
      (e) => {
        console.error(e);
        setErro('Não foi possível carregar o caixa.');
        setCarregando(false);
      }
    );
    return () => cancelar();
  }, [loja.id]);

  const sessaoAberta = useMemo(() => sessoes.find((s) => s.status === 'aberto') || null, [sessoes]);

  const sessoesFechadas = useMemo(
    () => sessoes.filter((s) => s.status === 'fechado').sort((a, b) => timestampMs(b.fechadoEm) - timestampMs(a.fechadoEm)).slice(0, 15),
    [sessoes]
  );

  useEffect(() => {
    if (!sessaoAberta) {
      setMovimentos([]);
      return undefined;
    }
    const cancelar = onSnapshot(
      query(collection(db, 'lojas', loja.id, 'caixaMovimentos'), where('sessaoId', '==', sessaoAberta.id)),
      (snap) => setMovimentos(docsParaLista(snap).sort((a, b) => timestampMs(b.criadoEm) - timestampMs(a.criadoEm))),
      (e) => console.error(e)
    );
    return () => cancelar();
  }, [loja.id, sessaoAberta ? sessaoAberta.id : null]);

  const resumo = useMemo(() => calcularResumo(sessaoAberta, movimentos), [sessaoAberta, movimentos]);

  async function handleAbrir(evento) {
    evento.preventDefault();
    setErro('');
    setProcessando(true);
    try {
      await abrirCaixa(loja.id, valorAbertura, usuario);
      setValorAbertura('');
    } catch (e) {
      console.error(e);
      setErro('Não foi possível abrir o caixa.');
    } finally {
      setProcessando(false);
    }
  }

  async function handleMovimento(evento) {
    evento.preventDefault();
    setErro('');
    const valor = parseValor(valorMov);

    if (valor <= 0) return setErro('Informe um valor maior que zero.');
    if (tipoMov === 'sangria' && valor > resumo.esperadoDinheiro) {
      return setErro(`Saldo em dinheiro insuficiente. Disponível: ${formatarMoeda(resumo.esperadoDinheiro)}.`);
    }

    setProcessando(true);
    try {
      await lancarMovimento(loja.id, sessaoAberta.id, tipoMov, valor, descMov.trim(), usuario);
      setTipoMov(null);
      setValorMov('');
      setDescMov('');
    } catch (e) {
      console.error(e);
      setErro('Não foi possível registrar o lançamento.');
    } finally {
      setProcessando(false);
    }
  }

  async function handleFechar(evento) {
    evento.preventDefault();
    setErro('');
    if (valorContado.trim() === '') return setErro('Informe o valor contado em dinheiro na gaveta.');

    setProcessando(true);
    try {
      await fecharCaixa(loja.id, sessaoAberta.id, resumo, valorContado, usuario);
      setFechando(false);
      setValorContado('');
    } catch (e) {
      console.error(e);
      setErro('Não foi possível fechar o caixa.');
    } finally {
      setProcessando(false);
    }
  }

  function abrirPainelMovimento(tipo) {
    setErro('');
    setFechando(false);
    setTipoMov(tipo);
  }

  if (carregando) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  const diferencaPrevista = parseValor(valorContado) - resumo.esperadoDinheiro;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Caixa</h1>
        <p className="text-sm text-slate-400">Abertura, suprimento, sangria e fechamento</p>
      </div>

      {erro && <div className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">{erro}</div>}

      {!sessaoAberta ? (
        <form onSubmit={handleAbrir} className="card max-w-md space-y-3">
          <div className="flex items-center gap-2 text-white">
            <Unlock className="h-5 w-5" />
            <span className="font-semibold">Abrir caixa</span>
          </div>
          <div>
            <label className="label-base">Valor inicial na gaveta (R$)</label>
            <input className="input-base" inputMode="decimal" value={valorAbertura} onChange={(e) => setValorAbertura(filtrarValor(e.target.value))} placeholder="0,00" />
          </div>
          <button type="submit" className="btn-primary" disabled={processando}>
            {processando && <Loader2 className="h-4 w-4 animate-spin" />}
            Abrir caixa
          </button>
        </form>
      ) : (
        <>
          <div className="card text-sm text-slate-300">
            Caixa aberto por <b className="text-white">{sessaoAberta.abertoPorNome}</b> em {formatarDataHora(sessaoAberta.abertoEm)}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card">
              <p className="text-xs text-slate-400">Abertura</p>
              <p className="text-lg font-bold text-white">{formatarMoeda(resumo.abertura)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-400">Vendas em dinheiro</p>
              <p className="text-lg font-bold text-white">{formatarMoeda(resumo.vendasDinheiro)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-400">Vendas (Pix e cartão)</p>
              <p className="text-lg font-bold text-white">{formatarMoeda(resumo.vendasOutras)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-400">Dinheiro esperado na gaveta</p>
              <p className="text-lg font-bold text-emerald-300">{formatarMoeda(resumo.esperadoDinheiro)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-400">Suprimentos</p>
              <p className="text-lg font-bold text-white">{formatarMoeda(resumo.suprimentos)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-400">Sangrias</p>
              <p className="text-lg font-bold text-white">{formatarMoeda(resumo.sangrias)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => abrirPainelMovimento('suprimento')}>
              <ArrowDownCircle className="h-4 w-4" />
              Suprimento
            </button>
            <button type="button" className="btn-secondary" onClick={() => abrirPainelMovimento('sangria')}>
              <ArrowUpCircle className="h-4 w-4" />
              Sangria
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                setErro('');
                setTipoMov(null);
                setFechando(true);
              }}
            >
              <Lock className="h-4 w-4" />
              Fechar caixa
            </button>
          </div>

          {tipoMov && (
            <form onSubmit={handleMovimento} className="card max-w-md space-y-3">
              <p className="font-semibold text-white">{tipoMov === 'suprimento' ? 'Suprimento (entrada de dinheiro)' : 'Sangria (retirada de dinheiro)'}</p>
              <div>
                <label className="label-base">Valor (R$)</label>
                <input className="input-base" inputMode="decimal" value={valorMov} onChange={(e) => setValorMov(filtrarValor(e.target.value))} placeholder="0,00" />
              </div>
              <div>
                <label className="label-base">Motivo</label>
                <input className="input-base" value={descMov} onChange={(e) => setDescMov(e.target.value)} placeholder="Ex: troco, pagamento de fornecedor" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary" disabled={processando}>
                  {processando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Registrar
                </button>
                <button type="button" className="btn-secondary" onClick={() => setTipoMov(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {fechando && (
            <form onSubmit={handleFechar} className="card max-w-md space-y-3">
              <p className="font-semibold text-white">Fechar caixa</p>
              <p className="text-sm text-slate-400">Esperado em dinheiro: {formatarMoeda(resumo.esperadoDinheiro)}</p>
              <div>
                <label className="label-base">Valor contado na gaveta (R$)</label>
                <input className="input-base" inputMode="decimal" value={valorContado} onChange={(e) => setValorContado(filtrarValor(e.target.value))} placeholder="0,00" />
              </div>
              {valorContado.trim() !== '' && (
                <p className={`text-sm ${Math.abs(diferencaPrevista) < 0.005 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  Diferença: {formatarMoeda(diferencaPrevista)}
                </p>
              )}
              <div className="flex gap-2">
                <button type="submit" className="btn-danger" disabled={processando}>
                  {processando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar fechamento
                </button>
                <button type="button" className="btn-secondary" onClick={() => setFechando(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="card overflow-x-auto p-0">
            <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-white">Movimentos desta sessão</div>
            {movimentos.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">Nenhum movimento ainda.</p>
            ) : (
              <table className="min-w-full divide-y divide-slate-800">
                <thead>
                  <tr>
                    <th className="th-base">Hora</th>
                    <th className="th-base">Tipo</th>
                    <th className="th-base">Descrição</th>
                    <th className="th-base">Forma</th>
                    <th className="th-base">Usuário</th>
                    <th className="th-base text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {movimentos.map((m) => (
                    <tr key={m.id}>
                      <td className="td-base whitespace-nowrap">{formatarDataHora(m.criadoEm)}</td>
                      <td className="td-base">{ROTULO_TIPO[m.tipo] || m.tipo}</td>
                      <td className="td-base">{m.descricao || '-'}</td>
                      <td className="td-base">{m.forma}</td>
                      <td className="td-base">{m.usuarioNome}</td>
                      <td className={`td-base text-right font-medium ${m.tipo === 'sangria' ? 'text-red-300' : 'text-emerald-300'}`}>
                        {m.tipo === 'sangria' ? '- ' : ''}
                        {formatarMoeda(m.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <div className="card overflow-x-auto p-0">
        <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-white">Histórico de caixas fechados</div>
        {sessoesFechadas.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Nenhum caixa fechado ainda.</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-800">
            <thead>
              <tr>
                <th className="th-base">Aberto por</th>
                <th className="th-base">Abertura</th>
                <th className="th-base">Fechado por</th>
                <th className="th-base">Fechamento</th>
                <th className="th-base text-right">Vendas</th>
                <th className="th-base text-right">Esperado</th>
                <th className="th-base text-right">Contado</th>
                <th className="th-base text-right">Diferença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sessoesFechadas.map((s) => (
                <tr key={s.id}>
                  <td className="td-base">{s.abertoPorNome}</td>
                  <td className="td-base whitespace-nowrap">{formatarDataHora(s.abertoEm)}</td>
                  <td className="td-base">{s.fechadoPorNome}</td>
                  <td className="td-base whitespace-nowrap">{formatarDataHora(s.fechadoEm)}</td>
                  <td className="td-base text-right">{formatarMoeda(s.totalVendas)}</td>
                  <td className="td-base text-right">{formatarMoeda(s.esperadoDinheiro)}</td>
                  <td className="td-base text-right">{formatarMoeda(s.valorContado)}</td>
                  <td className={`td-base text-right font-medium ${Math.abs(Number(s.diferenca) || 0) < 0.005 ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {formatarMoeda(s.diferenca)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
