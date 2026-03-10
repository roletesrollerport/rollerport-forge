export const formatCPF = (value: string) => {
  const numericValue = value.replace(/\D/g, '');
  return numericValue
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14);
};

export const formatCNPJ = (value: string) => {
  const numericValue = value.replace(/\D/g, '');
  return numericValue
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
    .slice(0, 18);
};

export const formatCPForCNPJ = (value: string) => {
  const numericValue = value.replace(/\D/g, '');
  if (numericValue.length <= 11) {
    return formatCPF(numericValue);
  }
  return formatCNPJ(numericValue);
};

export const formatTelefone = (value: string) => {
  let numericValue = value.replace(/\D/g, '');
  
  if (numericValue.length > 11) {
    numericValue = numericValue.slice(0, 11);
  }

  if (numericValue.length <= 10) {
    return numericValue
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  return numericValue
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

export const formatInscricaoEstadual = (value: string) => {
  // IE formats vary drastically by state. Removing non-alphanumeric is the safest bet,
  // or just removing non-numeric if it's strictly numeric for the target states.
  // We'll leave it as numeric with a generic masking if possible, or just digits.
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 15);
};

export const formatInscricaoMunicipal = (value: string) => {
  // Similar to IE
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 15);
};

// Validations
export const isValidCPF = (cpf: string) => {
  const strCPF = cpf.replace(/\D/g, '');
  if (strCPF.length !== 11) return false;
  
  if (/^(\d)\1+$/.test(strCPF)) return false;

  let soma = 0;
  let resto;

  for (let i = 1; i <= 9; i++) {
    soma = soma + parseInt(strCPF.substring(i - 1, i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(strCPF.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma = soma + parseInt(strCPF.substring(i - 1, i)) * (12 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(strCPF.substring(10, 11))) return false;

  return true;
};

export const isValidCNPJ = (cnpj: string) => {
  const strCNPJ = cnpj.replace(/\D/g, '');
  if (strCNPJ.length !== 14) return false;

  if (/^(\d)\1+$/.test(strCNPJ)) return false;

  let tamanho = strCNPJ.length - 2;
  let numeros = strCNPJ.substring(0, tamanho);
  const digitos = strCNPJ.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = strCNPJ.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;

  return true;
};

export const isValidCPForCNPJ = (value: string) => {
  const numericValue = value.replace(/\D/g, '');
  if (numericValue.length <= 11) {
    return isValidCPF(numericValue);
  }
  return isValidCNPJ(numericValue);
};

export const formatDateBR = (dateStr?: string) => {
  if (!dateStr) return '-';
  // Check if it's already YYYY-MM-DD
  if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};
