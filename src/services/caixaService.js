import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { arredondar, parseValor } from '../utils/masks.js';

export async function abrirCaixa(lojaId, valorAbertura, usuario) {
  return addDoc(collection(db, 'lojas', lojaId, 'caixaSessoes'), {
    status: 'aberto',
    valorAbertura: arredondar(parseValor(valorAbertura)),
    abertoPorUid: usuario.uid,
    abertoPorNome: usuario.nome,
    abertoEm: serverTimestamp(),
    fechadoEm: null,
  });
}

// tipo: 'suprimento' (entrada de dinheiro) ou 'sangria' (retirada de dinheiro)
export async function lancarMovimento(lojaId, sessaoId, tipo, valor, descricao, usuario) {
  return addDoc(collection(db, 'lojas', lojaId, 'caixaMovimentos'), {
    sessaoId,
    tipo,
    forma: 'Dinheiro',
    valor: arredondar(parseValor(valor)),
    descricao: descricao || '',
    usuarioUid: usuario.uid,
    usuarioNome: usuario.nome,
    criadoEm: serverTimestamp(),
  });
}

export async function fecharCaixa(lojaId, sessaoId, resumo, valorContado, usuario) {
  const contado = arredondar(parseValor(valorContado));
  return updateDoc(doc(db, 'lojas', lojaId, 'caixaSessoes', sessaoId), {
    status: 'fechado',
    fechadoEm: serverTimestamp(),
    fechadoPorUid: usuario.uid,
    fechadoPorNome: usuario.nome,
    esperadoDinheiro: arredondar(resumo.esperadoDinheiro),
    totalVendas: arredondar(resumo.vendasTotal),
    valorContado: contado,
    diferenca: arredondar(contado - resumo.esperadoDinheiro),
  });
}

// Resume os movimentos de uma sessão de caixa
export function calcularResumo(sessao, movimentos) {
  const resumo = {
    abertura: parseValor(sessao ? sessao.valorAbertura : 0),
    suprimentos: 0,
    sangrias: 0,
    vendasDinheiro: 0,
    vendasOutras: 0,
    vendasTotal: 0,
    esperadoDinheiro: 0,
  };

  movimentos.forEach((m) => {
    const valor = parseValor(m.valor);
    if (m.tipo === 'suprimento') {
      resumo.suprimentos += valor;
    } else if (m.tipo === 'sangria') {
      resumo.sangrias += valor;
    } else if (m.tipo === 'venda') {
      resumo.vendasTotal += valor;
      if (m.forma === 'Dinheiro') {
        resumo.vendasDinheiro += valor;
      } else {
        resumo.vendasOutras += valor;
      }
    }
  });

  resumo.esperadoDinheiro = resumo.abertura + resumo.suprimentos - resumo.sangrias + resumo.vendasDinheiro;
  return resumo;
}
