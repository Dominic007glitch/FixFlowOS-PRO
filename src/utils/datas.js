export function paraDate(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor.toDate();
  if (valor instanceof Date) return valor;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

export function formatarData(valor) {
  const data = paraDate(valor);
  return data ? data.toLocaleDateString('pt-BR') : '-';
}

export function formatarDataHora(valor) {
  const data = paraDate(valor);
  return data ? data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
}

// Data de hoje no formato yyyy-mm-dd (fuso local)
export function hojeISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// yyyy-mm-dd -> Date (meia-noite local)
export function isoParaDate(iso) {
  const partes = String(iso || '').split('-').map(Number);
  return new Date(partes[0] || 1970, (partes[1] || 1) - 1, partes[2] || 1);
}
