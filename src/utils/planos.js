export const PLANOS = {
  1: { id: 1, nome: 'Plano 1', preco: 499, limiteUsuarios: 7 },
  2: { id: 2, nome: 'Plano 2', preco: 599, limiteUsuarios: 10 },
  3: { id: 3, nome: 'Plano 3', preco: 750, limiteUsuarios: Infinity },
};

export const CARGOS = {
  superadmin: 'Super Admin',
  dono: 'Dono da Loja',
  vendedor: 'Vendedor',
  tecnico: 'Técnico',
};

export function getPlano(planoId) {
  return PLANOS[Number(planoId)] || PLANOS[1];
}

export function textoLimite(planoId) {
  const plano = getPlano(planoId);
  return plano.limiteUsuarios === Infinity ? 'Ilimitado' : String(plano.limiteUsuarios);
}

export function podeAdicionarUsuario(planoId, totalAtual) {
  const plano = getPlano(planoId);
  return Number(totalAtual) < plano.limiteUsuarios;
}
