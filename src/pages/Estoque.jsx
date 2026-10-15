import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { AlertTriangle, Loader2, Pencil, Plus, Save, Search, Trash2 } from 'lucide-react';
import { db } from '../firebase/config.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import { docsParaLista } from '../utils/firestore.js';
import { filtrarValor, formatarMoeda, parseValor, valorParaInput } from '../utils/masks.js';

const FORM_VAZIO = { nome: '', categoria: '', quantidade: '0', custo: '', precoVenda: '', estoqueMinimo: '0' };

export default function Estoque() {
  const { usuario } = useAuth();
  const { loja } = useOutletContext();
  const ehDono = usuario.cargo === 'dono';

  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const cancelar = onSnapshot(
      collection(db, 'lojas', loja.id, 'estoque'),
      (snap) => {
        setProdutos(docsParaLista(snap).sort((a, b) => String(a.nome).localeCompare(String(b.nome))));
        setCarregando(false);
      },
      (e) => {
        console.error(e);
        setErro('Não foi possível carregar o estoque.');
        setCarregando(false);
      }
    );
    return () => cancelar();
  }, [loja.id]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter((p) => `${p.nome} ${p.categoria}`.toLowerCase().includes(termo));
  }, [produtos, busca]);

  const abaixoDoMinimo = produtos.filter((p) => (Number(p.quantidade) || 0) <= (Number(p.estoqueMinimo) || 0));

  function abrirNovo() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setErroForm('');
    setModalAberto(true);
  }

  function abrirEdicao(produto) {
    setEditandoId(produto.id);
    setForm({
      nome: produto.nome || '',
      categoria: produto.categoria || '',
      quantidade: String(Number(produto.quantidade) || 0),
      custo: valorParaInput(produto.custo),
      precoVenda: valorParaInput(produto.precoVenda),
      estoqueMinimo: String(Number(produto.estoqueMinimo) || 0),
    });
    setErroForm('');
    setModalAberto(true);
  }

  function alterar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar(evento) {
    evento.preventDefault();
    setErroForm('');

    if (!form.nome.trim()) return setErroForm('Informe o nome do produto.');

    const payload = {
      nome: form.nome.trim(),
      categoria: form.categoria.trim(),
      quantidade: parseInt(form.quantidade, 10) || 0,
      custo: parseValor(form.custo),
      precoVenda: parseValor(form.precoVenda),
      estoqueMinimo: parseInt(form.estoqueMinimo, 10) || 0,
    };

    setSalvando(true);
    try {
      if (editandoId) {
        await updateDoc(doc(db, 'lojas', loja.id, 'estoque', editandoId), payload);
      } else {
        await addDoc(collection(db, 'lojas', loja.id, 'estoque'), { ...payload, criadoEm: serverTimestamp() });
      }
      setModalAberto(false);
    } catch (e) {
      console.error(e);
      setErroForm('Não foi possível salvar o produto.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(produto) {
    if (!window.confirm(`Excluir "${produto.nome}" do estoque?`)) return;
    try {
      await deleteDoc(doc(db, 'lojas', loja.id, 'estoque', produto.id));
    } catch (e) {
      console.error(e);
      setErro('Não foi possível excluir o produto.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Estoque</h1>
          <p className="text-sm text-slate-400">Uso opcional: a baixa é automática quando o produto é vinculado a uma OS ou venda</p>
        </div>
        {ehDono && (
          <button type="button" className="btn-primary" onClick={abrirNovo}>
            <Plus className="h-4 w-4" />
            Novo produto
          </button>
        )}
      </div>

      {abaixoDoMinimo.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-800 bg-amber-950/50 px-3 py-2 text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {abaixoDoMinimo.length} produto(s) no estoque mínimo ou abaixo: {abaixoDoMinimo.map((p) => p.nome).join(', ')}.
          </span>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
        <input className="input-base pl-9" placeholder="Buscar por nome ou categoria" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {erro && <div className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">{erro}</div>}

      <div className="card overflow-x-auto p-0">
        {carregando ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          </div>
        ) : filtrados.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            {produtos.length === 0 ? 'Nenhum produto cadastrado ainda.' : 'Nenhum produto encontrado.'}
          </p>
        ) : (
          <table className="min-w-full divide-y divide-slate-800">
            <thead>
              <tr>
                <th className="th-base">Produto</th>
                <th className="th-base">Categoria</th>
                <th className="th-base text-right">Qtd</th>
                <th className="th-base text-right">Mínimo</th>
                {ehDono && <th className="th-base text-right">Custo</th>}
                <th className="th-base text-right">Preço de venda</th>
                {ehDono && <th className="th-base text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtrados.map((p) => {
                const baixo = (Number(p.quantidade) || 0) <= (Number(p.estoqueMinimo) || 0);
                return (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="td-base font-medium">{p.nome}</td>
                    <td className="td-base">{p.categoria || '-'}</td>
                    <td className="td-base text-right">
                      <span className={baixo ? 'font-bold text-amber-300' : ''}>{Number(p.quantidade) || 0}</span>
                    </td>
                    <td className="td-base text-right">{Number(p.estoqueMinimo) || 0}</td>
                    {ehDono && <td className="td-base text-right">{formatarMoeda(p.custo)}</td>}
                    <td className="td-base text-right">{formatarMoeda(p.precoVenda)}</td>
                    {ehDono && (
                      <td className="td-base">
                        <div className="flex justify-end gap-1">
                          <button type="button" className="rounded p-2 text-slate-300 hover:bg-slate-700" onClick={() => abrirEdicao(p)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" className="rounded p-2 text-red-400 hover:bg-slate-700" onClick={() => excluir(p)} title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalAberto && (
        <Modal titulo={editandoId ? 'Editar produto' : 'Novo produto'} onClose={() => setModalAberto(false)}>
          <form onSubmit={salvar} className="space-y-3">
            <div>
              <label className="label-base">Nome</label>
              <input className="input-base" value={form.nome} onChange={(e) => alterar('nome', e.target.value)} placeholder="Ex: Tela iPhone 11" />
            </div>
            <div>
              <label className="label-base">Categoria</label>
              <input className="input-base" value={form.categoria} onChange={(e) => alterar('categoria', e.target.value)} placeholder="Ex: Telas, Baterias, Capas" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-base">Quantidade</label>
                <input className="input-base" inputMode="numeric" value={form.quantidade} onChange={(e) => alterar('quantidade', e.target.value.replace(/\D/g, ''))} />
              </div>
              <div>
                <label className="label-base">Estoque mínimo</label>
                <input className="input-base" inputMode="numeric" value={form.estoqueMinimo} onChange={(e) => alterar('estoqueMinimo', e.target.value.replace(/\D/g, ''))} />
              </div>
              <div>
                <label className="label-base">Custo (R$)</label>
                <input className="input-base" inputMode="decimal" value={form.custo} onChange={(e) => alterar('custo', filtrarValor(e.target.value))} placeholder="0,00" />
              </div>
              <div>
                <label className="label-base">Preço de venda (R$)</label>
                <input className="input-base" inputMode="decimal" value={form.precoVenda} onChange={(e) => alterar('precoVenda', filtrarValor(e.target.value))} placeholder="0,00" />
              </div>
            </div>

            {erroForm && <div className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">{erroForm}</div>}

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button type="button" className="btn-secondary" onClick={() => setModalAberto(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={salvando}>
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar produto
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
