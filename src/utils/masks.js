// Telefone: (XX) XXXXX-XXXX. Bloqueia letras na raiz do input.
export function mascaraTelefone(valor) {
  const numeros = String(valor || '').replace(/\D/g, '').slice(0, 11);

  if (numeros.length === 0) return '';
  if (numeros.length <= 2) return `(${numeros}`;
  if (numeros.length <= 7) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
}

// Senha padrão (1 a 9): aceita estritamente números de 1 a 9, sem zero e sem letras.
export function filtrarSenhaPadrao(valor) {
  const texto = String(valor || '');
  const filtrado = texto.replace(/[^1-9]/g, '').slice(0, 9);
  return /^[1-9]*$/.test(filtrado) ? filtrado : '';
}

// Valor do conserto: bloqueia letras, aceita apenas dígitos, vírgula e ponto.
export function filtrarValor(valor) {
  return String(valor || '').replace(/[^0-9.,]/g, '');
}

// Converte texto digitado ("1.200,50", "1.200" ou "150.5") em número puro.
// Vazio ou inválido vira 0.
export function parseValor(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : 0;
  }

  let texto = String(valor || '').replace(/[^0-9.,]/g, '');
  if (texto === '') return 0;

  if (texto.includes(',')) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(texto)) {
    // "1.200" no padrão brasileiro significa mil e duzentos
    texto = texto.replace(/\./g, '');
  }

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

export function formatarMoeda(valor) {
  const numero = Number(valor);
  const seguro = Number.isFinite(numero) ? numero : 0;
  return seguro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Número -> texto para preencher inputs de valor ("1200.5" vira "1200,5"; 0 vira "")
export function valorParaInput(valor) {
  const numero = parseValor(valor);
  return numero === 0 ? '' : String(numero).replace('.', ',');
}

export function arredondar(valor) {
  return Math.round((Number(valor) || 0) * 100) / 100;
}
