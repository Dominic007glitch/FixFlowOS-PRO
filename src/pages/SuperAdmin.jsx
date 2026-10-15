import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { Loader2, LogOut, Mail, Plus, Power, ShieldCheck } from 'lucide-react';
import { auth, db, secondaryAuth } from '../firebase/config.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import { PLANOS, getPlano, textoLimite } from '../utils/planos.js';
import { docsParaLista } from '../utils/firestore.js';
import { formatarData } from '../utils/datas.js';
import { formatarMoeda } from '../utils/masks.js';

const FORM_VAZIO = { nomeLoja: '', plano: '1', donoNome: '', donoEmail: '', donoSenha: '' };

function traduzirErroAuth(e) {
  const codigo = e && e.code ? e.code : '';
  if (codigo === 'auth/email-already-in-use') return 'Este e-mail já está em uso por outra conta.';
  if (codigo === 'auth/invalid-email') return 'E-mail inválido.';
  if (codigo === 'auth/weak-password') return 'A senha precisa ter pelo menos 6 caracteres.';
  return e && e.message ? e.message : 'Não foi possível concluir a operação.';
}

export default function SuperAdmin() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const [lojas, setLojas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erroForm, setErroForm] = useState('');
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    const cancelarLojas = onSnapshot(
      collection(db, 'lojas'),
      (snap) => {
        setLojas(docsParaLista(snap).sort((a, b) => String(a.nome).localeCompare(String(b.nome))));
        setCarregando(false);
      },
      (e) => {
        console.error(e);
        setErro('Não foi possível carregar as lojas.');
        setCarregando(false);
      }
    );

    const cancelarUsuarios = onSnapshot(
      collection(db, 'usuarios'),
      (snap) => setUsuarios(docsParaLista(snap)),
      (e) => console.error(e)
    );

    return () => {
      cancelarLojas();
      cancelarUsuarios();
    };
  }, []);

  function usuariosAtivos(lojaId) {
    return usuarios.filter((u) => u.lojaId === lojaId && u.ativo !== false).length;
  }

  function mostrarAviso(texto) {
    setAviso(texto);
    setTimeout(() => setAviso(''), 5000);
  }

  function alterar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function sair() {
    await logout();
    navigate('/login', { replace: true });
  }

  async function criarLoja(evento) {
    evento.preventDefault();
    setErroForm('');

    if (!form.nomeLoja.trim()) return setErroForm('Informe o nome da loja.');
    if (!form.donoNome.trim()) return setErroForm('Informe o nome do dono.');
    if (form.donoSenha.length < 6) return setErroForm('A senha inicial precisa ter pelo menos 6 caracteres.');

    setCriando(true);
    try {
      const email = form.donoEmail.trim();

      // 1) Cria a conta do dono no app SECUNDÁRIO (não derruba a sessão do Super Admin)
      const credencial = await createUserWithEmailAndPassword(secondaryAuth, email, form.donoSenha);
      await signOut(secondaryAuth);

      // 2) Grava loja, perfil do dono e contador de OS de uma vez só
      const lojaRef = doc(collection(db, 'lojas'));
      const batch = writeBatch(db);

      batch.set(lojaRef, {
        nome: form.nomeLoja.trim(),
        plano: Number(form.plano),
        ativo: true,
        donoUid: credencial.user.uid,
        donoNome: form.donoNome.trim(),
        donoEmail: email,
        criadoEm: serverTimestamp(),
      });

      batch.set(doc(db, 'usuarios', credencial.user.uid), {
        nome: form.donoNome.trim(),
        email,
        cargo: 'dono',
        lojaId: lojaRef.id,
        ativo: true,
        criadoEm: serverTimestamp(),
      });

      batch.set(doc(db, 'lojas', lojaRef.id, 'configuracoes', 'geral'), { contadorOS: 0 });

      await batch.commit();

      setModalAberto(false);
      setForm(FORM_VAZIO);
      mostrarAviso('Loja criada com sucesso.');
    } catch (e) {
      console.error(e);
      setErroForm(traduzirErroAuth(e));
    } finally {
      setCriando(false);
    }
  }

  async function alterarPlano(loja, plano) {
    setErro('');
    try {
      await updateDoc(doc(db, 'lojas', loja.id), { plano: Number(plano) });
    } catch (e) {
      console.error(e);
      setErro('Não foi possível alterar o plano.');
    }
  }

  async function alternarAtiva(loja) {
    setErro('');
    try {
      await updateDoc(doc(db, 'lojas', loja.id), { ativo: loja.ativo === false });
    } catch (e) {
      console.error(e);
      setErro('Não foi possível alterar o status da loja.');
    }
  }

  async function redefinirSenhaDono(loja) {
    setErro('');
    try {
      await sendPasswordResetEmail(auth, loja.donoEmail);
      mostrarAviso(`E-mail de redefinição enviado para ${loja.donoEmail}.`);
    } catch (e) {
      console.error(e);
      setErro(traduzirErroAuth(e));
    }
  }

  const lojasAtivas = lojas.filter((l) => l.ativo !== false);
  const receitaMensal = lojasAtivas.reduce((soma, l) => soma + getPlano(l.plano).preco, 0);

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">FixFlowOS Pro - Super Admin</p>
            <p className="text-xs text-slate-400">{usuario.nome}</p>
          </div>
        </div>
        <button type="button" className="btn-secondary" onClick={sair}>
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-white">Lojas</h1>
          <button type="button" className="btn-primary" onClick={() => { setForm(FORM_VAZIO); setErroForm(''); setModalAberto(true); }}>
            <Plus className="h-4 w-4" />
            Nova loja
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="card">
            <p className="text-xs text-slate-400">Lojas cadastradas</p>
            <p className="text-2xl font-bold text-white">{lojas.length}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-400">Lojas ativas</p>
            <p className="text-2xl font-bold text-emerald-300">{lojasAtivas.length}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-400">Receita mensal (ativas)</p>
            <p className="text-2xl font-bold text-white">{formatarMoeda(receitaMensal)}</p>
          </div>
        </div>

        {erro && <div className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">{erro}</div>}
        {aviso && <div className="rounded-lg border border-emerald-900 bg-emerald-950/60 px-3 py-2 text-sm text-emerald-300">{aviso}</div>}

        <div className="card overflow-x-auto p-0">
          {carregando ? (
            <div className="flex justify-center p-10">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            </div>
          ) : lojas.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">Nenhuma loja cadastrada ainda.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-800">
              <thead>
                <tr>
                  <th className="th-base">Loja</th>
                  <th className="th-base">Dono</th>
                  <th className="th-base">Plano</th>
                  <th className="th-base">Usuários</th>
                  <th className="th-base">Criada em</th>
                  <th className="th-base">Status</th>
                  <th className="th-base text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {lojas.map((l) => (
                  <tr key={l.id}>
                    <td className="td-base">
                      <div className="font-medium">{l.nome}</div>
                      <div className="text-xs text-slate-500">ID: {l.id}</div>
                    </td>
                    <td className="td-base">
                      <div>{l.donoNome || '-'}</div>
                      <div className="text-xs text-slate-500">{l.donoEmail}</div>
                    </td>
                    <td className="td-base">
                      <select className="input-base w-auto" value={String(l.plano)} onChange={(e) => alterarPlano(l, e.target.value)}>
                        {Object.values(PLANOS).map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.nome} - {formatarMoeda(p.preco)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="td-base">
                      {usuariosAtivos(l.id)} / {textoLimite(l.plano)}
                    </td>
                    <td className="td-base whitespace-nowrap">{formatarData(l.criadoEm)}</td>
                    <td className="td-base">
                      <span className={l.ativo === false ? 'text-red-300' : 'text-emerald-300'}>{l.ativo === false ? 'Desativada' : 'Ativa'}</span>
                    </td>
                    <td className="td-base">
                      <div className="flex justify-end gap-1">
                        <button type="button" className="rounded p-2 text-slate-300 hover:bg-slate-700" title="Enviar e-mail para redefinir senha do dono" onClick={() => redefinirSenhaDono(l)}>
                          <Mail className="h-4 w-4" />
                        </button>
                        <button type="button" className="rounded p-2 text-slate-300 hover:bg-slate-700" title={l.ativo === false ? 'Reativar loja' : 'Desativar loja'} onClick={() => alternarAtiva(l)}>
                          <Power className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {modalAberto && (
        <Modal titulo="Nova loja" onClose={() => setModalAberto(false)}>
          <form onSubmit={criarLoja} className="space-y-3">
            <div>
              <label className="label-base">Nome da loja</label>
              <input className="input-base" value={form.nomeLoja} onChange={(e) => alterar('nomeLoja', e.target.value)} />
            </div>
            <div>
              <label className="label-base">Plano</label>
              <select className="input-base" value={form.plano} onChange={(e) => alterar('plano', e.target.value)}>
                {Object.values(PLANOS).map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.nome} - {formatarMoeda(p.preco)} ({p.limiteUsuarios === Infinity ? 'usuários ilimitados' : `até ${p.limiteUsuarios} usuários`})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-base">Nome do dono</label>
              <input className="input-base" value={form.donoNome} onChange={(e) => alterar('donoNome', e.target.value)} />
            </div>
            <div>
              <label className="label-base">E-mail do dono (login)</label>
              <input type="email" required className="input-base" value={form.donoEmail} onChange={(e) => alterar('donoEmail', e.target.value)} />
            </div>
            <div>
              <label className="label-base">Senha inicial do dono</label>
              <input type="text" className="input-base" value={form.donoSenha} onChange={(e) => alterar('donoSenha', e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>

            {erroForm && <div className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">{erroForm}</div>}

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button type="button" className="btn-secondary" onClick={() => setModalAberto(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={criando}>
                {criando && <Loader2 className="h-4 w-4 animate-spin" />}
                Criar loja
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
