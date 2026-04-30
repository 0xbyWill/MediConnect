export function digitsOnly(value = '') {
  return value.replace(/\D/g, '');
}

export function isValidCpf(value: string) {
  const cpf = digitsOnly(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  const calcDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  return calcDigit(9) === Number(cpf[9]) && calcDigit(10) === Number(cpf[10]);
}
