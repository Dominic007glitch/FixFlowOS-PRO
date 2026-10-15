import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Loader2, Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { db } from '../firebase/config.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { FORMAS_PAGAMENTO, finalizarVenda } from '../services/vendaService.js';
import { docsParaLista } from '../utils/firestore.js';
import { formatarDataHora, paraDate } from '../utils/datas.js';
import { arredondar, filtrarValor, formatarMoeda, parseValor } from '../utils/masks.js';

export default function Vendas() {
  const { usuario } = useAuth();
  const { loja } = useOutletContext();
  const ehDono = usuario.cargo === 'dono';

  const [produtos, setProdutos] = useState([]);
  const [sessao, setSessao] = useState(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [vendas, setVendas] = useState([]);
  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  const [desconto, setDesconto] = useState('');
  const [forma, setForma] = useState(FORMAS_PAGAMENTO[0]);
  const [avulsoNome, setAvulsoNome] = useState('');
  const [avulsoPreco, setAvulsoPreco] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [finalizando, setFinalizando] = useState(false);

  useEffect(() => {
    const cancelarEstoque = onSnapshot(
      collection(db, 'lojas', loja.id, 'estoque'),
      (snap) => setProdutos(docsParaLista(snap).sort((a, b) => String(a.nome).localeCompare(String(b.nome)))),
      (e) => console.error(e)
    );

    const cancelarSessao = onSnapshot(
      query(collection(db, 'lojas', loja.id, 'caixaSessoes'), where('status', '==', 'aberto')),
      (snap) => {
        const lista = docsParaLista(snap);
        setSessao(lista.length > 0 ? lista[0] : null);
        setCarregandoSessao(false);
      },
      (e) => {
        console.error(e);
        setCarregandoSessao(false);
      }
    );

    // Dono vê todas as vendas; vendedor vê apenas as suas.
    const refVendas = collection(db, 'lojas', loja.id, 'vendas');
    const consultaVendas = ehDono ? refVendas : query(refVendas, where('usuarioUid', '==', usuario.uid));
    const cancelarVendas = onSnapshot(
      consultaVendas,
      (snap) => setVendas(docsParaLista(snap)),
      (e) => console.error(e)
    );

    return () => {
      cancelarEstoque();
      cancelarSessao();
      cancelarVendas();
    };
  }, [loja.id, ehDono, usuario.uid]);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = termo ? produtos.filter((p) => `${p.nome} ${p.categoria}`.toLowerCase().includes(termo)) : produtos;
    return lista.slice(0, 30);
  }, [produtos, busca]);

  const vendasRecentes = useMemo(
    () =>
      [...vendas]
        .sort((a, b) => (paraDate(b.criadoEm)?.getTime() || 0) - (paraDate(a.criadoEm)?.getTime() || 0))
        .slice(0, 15),
    [vendas]
  );

  const subtotal = arredondar(
    carrinho.reduce((soma, item) => soma + parseValor(item.preco) * Number(item.quantidade), 0)
  );
  const descontoValor = Math.min(Math.max(parseValor(desconto), 0), subtotal);
  const total = arredondar(subtotal - descontoValor);

  function adicionarProduto(produto) {
    setErro('');
    setSucesso('');
    const disponivel = Number(produto.quantidade) || 0;
    const existente = carrinho.find((i) => i.produtoId === produto.id);
    const naCesta = existente ? existente.quantidade : 0;

    if (naCesta + 1 > disponivel) {
      setErro(`Sem estoque suficiente de "${produto.nome}". Disponível: ${disponivel}.`);
      return;
    }

    if (existente) {
      setCarrinho((atual) => atual.map((i) => (i.produtoId === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i)));
    } else {
      setCarrinho((atual) => [
        ...atual,
        { key: `p-${produto.id}`, produtoId: produto.id, nome: produto.nome, quantidade: 1, preco: parseValor(produto.precoVenda), maximo: disponivel },
      ]);
    }
  }

  function adicionarAvulso() {
    setErro('');
    const preco = parseValor(avulsoPreco);
    if (!avulsoNome.trim() || preco <= 0) {
      setErro('Informe o nome e um preço maior que zero para o item avulso.');
      return;
    }
    setCarrinho((atual) => [
      ...atual,
      { key: `a-${Date.now()}`, produtoId: '', nome: avulsoNome.trim(), quantidade: 1, preco, maximo: Infinity },
    ]);
    setAvulsoNome('');
    setAvulsoPreco('');
  }

  function alterarQuantidade(key, delta) {
    setCarrinho((atual) =>
      atual
        .map((i) => {
          if (i.key !== key) return i;
          const nova = i.quantidade + delta;
          if (nova > i.maximo) return i;
          return { ...i, quantidade: nova };
        })
        .filter((i) => i.quantidade > 0)
    );
  }

  function removerItem(key) {
    setCarrinho((atual) => atual.filter((i) => i.key !== key));
  }

  async function finalizar() {
    setErro('');
    setSucesso('');

    if (!sessao) return setErro('Abra o caixa antes de vender.');
    if (carrinho.length === 0) return setErro('Adicione pelo menos um item ao carrinho.');
    if (parseValor(desconto) > subtotal) return setErro('O desconto não pode ser maior que o subtotal.');

    setFinalizando(true);
    try {
      const totalFinal = await finalizarVenda(
        loja.id,
        {
          itens: carrinho.map((i) => ({ produtoId: i.produtoId, nome: i.nome, quantidade: i.quantidade, preco: i.preco })),
          desconto,
          formaPagamento: forma,
          sessaoId: sessao.id,
        },
        usuario
      );
      setCarrinho([]);
      setDesconto('');
      setSucesso(`Venda registrada: ${formatarMoeda(totalFinal)}.`);
    } catch (e) {
      console.error(e);
      setErro(e && e.message ? e.message : 'Não foi possível finalizar a venda.');
    } finally {
      setFinalizando(false);
    }
  }

  if (carregandoSessao) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Vendas / PDV</h1>
        <p className="text-sm text-slate-400">Tela rápida de balcão</p>
      </div>

      {!sessao && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/50 px-3 py-2 text-sm text-amber-300">
          O caixa está fechado. <Link to="/caixa" className="font-semibold underline">Abra o caixa</Link> para registrar vendas.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input className="input-base pl-9" placeholder="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {produtosFiltrados.map((p) => {
              const qtd = Number(p.quantidade) || 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={qtd <= 0}
                  onClick={() => adicionarProduto(p)}
                  className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-left transition hover:border-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <p className="truncate text-sm font-semibold text-white">{p.nome}</p>
                  <p className="text-xs text-slate-400">{p.categoria || 'Sem categoria'}</p>
                  <p className="mt-1 text-sm font-bold text-brand-400">{formatarMoeda(p.precoVenda)}</p>
                  <p className="text-xs text-slate-500">{qtd > 0 ? `${qtd} em estoque` : 'Sem estoque'}</p>
                </button>
              );
            })}
            {produtosFiltrados.length === 0 && (
              <p className="col-span-full py-6 text-center text-sm text-slate-500">Nenhum produto encontrado.</p>
            )}
          </div>

          <div className="card">
            <p className="mb-2 text-sm font-semibold text-white">Item avulso (sem estoque)</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className="input-base" placeholder="Descrição (ex: Serviço de troca de película)" value={avulsoNome} onChange={(e) => setAvulsoNome(e.target.value)} />
              <input className="input-base sm:w-32" inputMode="decimal" placeholder="Preço" value={avulsoPreco} onChange={(e) => setAvulsoPreco(filtrarValor(e.target.value))} />
              <button type="button" className="btn-secondary" onClick={adicionarAvulso}>
                <Plus className="h-4 w-4" />
                Adicionar
              </button>
            </div>
          </div>
        </div>

        <div className="card space-y-3 lg:col-span-2">
          <div className="flex items-center gap-2 text-white">
            <ShoppingCart className="h-5 w-5" />
            <span className="font-semibold">Carrinho</span>
          </div>

          {carrinho.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">Nenhum item adicionado.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {carrinho.map((item) => (
                <li key={item.key} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{item.nome}</p>
                    <p className="text-xs text-slate-400">{formatarMoeda(item.preco)} cada</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" className="rounded p-1 text-slate-300 hover:bg-slate-700" onClick={() => alterarQuantidade(item.key, -1)}>
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center text-sm">{item.quantidade}</span>
                    <button type="button" className="rounded p-1 text-slate-300 hover:bg-slate-700" onClick={() => alterarQuantidade(item.key, 1)}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="w-20 text-right text-sm font-medium">{formatarMoeda(item.preco * item.quantidade)}</span>
                  <button type="button" className="rounded p-1 text-red-400 hover:bg-slate-700" onClick={() => removerItem(item.key)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Desconto (R$)</label>
              <input className="input-base" inputMode="decimal" value={desconto} onChange={(e) => setDesconto(filtrarValor(e.target.value))} placeholder="0,00" />
            </div>
            <div>
              <label className="label-base">Pagamento</label>
              <select className="input-base" value={forma} onChange={(e) => setForma(e.target.value)}>
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1 border-t border-slate-800 pt-3 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span>{formatarMoeda(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Desconto</span>
              <span>- {formatarMoeda(descontoValor)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-white">
              <span>Total</span>
              <span>{formatarMoeda(total)}</span>
            </div>
          </div>

          {erro && <div className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">{erro}</div>}
          {sucesso && <div className="rounded-lg border border-emerald-900 bg-emerald-950/60 px-3 py-2 text-sm text-emerald-300">{sucesso}</div>}

          <button type="button" className="btn-primary w-full" onClick={finalizar} disabled={finalizando || !sessao}>
            {finalizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
            Finalizar venda
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-white">
          {ehDono ? 'Últimas vendas da loja' : 'Minhas últimas vendas'}
        </div>
        {vendasRecentes.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Nenhuma venda registrada.</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-800">
            <thead>
              <tr>
                <th className="th-base">Data</th>
                <th className="th-base">Itens</th>
                <th className="th-base">Pagamento</th>
                <th className="th-base">Vendedor</th>
                <th className="th-base text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {vendasRecentes.map((v) => (
                <tr key={v.id}>
                  <td className="td-base whitespace-nowrap">{formatarDataHora(v.criadoEm)}</td>
                  <td className="td-base">{(v.itens || []).map((i) => `${i.quantidade}x ${i.nome}`).join(', ')}</td>
                  <td className="td-base">{v.formaPagamento}</td>
                  <td className="td-base">{v.usuarioNome}</td>
                  <td className="td-base text-right font-medium">{formatarMoeda(v.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
