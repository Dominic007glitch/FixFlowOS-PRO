import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config.js';

export const STATUS_OS = [
  'Aguardando orçamento',
  'Em análise',
  'Aguardando peça',
  'Em reparo',
  'Pronto',
  'Entregue',
  'Cancelada',
];

export const TIPOS_SENHA = [
  { id: 'nenhuma', nome: 'Sem senha' },
  { id: 'padrao', nome: 'Padrão (1 a 9)' },
  { id: 'pin', nome: 'PIN numérico' },
  { id: 'texto', nome: 'Senha (texto)' },
];

// Soma a quantidade de cada produto do estoque vinculado às peças: { produtoId: quantidade }
function consolidarPecas(pecas) {
  const mapa = {};
  (pecas || []).forEach((p) => {
    if (p && p.produtoId) {
      const qtd = Number(p.quantidade) || 0;
      mapa[p.produtoId] = (mapa[p.produtoId] || 0) + qtd;
    }
  });
  return mapa;
}

// Cria a OS com número ESTRITAMENTE sequencial (1, 2, 3...) usando runTransaction.
// Também dá baixa no estoque das peças vinculadas, tudo na mesma transação.
export async function criarOS(lojaId, dados, usuario) {
  const configRef = doc(db, 'lojas', lojaId, 'configuracoes', 'geral');
  const osRef = doc(collection(db, 'lojas', lojaId, 'ordens'));

  return runTransaction(db, async (tx) => {
    // 1) TODAS as leituras primeiro (regra do Firestore)
    const configSnap = await tx.get(configRef);
    const consumo = consolidarPecas(dados.pecas);
    const ids = Object.keys(consumo);
    const prodRefs = ids.map((id) => doc(db, 'lojas', lojaId, 'estoque', id));
    const prodSnaps = await Promise.all(prodRefs.map((r) => tx.get(r)));

    // 2) Contador com conversão explícita para número
    const contadorAtual = configSnap.exists() ? Number(configSnap.data().contadorOS) : 0;
    const base = Number.isFinite(contadorAtual) ? contadorAtual : 0;
    const numeroOS = Number(base) + 1;

    // 3) Validação de estoque
    const novasQuantidades = prodSnaps.map((snap, i) => {
      if (!snap.exists()) {
        throw new Error('Uma peça vinculada não existe mais no estoque.');
      }
      const atual = Number(snap.data().quantidade) || 0;
      if (atual < consumo[ids[i]]) {
        throw new Error(`Estoque insuficiente para "${snap.data().nome}". Disponível: ${atual}.`);
      }
      return atual - consumo[ids[i]];
    });

    // 4) Escritas
    tx.set(configRef, { contadorOS: numeroOS }, { merge: true });
    prodRefs.forEach((ref, i) => tx.update(ref, { quantidade: novasQuantidades[i] }));
    tx.set(osRef, {
      ...dados,
      numeroOS,
      criadoPorUid: usuario.uid,
      criadoPorNome: usuario.nome,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
      entregueEm: dados.status === 'Entregue' ? serverTimestamp() : null,
    });

    return numeroOS;
  });
}

// Atualiza a OS e ajusta o estoque pela diferença entre as peças antigas e as novas.
export async function atualizarOS(lojaId, osId, dados) {
  const osRef = doc(db, 'lojas', lojaId, 'ordens', osId);

  await runTransaction(db, async (tx) => {
    const osSnap = await tx.get(osRef);
    if (!osSnap.exists()) {
      throw new Error('OS não encontrada.');
    }

    const antiga = osSnap.data();
    const antes = consolidarPecas(antiga.pecas);
    const depois = consolidarPecas(dados.pecas);

    const ids = Array.from(new Set([...Object.keys(antes), ...Object.keys(depois)])).filter(
      (id) => (depois[id] || 0) !== (antes[id] || 0)
    );
    const prodRefs = ids.map((id) => doc(db, 'lojas', lojaId, 'estoque', id));
    const prodSnaps = await Promise.all(prodRefs.map((r) => tx.get(r)));

    const novasQuantidades = prodSnaps.map((snap, i) => {
      const id = ids[i];
      const delta = (depois[id] || 0) - (antes[id] || 0);

      if (!snap.exists()) {
        if (delta > 0) throw new Error('Uma peça vinculada não existe mais no estoque.');
        return null;
      }

      const atual = Number(snap.data().quantidade) || 0;
      const nova = atual - delta;
      if (nova < 0) {
        throw new Error(`Estoque insuficiente para "${snap.data().nome}". Disponível: ${atual}.`);
      }
      return nova;
    });

    prodRefs.forEach((ref, i) => {
      if (novasQuantidades[i] !== null) {
        tx.update(ref, { quantidade: novasQuantidades[i] });
      }
    });

    const payload = { ...dados, atualizadoEm: serverTimestamp() };

    if (dados.status === 'Entregue') {
      if (antiga.status !== 'Entregue' || !antiga.entregueEm) {
        payload.entregueEm = serverTimestamp();
      }
    } else {
      payload.entregueEm = null;
    }

    tx.update(osRef, payload);
  });
}
