// Converte um snapshot do Firestore em lista de objetos { id, ...dados }.
// 'estimate' evita datas nulas enquanto o serverTimestamp ainda não voltou do servidor.
export function docsParaLista(snapshot) {
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
}
