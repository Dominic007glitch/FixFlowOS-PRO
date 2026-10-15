import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { Loader2, Mail, Plus, Power, Trash2, UserPlus } from 'lucide-react';
import { auth, db, secondaryAuth } from '../firebase/config.js';
import { CARGOS, getPlano, podeAdicionarUsuario, textoLimite } from '../utils/planos.js';
import { docsParaLista } from '../utils/firestore.js';
import { formatarData, hojeISO, isoParaDate } from '../utils/datas.js';
import { filtrarValor, formatarMoeda, parseValor } from '../utils/masks.js';

const TIPOS_LANCAMENTO = [
  { id: 'salario', nome: 'Salário' },
  { id: 'adiantamento', nome: 'Adiantamento' },
  { id: 'vale', nome: 'Vale' },
];

function traduzirErroAuth(e) {
  const codigo = e && e.code ? e.code : '';
  if (codigo === 'auth/email-already-in-use') return 'Este e-mail já está em uso.';
  if (codigo === 'auth/invalid-email') return 'E-mail inválido.';
  if (codigo === 'auth/weak-password') return 'A senha precisa ter pelo menos 6 caracteres.';
  return e && e.message ? e.message : 'Não foi possível concluir a operação.';
}

export default function Equipe() {
  const { loja } = useOutletContext();
  const plano = getPlano(loja.plano);

  const [aba, setAba] = useState('funcionarios');
  const [usuarios, setUsuarios] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const [novo, setNovo] = useState({ nome: '', email: '', senha: '', cargo: 'vendedor' });
  const [criando, setCriando] = useState(false);

  const [lanc, setLanc] = useState({ funcionarioUid: '', tipo: 'salario', valor: '', data: hojeISO(), descricao: '' });
  const [salvandoLanc, setSalvandoLanc] = useState(false);

  useEffect(() => {
    const cancelarUsuarios = onSnapshot(
      query(collection(db, 'usuarios'), where('lojaId', '==', loja.id)),
      (snap) => {
        setUsuarios(docsParaLista(snap).sort((a, b) => String(a.nome).localeCompare(String(b.nome))));
        setCarregando(false);
      },
      (e) => {
        console.error(e);
        setErro('Não foi possível carregar a equipe.');
        setCarregando(false);
      }
    );

    const cancelarLanc = onSnapshot(
      collection(db, 'lojas', loja.id, 'equipe'),
      (snap) => setLancamentos(docsParaLista(snap).sort((a, b) => String(b.data).localeCompare(String(a.data)))),
      (e) => console.error(e)
    );

    return () => {
      cancelarUsuarios();
      cancelarLanc();
    };
  }, [loja.id]);

  const ativos = usuarios.filter((u) => u.ativo !== false).length;
  const podeAdicionar = podeAdicionarUsuario(loja.plano, ativos);

  const totalMes = useMemo(() => {
    const agora = new Date();
    return lancamentos
      .filter((l) => {
        const data = isoParaDate(l.data);
        return data.getMonth() === agora.getMonth() && data.getFullYear() === agora.getFullYear();
      })
      .reduce((soma, l) => soma + parseValor(l.valor), 0);
  }, [lancamentos]);

  function mostrarAviso(texto) {
    setAviso(texto);
    setTimeout(() => setAviso(''), 5000);
  }

  async function criarFuncionario(evento) {
    evento.preventDefault();
    setErro('');

    if (!podeAdicionar) return setErro(`Limite do ${plano.nome} atingido (${textoLimite(loja.plano)} usuários).`);
    if (!novo.nome.trim()) return setErro('Informe o nome do funcionário.');
    if (novo.senha.length < 6) return setErro('A senha inicial precisa ter pelo menos 6 caracteres.');

    setCriando(true);
    try {
      // Cria a conta no app SECUNDÁRIO para não deslogar o dono.
      const credencial = await createUserWithEmailAndPassword(secondaryAuth, novo.email.trim(), novo.senha);
      await signOut(secondaryAuth);

      await setDoc(doc(db, 'usuarios', credencial.user.uid), {
        nome: novo.nome.trim(),
        email: novo.email.trim(),
        cargo: novo.cargo,
        lojaId: loja.id,
        ativo: true,
        criadoEm: serverTimestamp(),
      });

      setNovo({ nome: '', email: '', senha: '', cargo: 'vendedor' });
      mostrarAviso('Funcionário cadastrado com sucesso.');
    } catch (e) {
      console.error(e);
      setErro(traduzirErroAuth(e));
    } finally {
      setCriando(false);
    }
  }

  async function alternarAtivo(usuario) {
    setErro('');
    const vaiAtivar = usuario.ativo === false;
    if (vaiAtivar && !podeAdicionar) {
      return setErro(`Limite do ${plano.nome} atingido. Desative outro usuário antes de reativar este.`);
    }
    try {
      await updateDoc(doc(db, 'usuarios', usuario.id), { ativo: vaiAtivar });
    } catch (e) {
      console.error(e);
      setErro('Não foi possível alterar o status do usuário.');
    }
  }

  async function enviarRedefinicao(usuario) {
    setErro('');
    try {
      await sendPasswordResetEmail(auth, usuario.email);
      mostrarAviso(`E-mail de redefinição enviado para ${usuario.email}.`);
    } catch (e) {
      console.error(e);
      setErro(traduzirErroAuth(e));
    }
  }

  async function registrarLancamento(evento) {
    evento.preventDefault();
    setErro('');

    const funcionario = usuarios.find((u) => u.id === lanc.funcionarioUid);
    const valor = parseValor(lanc.valor);

    if (!funcionario) return setErro('Selecione o funcionário.');
    if (valor <= 0) return setErro('Informe um valor maior que zero.');
    if (!lanc.data) return setErro('Informe a data.');

    setSalvandoLanc(true);
    try {
      await addDoc(collection(db, 'lojas', loja.id, 'equipe'), {
        funcionarioUid: funcionario.id,
        funcionarioNome: funcionario.nome,
        tipo: lanc.tipo,
        valor,
        data: lanc.data,
        descricao: lanc.descricao.trim(),
        criadoEm: serverTimestamp(),
      });
      setLanc({ funcionarioUid: '', tipo: 'salario', valor: '', data: hojeISO(), descricao: '' });
      mostrarAviso('Lançamento registrado.');
    } catch (e) {
      console.error(e);
      setErro('Não foi possível registrar o lançamento.');
    } finally {
      setSalvandoLanc(false);
    }
  }

  async function excluirLancamento(item) {
    if (!window.confirm('Excluir este lançamento?')) return;
    try {
      await deleteDoc(doc(db, 'lojas', loja.id, 'equipe', item.id));
    } catch (e) {
      console.error(e);
      setErro('Não foi possível excluir o lançamento.');
    }
  }

  if (carregando) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Equipe / RH</h1>
        <p className="text-sm text-slate-400">
          {plano.nome}: {ativos} de {textoLimite(loja.plano)} usuários ativos
        </p>
      </div>

      <div className="flex gap-2 border-b border-slate-800">
        {[
          { id: 'funcionarios', nome: 'Funcionários' },
          { id: 'lancamentos', nome: 'Salários, adiantamentos e vales' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAba(item.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              aba === item.id ? 'border-brand-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.nome}
          </button>
        ))}
      </div>

      {erro && <div className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">{erro}</div>}
      {aviso && <div className="rounded-lg border border-emerald-900 bg-emerald-950/60 px-3 py-2 text-sm text-emerald-300">{aviso}</div>}

      {aba === 'funcionarios' && (
        <div className="space-y-4">
          <form onSubmit={criarFuncionario} className="card space-y-3">
            <div className="flex items-center gap-2 text-white">
              <UserPlus className="h-5 w-5" />
              <span className="font-semibold">Novo funcionário</span>
            </div>
            {!podeAdicionar && (
              <p className="text-sm text-amber-300">
                Limite de usuários do {plano.nome} atingido. Para cadastrar mais, desative alguém ou peça a troca de plano ao administrador.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="label-base">Nome</label>
                <input className="input-base" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
              </div>
              <div>
                <label className="label-base">E-mail</label>
                <input type="email" className="input-base" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
              </div>
              <div>
                <label className="label-base">Senha inicial</label>
                <input type="text" className="input-base" value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <label className="label-base">Cargo</label>
                <select className="input-base" value={novo.cargo} onChange={(e) => setNovo({ ...novo, cargo: e.target.value })}>
                  <option value="vendedor">Vendedor</option>
                  <option value="tecnico">Técnico</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={criando || !podeAdicionar}>
              {criando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Cadastrar funcionário
            </button>
          </form>

          <div className="card overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-slate-800">
              <thead>
                <tr>
                  <th className="th-base">Nome</th>
                  <th className="th-base">E-mail</th>
                  <th className="th-base">Cargo</th>
                  <th className="th-base">Status</th>
                  <th className="th-base text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td className="td-base font-medium">{u.nome}</td>
                    <td className="td-base">{u.email}</td>
                    <td className="td-base">{CARGOS[u.cargo] || u.cargo}</td>
                    <td className="td-base">
                      <span className={u.ativo === false ? 'text-red-300' : 'text-emerald-300'}>{u.ativo === false ? 'Desativado' : 'Ativo'}</span>
                    </td>
                    <td className="td-base">
                      {u.cargo !== 'dono' && (
                        <div className="flex justify-end gap-1">
                          <button type="button" className="rounded p-2 text-slate-300 hover:bg-slate-700" title="Enviar e-mail para redefinir senha" onClick={() => enviarRedefinicao(u)}>
                            <Mail className="h-4 w-4" />
                          </button>
                          <button type="button" className="rounded p-2 text-slate-300 hover:bg-slate-700" title={u.ativo === false ? 'Reativar' : 'Desativar'} onClick={() => alternarAtivo(u)}>
                            <Power className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === 'lancamentos' && (
        <div className="space-y-4">
          <form onSubmit={registrarLancamento} className="card space-y-3">
            <span className="font-semibold text-white">Novo lançamento</span>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="label-base">Funcionário</label>
                <select className="input-base" value={lanc.funcionarioUid} onChange={(e) => setLanc({ ...lanc, funcionarioUid: e.target.value })}>
                  <option value="">Selecione...</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-base">Tipo</label>
                <select className="input-base" value={lanc.tipo} onChange={(e) => setLanc({ ...lanc, tipo: e.target.value })}>
                  {TIPOS_LANCAMENTO.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-base">Valor (R$)</label>
                <input className="input-base" inputMode="decimal" value={lanc.valor} onChange={(e) => setLanc({ ...lanc, valor: filtrarValor(e.target.value) })} placeholder="0,00" />
              </div>
              <div>
                <label className="label-base">Data</label>
                <input type="date" className="input-base" value={lanc.data} onChange={(e) => setLanc({ ...lanc, data: e.target.value })} />
              </div>
              <div>
                <label className="label-base">Observação</label>
                <input className="input-base" value={lanc.descricao} onChange={(e) => setLanc({ ...lanc, descricao: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={salvandoLanc}>
              {salvandoLanc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Registrar lançamento
            </button>
          </form>

          <div className="card text-sm text-slate-300">
            Total lançado neste mês: <b className="text-white">{formatarMoeda(totalMes)}</b>
          </div>

          <div className="card overflow-x-auto p-0">
            {lancamentos.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">Nenhum lançamento registrado.</p>
            ) : (
              <table className="min-w-full divide-y divide-slate-800">
                <thead>
                  <tr>
                    <th className="th-base">Data</th>
                    <th className="th-base">Funcionário</th>
                    <th className="th-base">Tipo</th>
                    <th className="th-base">Observação</th>
                    <th className="th-base text-right">Valor</th>
                    <th className="th-base text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {lancamentos.map((l) => (
                    <tr key={l.id}>
                      <td className="td-base whitespace-nowrap">{formatarData(isoParaDate(l.data))}</td>
                      <td className="td-base">{l.funcionarioNome}</td>
                      <td className="td-base">{(TIPOS_LANCAMENTO.find((t) => t.id === l.tipo) || {}).nome || l.tipo}</td>
                      <td className="td-base">{l.descricao || '-'}</td>
                      <td className="td-base text-right font-medium">{formatarMoeda(l.valor)}</td>
                      <td className="td-base text-right">
                        <button type="button" className="rounded p-2 text-red-400 hover:bg-slate-700" onClick={() => excluirLancamento(l)} title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
