import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ICMS_INTERESTADUAL_SP: Record<string, number> = {
  'SP': 18.0,
  'MG': 12.0, 'RJ': 12.0, 'PR': 12.0, 'SC': 12.0, 'RS': 12.0,
  'ES': 7.0, 'BA': 7.0, 'SE': 7.0, 'AL': 7.0, 'PE': 7.0, 'PB': 7.0, 'RN': 7.0, 'CE': 7.0,
  'PI': 7.0, 'MA': 7.0, 'PA': 7.0, 'AP': 7.0, 'AM': 7.0, 'RR': 7.0, 'AC': 7.0,
  'RO': 7.0, 'TO': 7.0, 'MT': 7.0, 'MS': 7.0, 'GO': 7.0, 'DF': 7.0,
};

export const PIS_FIXO = 0.65;
export const COFINS_FIXO = 3.00;

export async function fetchCNPJ(cnpj: string) {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  if (cleanCnpj.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Erro ao buscar CNPJ:', error);
    return null;
  }
}

