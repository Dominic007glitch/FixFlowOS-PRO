import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import { db } from '../firebase/config.js';
import { docsParaLista } from '../utils/firestore.js';
import { isoParaDate, paraDate } from '../utils/datas.js';
import { arredondar, formatarMoeda, parseValor } from '../utils/masks.js';

const OPCOES = [
  { id: '7d', nome: 'Últimos 7 dias' },
  { id: '30d', nome: 'Últimos 30 dias' },
  { id: 'mes', nome: 'Este mês' },
  { id: 'mesAnt', nome: 'Mês anterior' },
];

const DIA_MS = 24 * 60 * 60 * 1000;

function calcularPeriodo(opcao) {
  const agora = new Date();
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  let inicio;
  let fim;

  if (opcao === '7d' || opcao === '30d') {
    const dias = opcao === '7d' ? 7 : 30;
    fim = new Date(inicioHoje.getTime() + DIA_MS);
    inicio = new Date(fim.getTime() - dias * DIA_MS);
  } else if (opcao === 'mes') {
    inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
    fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  } else {
    inicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    fim = new Date(agora.getFullYear(), agora.getMonth(), 1);
  }

  const duracao = fim.getTime() - inicio.getTime();
  return { inicio, fim, anteriorInicio: new Date(inicio.getTime() - duracao), anteriorFim: inicio };
}

function custoDasPecas(itens) {
  return (itens || []).reduce((soma, i) => soma + parseValor(i.custo) * (Number(i.quantidade) || 0), 0);
}

function chaveDia(data) {
  return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`;
}

function resumir(ordens, vendas, lancamentos, inicio, fim) {
  const dentro = (data) => data && data.getTime() >= inicio.getTime() && data.getTime() < fim.getTime();
  const porDia = {};
  const r = { fatOS: 0, custoOS: 0, qtdOS: 0, fatVendas: 0, custoVendas: 0, qtdVendas: 0, despesas: 0 };

  ordens.forEach((os) => {
    if (os.status !== 'Entregue') return;
    const data = paraDate(os.entregueEm) || paraDate(os.criadoEm);
    if (!dentro(data)) return;
    const valor = parseValor(os.valor);
    if (valor <= 0) return;
    r.fatOS += valor;
    r.custoOS += custoDasPecas(os.pecas);
    r.qtdOS += 1;
    const chave = chaveDia(data);
    porDia[chave] = porDia[chave] || { servicos: 0, vendas: 0 };
    porDia[chave].servicos += valor;
  });

  vendas.forEach((v) => {
    const data = paraDate(v.criadoEm);
    if (!dentro(data)) return;
    const valor = parseValor(v.total);
    if (valor <= 0) return;
    r.fatVendas += valor;
    r.custoVendas += custoDasPecas(v.itens);
    r.qtdVendas += 1;
    const chave = chaveDia(data);
    porDia[chave] = porDia[chave] || { servicos: 0, vendas: 0 };
    porDia[chave].vendas += valor;
  });

  lancamentos.forEach((l) => {
    const data = isoParaDate(l.data);
    if (dentro(data)) r.despesas += parseValor(l.valor);
  });

  r.faturamento = r.fatOS + r.fatVendas;
  r.custos = r.custoOS + r.custoVendas;
  r.lucro = r.faturamento - r.custos;
  r.ticketMedio = r.qtdOS + r.qtdVendas > 0 ? r.faturamento / (r.qtdOS + r.qtdVendas) : 0;
  r.resultado = r.lucro - r.despesas;
  r.porDia = porDia;
  return r;
}

function variacao(atual, anterior) {
  if (anterior <= 0) return atual > 0 ? 'novo período com movimento' : 'sem movimento nos dois períodos';
  const pct = ((atual - anterior) / anterior) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}% vs período anterior`;
}

const estiloTooltip = { backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' };

export default function Financeiro() {
  const { loja } = useOutletContext();
  const [ordens, setOrdens] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [carregados, setCarregados] = useState({ ordens: false, vendas: false, equipe: false });
  const [erro, setErro] = useState('');
  const [opcao, setOpcao] = useState('30d');

  useEffect(() => {
    function ouvir(nome, setter, chave) {
      return onSnapshot(
        collection(db, 'lojas', loja.id, nome),
        (snap) => {
          setter(docsParaLista(snap));
          setCarregados((atual) => ({ ...atual, [chave]: true }));
        },
        (e) => {
          console.error(e);
          setErro('Não foi possível carregar todos os dados financeiros.');
          setCarregados((atual) => ({ ...atual, [chave]: true }));
        }
      );
    }

    const cancelarOrdens = ouvir('ordens', setOrdens, 'ordens');
    const cancelarVendas = ouvir('vendas', setVendas, 'vendas');
    const cancelarEquipe = ouvir('equipe', setLancamentos, 'equipe');

    return () => {
      cancelarOrdens();
      cancelarVendas();
      cancelarEquipe();
    };
  }, [loja.id]);

  const periodo = useMemo(() => calcularPeriodo(opcao), [opcao]);
  const atual = useMemo(() => resumir(ordens, vendas, lancamentos, periodo.inicio, periodo.fim), [ordens, vendas, lancamentos, periodo]);
  const anterior = useMemo(
    () => resumir(ordens, vendas, lancamentos, periodo.anteriorInicio, periodo.anteriorFim),
    [ordens, vendas, lancamentos, periodo]
  );

  const dadosDiarios = useMemo(() => {
    const lista = [];
    const limite = Math.min(periodo.fim.getTime(), Date.now() + DIA_MS);
    for (let t = periodo.inicio.getTime(); t < limite; t += DIA_MS) {
      const chave = chaveDia(new Date(t));
      const dia = atual.porDia[chave] || { servicos: 0, vendas: 0 };
      lista.push({ dia: chave, Serviços: arredondar(dia.servicos), Vendas: arredondar(dia.vendas) });
    }
    return lista;
  }, [atual, periodo]);

  const dadosComparativo = [
    { nome: 'Faturamento', Atual: arredondar(atual.faturamento), Anterior: arredondar(anterior.faturamento) },
    { nome: 'Lucro estimado', Atual: arredondar(atual.lucro), Anterior: arredondar(anterior.lucro) },
    { nome: 'Serviços', Atual: arredondar(atual.fatOS), Anterior: arredondar(anterior.fatOS) },
    { nome: 'Vendas', Atual: arredondar(atual.fatVendas), Anterior: arredondar(anterior.fatVendas) },
  ];

  if (!carregados.ordens || !carregados.vendas || !carregados.equipe) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard Financeiro</h1>
          <p className="text-sm text-slate-400">Considera OS entregues e vendas do PDV</p>
        </div>
        <select className="input-base w-auto" value={opcao} onChange={(e) => setOpcao(e.target.value)}>
          {OPCOES.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      </div>

      {erro && <div className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">{erro}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card">
          <p className="text-xs text-slate-400">Faturamento</p>
          <p className="text-xl font-bold text-white">{formatarMoeda(atual.faturamento)}</p>
          <p className="mt-1 text-xs text-slate-500">{variacao(atual.faturamento, anterior.faturamento)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Lucro estimado</p>
          <p className="text-xl font-bold text-emerald-300">{formatarMoeda(atual.lucro)}</p>
          <p className="mt-1 text-xs text-slate-500">Faturamento menos custo de peças e produtos</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Ticket médio</p>
          <p className="text-xl font-bold text-white">{formatarMoeda(atual.ticketMedio)}</p>
          <p className="mt-1 text-xs text-slate-500">{atual.qtdOS + atual.qtdVendas} atendimento(s)</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Gastos com equipe</p>
          <p className="text-xl font-bold text-white">{formatarMoeda(atual.despesas)}</p>
          <p className="mt-1 text-xs text-slate-500">Resultado após equipe: {formatarMoeda(atual.resultado)}</p>
        </div>
      </div>

      <div className="card">
        <p className="mb-3 text-sm font-semibold text-white">Faturamento por dia</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dadosDiarios}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="dia" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={estiloTooltip} formatter={(v) => formatarMoeda(v)} />
              <Legend />
              <Bar dataKey="Serviços" stackId="a" fill="#0ea5e9" />
              <Bar dataKey="Vendas" stackId="a" fill="#34d399" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <p className="mb-3 text-sm font-semibold text-white">Período atual x período anterior</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dadosComparativo}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="nome" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={estiloTooltip} formatter={(v) => formatarMoeda(v)} />
              <Legend />
              <Bar dataKey="Anterior" fill="#475569" />
              <Bar dataKey="Atual" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
