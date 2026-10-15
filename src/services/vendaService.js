import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { arredondar, parseValor } from '../utils/masks.js';

export const FORMAS_PAGAMENTO = ['Dinheiro', 'Pix', 'Cartão de débito', 'Cartão de crédito'];

// Finaliza a venda numa transação: valida estoque, dá baixa, grava a venda e lança no caixa.
// Preço e custo dos produtos do estoque são sempre lidos do banco (nunca confiamos no que veio da tela).
export async function finalizarVenda(lojaId, { itens, desconto, formaPagamento, sessaoId }, usuario) {
  const vendaRef = doc(collection(db, 'lojas', lojaId, 'vendas'));
  const movRef = doc(collection(db, 'lojas', lojaId, 'caixaMovimentos'));

  return runTransaction(db, async (tx) => {
    const consumo = {};
    itens.forEach((item) => {
      if (item.produtoId) {
        consumo[item.produtoId] = (consumo[item.produtoId] || 0) + Number(item.quantidade);
      }
    });

    const ids = Object.keys(consumo);
    const refs = ids.map((id) => doc(db, 'lojas', lojaId, 'estoque', id));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));

    const dadosProdutos = {};
    snaps.forEach((snap, i) => {
      if (!snap.exists()) {
        throw new Error('Um produto do carrinho não existe mais no estoque.');
      }
      const dados = snap.data();
      const atual = Number(dados.quantidade) || 0;
      if (atual < consumo[ids[i]]) {
        throw new Error(`Estoque insuficiente para "${dados.nome}". Disponível: ${atual}.`);
      }
      dadosProdutos[ids[i]] = { ...dados, atual };
    });

    const itensFinais = itens.map((item) => {
      if (item.produtoId) {
        const produto = dadosProdutos[item.produtoId];
        return {
          produtoId: item.produtoId,
          nome: produto.nome,
          quantidade: Number(item.quantidade),
          preco: parseValor(produto.precoVenda),
          custo: parseValor(produto.custo),
        };
      }
      return {
        produtoId: '',
        nome: item.nome,
        quantidade: Number(item.quantidade),
        preco: parseValor(item.preco),
        custo: 0,
      };
    });

    const subtotal = arredondar(itensFinais.reduce((soma, i) => soma + i.preco * i.quantidade, 0));
    const descontoFinal = Math.min(Math.max(parseValor(desconto), 0), subtotal);
    const total = arredondar(subtotal - descontoFinal);

    ids.forEach((id, i) => {
      tx.update(refs[i], { quantidade: dadosProdutos[id].atual - consumo[id] });
    });

    tx.set(vendaRef, {
      itens: itensFinais,
      subtotal,
      desconto: descontoFinal,
      total,
      formaPagamento,
      sessaoId,
      usuarioUid: usuario.uid,
      usuarioNome: usuario.nome,
      criadoEm: serverTimestamp(),
    });

    tx.set(movRef, {
      sessaoId,
      tipo: 'venda',
      forma: formaPagamento,
      valor: total,
      descricao: `Venda (${itensFinais.length} item(ns))`,
      vendaId: vendaRef.id,
      usuarioUid: usuario.uid,
      usuarioNome: usuario.nome,
      criadoEm: serverTimestamp(),
    });

    return total;
  });
}
