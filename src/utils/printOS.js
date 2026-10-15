import { formatarDataHora } from './datas.js';
import { formatarMoeda, parseValor } from './masks.js';

function esc(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function abrirJanelaImpressao(titulo, corpo, css) {
  const janela = window.open('', '_blank', 'width=900,height=700');

  if (!janela) {
    alert('O navegador bloqueou a janela de impressão. Libere os pop-ups deste site e tente de novo.');
    return;
  }

  janela.document.open();
  janela.document.write(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${css}</style></head><body>${corpo}</body></html>`
  );
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 300);
}

const CSS_VIA = `
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 13px; line-height: 1.45; }
  h1 { font-size: 20px; margin: 0; }
  h2 { font-size: 14px; margin: 16px 0 6px; border-bottom: 1px solid #000; padding-bottom: 3px; }
  .topo { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 8px; }
  .numero { font-size: 28px; font-weight: bold; text-align: right; }
  .grade { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; }
  .campo b { display: inline-block; min-width: 90px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; font-size: 12px; }
  .termo { font-size: 11px; text-align: justify; margin-top: 6px; }
  .assinaturas { display: flex; justify-content: space-between; gap: 30px; margin-top: 50px; }
  .assinatura { flex: 1; border-top: 1px solid #000; text-align: center; padding-top: 4px; font-size: 12px; }
`;

export function imprimirViaCliente(os, nomeLoja) {
  const valor = parseValor(os.valor);
  const pecas = Array.isArray(os.pecas) ? os.pecas : [];

  const linhasPecas = pecas.length
    ? pecas
        .map((p) => `<tr><td>${esc(p.nome)}</td><td style="width:70px">${esc(p.quantidade)}</td></tr>`)
        .join('')
    : '<tr><td colspan="2">Nenhuma peça informada</td></tr>';

  const corpo = `
    <div class="topo">
      <div>
        <h1>${esc(nomeLoja)}</h1>
        <div>Ordem de Serviço - Via do Cliente</div>
        <div>Entrada: ${esc(formatarDataHora(os.criadoEm))}</div>
      </div>
      <div class="numero">OS Nº ${esc(os.numeroOS)}</div>
    </div>

    <h2>Cliente</h2>
    <div class="grade">
      <div class="campo"><b>Nome:</b> ${esc(os.clienteNome)}</div>
      <div class="campo"><b>Telefone:</b> ${esc(os.clienteTelefone)}</div>
    </div>

    <h2>Aparelho</h2>
    <div class="grade">
      <div class="campo"><b>Aparelho:</b> ${esc(os.aparelho)}</div>
      <div class="campo"><b>IMEI:</b> ${esc(os.imei || 'Não informado')}</div>
      <div class="campo"><b>Senha:</b> ${os.tipoSenha && os.tipoSenha !== 'nenhuma' ? 'Informada pelo cliente' : 'Sem senha'}</div>
      <div class="campo"><b>Situação:</b> ${esc(os.status)}</div>
    </div>

    <h2>Defeito relatado</h2>
    <div>${esc(os.defeito)}</div>

    ${os.observacoes ? `<h2>Observações</h2><div>${esc(os.observacoes)}</div>` : ''}

    <h2>Peças utilizadas</h2>
    <table>
      <thead><tr><th>Peça</th><th>Qtd</th></tr></thead>
      <tbody>${linhasPecas}</tbody>
    </table>

    <h2>Valor do serviço</h2>
    <div style="font-size:18px;font-weight:bold">${valor > 0 ? esc(formatarMoeda(valor)) : 'A definir (orçamento)'}</div>

    <h2>Termo de responsabilidade e LGPD</h2>
    <div class="termo">
      Declaro que as informações acima estão corretas e autorizo a assistência técnica a realizar a análise e o reparo do aparelho.
      Estou ciente de que meus dados pessoais serão usados exclusivamente para a execução deste serviço, conforme a Lei Geral de
      Proteção de Dados (Lei nº 13.709/2018). A assistência não se responsabiliza por dados, arquivos ou aplicativos armazenados no
      aparelho, sendo de minha responsabilidade a realização de backup. Aparelhos não retirados em até 90 dias após o aviso de
      conclusão poderão ser descartados ou vendidos para cobrir custos do serviço.
    </div>

    <div class="assinaturas">
      <div class="assinatura">Assinatura do cliente</div>
      <div class="assinatura">Assinatura da assistência</div>
    </div>
  `;

  abrirJanelaImpressao(`OS ${os.numeroOS}`, corpo, CSS_VIA);
}

const CSS_ETIQUETA = `
  @page { size: 80mm 60mm; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; text-align: center; margin: 0; }
  .loja { font-size: 11px; }
  .numero { font-size: 72px; font-weight: bold; line-height: 1.05; }
  .linha { font-size: 13px; }
`;

export function imprimirEtiqueta(os, nomeLoja) {
  const corpo = `
    <div class="loja">${esc(nomeLoja)}</div>
    <div class="numero">${esc(os.numeroOS)}</div>
    <div class="linha"><b>${esc(os.clienteNome)}</b></div>
    <div class="linha">${esc(os.aparelho)}</div>
  `;

  abrirJanelaImpressao(`Etiqueta OS ${os.numeroOS}`, corpo, CSS_ETIQUETA);
}
