import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Loader2, Plus, Printer, Save, Tag, Trash2 } from 'lucide-react';
import { db } from '../firebase/config.js';
import Modal from './Modal.jsx';
import { criarOS, atualizarOS, STATUS_OS, TIPOS_SENHA } from '../services/osService.js';
import { filtrarSenhaPadrao, filtrarValor, mascaraTelefone, parseValor, valorParaInput } from '../utils/masks.js';
import { docsParaLista } from '../utils/firestore.js';
import { imprimirEtiqueta, imprimirViaCliente } from '../utils/printOS.js';

const FORM_VAZIO = {
  clienteNome: '',
  clienteTelefone: '',
  aparelho: '',
  imei: '',
  defeito: '',
  tipoSenha: 'nenhuma',
  senhaAparelho: '',
  valorTexto: '',
  status: 'Aguardando orçamento',
  observacoes: '',
  termoLGPD: false,
  pecas: [],
};

// os: OS existente (edição) ou null (nova OS)
export default function OSModal({ loja, usuario, os, onClose, onSalvo }) {
  const edicao = Boolean(os);
  const podeVincularEstoque = usuario.cargo === 'dono' || usuario.cargo === 'vendedor';
  const ehDono = usuario.cargo === 'dono';

  const contadorKey = useRef(0);
  const novaKey = () => {
    contadorKey.current += 1;
    return `peca-${contadorKey.current}`;
  };

  const [form, setForm] = useState(FORM_VAZIO);
  const [estoque, setEstoque] = useState([]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (os) {
      setForm({
        clienteNome: os.clienteNome || '',
        clienteTelefone: os.clienteTelefone || '',
        aparelho: os.aparelho || '',
        imei: os.imei || '',
        defeito: os.defeito || '',
        tipoSenha: os.tipoSenha || 'nenhuma',
        senhaAparelho: os.senhaAparelho || '',
        valorTexto: valorParaInput(os.valor),
        status: os.status || 'Aguardando orçamento',
        observacoes: os.observacoes || '',
        termoLGPD: Boolean(os.termoLGPD),
        pecas: (os.pecas || []).map((p) => ({
          key: novaKey(),
          produtoId: p.produtoId || '',
          nome: p.nome || '',
          quantidade: String(p.quantidade || 1),
          custo: String(parseValor(p.custo)),
        })),
      });
    } else {
      setForm(FORM_VAZIO);
    }
    setErro('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [os]);

  useEffect(() => {
    if (!podeVincularEstoque) return undefined;
    const cancelar = onSnapshot(
      collection(db, 'lojas', loja.id, 'estoque'),
      (snap) => setEstoque(docsParaLista(snap).sort((a, b) => String(a.nome).localeCompare(String(b.nome)))),
      (e) => console.error('Erro ao carregar estoque:', e)
    );
    return () => cancelar();
  }, [loja.id, podeVincularEstoque]);

  function alterar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  function alterarTipoSenha(tipo) {
    setForm((atual) => ({ ...atual, tipoSenha: tipo, senhaAparelho: '' }));
  }

  function alterarSenha(texto) {
    let valor = texto;
    if (form.tipoSenha === 'padrao') valor = filtrarSenhaPadrao(texto);
    if (form.tipoSenha === 'pin') valor = texto.replace(/\D/g, '').slice(0, 8);
    alterar('senhaAparelho', valor);
  }

  function adicionarPecaManual() {
    setForm((atual) => ({
      ...atual,
      pecas: [...atual.pecas, { key: novaKey(), produtoId: '', nome: '', quantidade: '1', custo: '0' }],
    }));
  }

  function adicionarPecaEstoque(produtoId) {
    const produto = estoque.find((p) => p.id === produtoId);
    if (!produto) return;
    setForm((atual) => ({
      ...atual,
      pecas: [
        ...atual.pecas,
        {
          key: novaKey(),
          produtoId: produto.id,
          nome: produto.nome,
          quantidade: '1',
          custo: String(parseValor(produto.custo)),
        },
      ],
    }));
  }

  function alterarPeca(key, campo, valor) {
    setForm((atual) => ({
      ...atual,
      pecas: atual.pecas.map((p) => (p.key === key ? { ...p, [campo]: valor } : p)),
    }));
  }

  function removerPeca(key) {
    setForm((atual) => ({ ...atual, pecas: atual.pecas.filter((p) => p.key !== key) }));
  }

  function montarPayload() {
    return {
      clienteNome: form.clienteNome.trim(),
      clienteTelefone: form.clienteTelefone,
      aparelho: form.aparelho.trim(),
      imei: form.imei.trim(),
      defeito: form.defeito.trim(),
      tipoSenha: form.tipoSenha,
      senhaAparelho: form.tipoSenha === 'nenhuma' ? '' : form.senhaAparelho,
      pecas: form.pecas
        .filter((p) => p.nome.trim() !== '')
        .map((p) => ({
          produtoId: p.produtoId || '',
          nome: p.nome.trim(),
          quantidade: Math.max(1, parseInt(p.quantidade, 10) || 1),
          custo: parseValor(p.custo),
        })),
      valor: parseValor(form.valorTexto),
      status: form.status,
      observacoes: form.observacoes.trim(),
      termoLGPD: true,
    };
  }

  async function salvar(evento) {
    evento.preventDefault();
    setErro('');

    if (!form.clienteNome.trim()) return setErro('Informe o nome do cliente.');
    if (form.clienteTelefone.replace(/\D/g, '').length < 10) return setErro('Informe um telefone válido com DDD.');
    if (!form.aparelho.trim()) return setErro('Informe o aparelho.');
    if (!form.defeito.trim()) return setErro('Descreva o defeito relatado.');
    if (form.tipoSenha !== 'nenhuma' && !form.senhaAparelho) return setErro('Informe a senha do aparelho ou escolha "Sem senha".');
    if (!form.termoLGPD) return setErro('É necessário aceitar o Termo de Responsabilidade / LGPD.');

    setSalvando(true);
    try {
      const payload = montarPayload();
      if (edicao) {
        await atualizarOS(loja.id, os.id, payload);
      } else {
        await criarOS(loja.id, payload, usuario);
      }
      onSalvo();
    } catch (e) {
      console.error(e);
      setErro(e && e.message ? e.message : 'Não foi possível salvar a OS.');
      setSalvando(false);
    }
  }

  const placeholderSenha =
    form.tipoSenha === 'padrao' ? 'Ex: 14789 (somente 1 a 9)' : form.tipoSenha === 'pin' ? 'Somente números' : 'Senha do aparelho';

  return (
    <Modal titulo={edicao ? `Editar OS Nº ${os.numeroOS}` : 'Nova Ordem de Serviço'} onClose={onClose} largura="max-w-3xl">
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label-base">Cliente</label>
            <input className="input-base" value={form.clienteNome} onChange={(e) => alterar('clienteNome', e.target.value)} placeholder="Nome do cliente" />
          </div>
          <div>
            <label className="label-base">Telefone</label>
            <input
              className="input-base"
              inputMode="numeric"
              value={form.clienteTelefone}
              onChange={(e) => alterar('clienteTelefone', mascaraTelefone(e.target.value.replace(/\D/g, '')))}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div>
            <label className="label-base">Aparelho (marca / modelo)</label>
            <input className="input-base" value={form.aparelho} onChange={(e) => alterar('aparelho', e.target.value)} placeholder="Ex: Samsung Galaxy A54" />
          </div>
          <div>
            <label className="label-base">IMEI</label>
            <input className="input-base" inputMode="numeric" value={form.imei} onChange={(e) => alterar('imei', e.target.value.replace(/\D/g, '').slice(0, 17))} placeholder="Somente números" />
          </div>
        </div>

        <div>
          <label className="label-base">Defeito relatado</label>
          <textarea className="input-base" rows={2} value={form.defeito} onChange={(e) => alterar('defeito', e.target.value)} placeholder="Descreva o problema" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label-base">Tipo de senha</label>
            <select className="input-base" value={form.tipoSenha} onChange={(e) => alterarTipoSenha(e.target.value)}>
              {TIPOS_SENHA.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-base">Senha do aparelho</label>
            <input
              className="input-base"
              disabled={form.tipoSenha === 'nenhuma'}
              inputMode={form.tipoSenha === 'texto' ? 'text' : 'numeric'}
              value={form.senhaAparelho}
              onChange={(e) => alterarSenha(e.target.value)}
              placeholder={form.tipoSenha === 'nenhuma' ? 'Sem senha' : placeholderSenha}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white">Peças utilizadas</span>
            <div className="flex flex-wrap gap-2">
              {podeVincularEstoque && (
                <select
                  className="input-base w-auto max-w-[14rem]"
                  value=""
                  onChange={(e) => adicionarPecaEstoque(e.target.value)}
                >
                  <option value="">Vincular do estoque...</option>
                  {estoque.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({Number(p.quantidade) || 0} un.)
                    </option>
                  ))}
                </select>
              )}
              <button type="button" className="btn-secondary" onClick={adicionarPecaManual}>
                <Plus className="h-4 w-4" />
                Peça manual
              </button>
            </div>
          </div>

          {form.pecas.length === 0 && <p className="text-xs text-slate-500">Nenhuma peça adicionada.</p>}

          <div className="space-y-2">
            {form.pecas.map((p) => {
              const vinculada = Boolean(p.produtoId);
              const travada = vinculada && !podeVincularEstoque;
              return (
                <div key={p.key} className="grid grid-cols-12 items-center gap-2">
                  <div className={ehDono && !vinculada ? 'col-span-6' : 'col-span-8'}>
                    <input
                      className="input-base"
                      value={p.nome}
                      readOnly={vinculada}
                      onChange={(e) => alterarPeca(p.key, 'nome', e.target.value)}
                      placeholder="Nome da peça"
                    />
                    {vinculada && <span className="text-[10px] text-brand-400">Vinculada ao estoque</span>}
                  </div>
                  <div className="col-span-2">
                    <input
                      className="input-base"
                      inputMode="numeric"
                      value={p.quantidade}
                      onChange={(e) => alterarPeca(p.key, 'quantidade', e.target.value.replace(/\D/g, ''))}
                      placeholder="Qtd"
                    />
                  </div>
                  {ehDono && !vinculada && (
                    <div className="col-span-2">
                      <input
                        className="input-base"
                        inputMode="decimal"
                        value={p.custo === '0' ? '' : p.custo}
                        onChange={(e) => alterarPeca(p.key, 'custo', filtrarValor(e.target.value))}
                        placeholder="Custo"
                      />
                    </div>
                  )}
                  <div className="col-span-2 text-right">
                    <button
                      type="button"
                      disabled={travada}
                      onClick={() => removerPeca(p.key)}
                      className="rounded p-2 text-red-400 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                      title={travada ? 'Peça do estoque só pode ser removida por dono ou vendedor' : 'Remover peça'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {!podeVincularEstoque && (
            <p className="mt-2 text-xs text-slate-500">Técnicos não acessam o estoque: informe as peças manualmente.</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label-base">Valor do conserto (R$)</label>
            <input
              className="input-base"
              inputMode="decimal"
              value={form.valorTexto}
              onChange={(e) => alterar('valorTexto', filtrarValor(e.target.value))}
              placeholder="Deixe em branco para orçamento"
            />
          </div>
          <div>
            <label className="label-base">Situação</label>
            <select className="input-base" value={form.status} onChange={(e) => alterar('status', e.target.value)}>
              {STATUS_OS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label-base">Observações</label>
          <textarea className="input-base" rows={2} value={form.observacoes} onChange={(e) => alterar('observacoes', e.target.value)} placeholder="Acessórios deixados, riscos, trincas..." />
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-300">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={form.termoLGPD} onChange={(e) => alterar('termoLGPD', e.target.checked)} />
          <span>
            O cliente leu e aceita o Termo de Responsabilidade e o uso dos dados conforme a LGPD (Lei nº 13.709/2018).
          </span>
        </label>

        {erro && <div className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">{erro}</div>}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
          <div className="flex gap-2">
            {edicao && (
              <>
                <button type="button" className="btn-secondary" onClick={() => imprimirViaCliente(os, loja.nome)}>
                  <Printer className="h-4 w-4" />
                  Via do Cliente
                </button>
                <button type="button" className="btn-secondary" onClick={() => imprimirEtiqueta(os, loja.nome)}>
                  <Tag className="h-4 w-4" />
                  Etiqueta
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {salvando ? 'Salvando...' : 'Salvar OS'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
