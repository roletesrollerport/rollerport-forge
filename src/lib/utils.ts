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

export async function fetchCNPJ(cnpj: string): Promise<any | null> {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  if (cleanCnpj.length !== 14) return null;

  try {
    const res = await fetch(`https://publica.cnpj.ws/cnpj/${cleanCnpj}`);
    if (res.ok) {
      const data = await res.json();
      const est = data.estabelecimento || {};
      
      let ie = '';
      if (est.inscricoes_estaduais && est.inscricoes_estaduais.length > 0) {
        const ativoInfo = est.inscricoes_estaduais.find((i: any) => i.ativo);
        ie = ativoInfo ? ativoInfo.inscricao_estadual : est.inscricoes_estaduais[0].inscricao_estadual;
      }

      return {
        razao_social: data.razao_social,
        logradouro: est.logradouro,
        numero: est.numero,
        complemento: est.complemento,
        bairro: est.bairro,
        municipio: est.cidade?.nome || '',
        uf: est.estado?.sigla || '',
        cep: est.cep,
        ddd_telefone_1: est.ddd1 && est.telefone1 ? `${est.ddd1}${est.telefone1}` : '',
        email: est.email,
        inscricao_estadual: ie,
        data_inicio_atividade: est.data_inicio_atividade,
        opcao_pelo_simples: data.simples ? data.simples.simples === 'Sim' : false,
        descricao_situacao_cadastral: est.situacao_cadastral ? est.situacao_cadastral.toUpperCase() : 'ATIVA'
      };
    }
  } catch (err) {
    console.error('Erro fabrica.cnpj.ws:', err);
  }

  // Fallback BrasilAPI
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
    if (res.ok) return await res.json();
  } catch (error) {
    console.error('Erro BrasilAPI:', error);
  }
  
  return null;
}

