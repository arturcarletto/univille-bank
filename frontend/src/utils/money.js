// Strings e BigInt preservam centavos inclusive acima de Number.MAX_SAFE_INTEGER.
const MAX_CENTS = 9223372036854775807n
export function normalizeAmount(input) {
  const value = input.trim().replace(',', '.')
  if (!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) throw new Error('Informe um valor sem separador de milhar, com até duas casas decimais.')
  const [whole, fraction = ''] = value.split('.')
  const cents = BigInt(whole + fraction.padEnd(2, '0'))
  if (cents <= 0n || cents > MAX_CENTS) throw new Error('Informe um valor positivo dentro do limite suportado.')
  return whole + '.' + fraction.padEnd(2, '0')
}
export function decimalCents(value) {
  return BigInt(value.replace('.', ''))
}
export function formatMoney(amount, currency) {
  if (amount === null || amount === undefined) return '—'
  if (!/^\d+\.\d{2}$/.test(amount)) return 'Valor indisponível'
  const [whole, fraction] = amount.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (currency === 'BRL' ? 'R$' : currency || '') + '\u00a0' + grouped + ',' + fraction
}
