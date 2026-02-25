// ======= CUSTOS =======
export interface Tubo {
  id: string;
  diametro: number;
  parede: number;
  valorKg: number;
  valorMetro: number;
}

export interface Eixo {
  id: string;
  diametro: string;
  valorKg: number;
  valorMetro: number;
}

export interface Conjunto {
  id: string;
  codigo: string;
  valor: number;
}

export interface Revestimento {
  id: string;
  tipo: string;
  valorMetroOuPeca: number;
}

export interface Encaixe {
  id: string;
  tipo: string;
  preco: number;
}

// ======= CLIENTES =======
export interface Cliente {
  id: string;
  nome: string;
  cnpj: string;
  email: string;
  telefone: string;
  endereco: string;
  cidade: string;
  estado: string;
  contato: string;
  createdAt: string;
}

// ======= PRODUTOS =======
export type TipoRolete = 'RC' | 'RR' | 'RG' | 'RI' | 'RRA';

export interface Produto {
  id: string;
  nome: string;
  tipo: TipoRolete | 'GENERICO';
  descricao: string;
  createdAt: string;
}

// ======= ORÇAMENTOS =======
export type StatusOrcamento = 'RASCUNHO' | 'ENVIADO' | 'APROVADO' | 'REPROVADO';

export interface ItemOrcamento {
  id: string;
  tipoRolete: TipoRolete;
  quantidade: number;
  diametroTubo: number;
  paredeTubo: number;
  comprimentoTubo: number;
  comprimentoEixo: number;
  diametroEixo: number;
  tipoEncaixe: string;
  medidaFresado: string;
  conjunto: string;
  tipoRevestimento: string;
  especificacaoRevestimento: string;
  quantidadeAneis: number;
  custo: number;
  multiplicador: number;
  desconto: number;
  valorPorPeca: number;
  valorTotal: number;
}

export interface Orcamento {
  id: string;
  numero: string;
  clienteId: string;
  clienteNome: string;
  dataEntrega: string;
  itens: ItemOrcamento[];
  status: StatusOrcamento;
  valorTotal: number;
  createdAt: string;
}

// ======= PEDIDOS =======
export type StatusPedido = 'PENDENTE' | 'EM_PRODUCAO' | 'CONCLUIDO' | 'ENTREGUE';

export interface Pedido {
  id: string;
  numero: string;
  orcamentoId: string;
  clienteNome: string;
  dataEntrega: string;
  status: StatusPedido;
  valorTotal: number;
  createdAt: string;
}

// ======= PRODUÇÃO =======
export type StatusOS = 'ABERTA' | 'EM_ANDAMENTO' | 'CONCLUIDA';

export interface ItemOS {
  item: number;
  quantidade: number;
  tipo: TipoRolete;
  diametroTubo: number;
  paredeTubo: number;
  comprimentoTubo: number;
  comprimentoEixo: number;
  diametroEixo: number;
  encaixeFresado: string;
  comprimentoFresado: number;
  medidaAbaFresado: string;
  tipoEncaixe: string;
  roscaIE: string;
  furoEixo: string;
  revestimento: string;
  corte: boolean;
  torno: boolean;
  fresa: boolean;
  solda: boolean;
  pintura: boolean;
  montagem: boolean;
}

export interface OrdemServico {
  id: string;
  numero: string;
  pedidoId: string;
  empresa: string;
  pedidoNumero: string;
  emissao: string;
  entrega: string;
  entradaProducao: string;
  diasPropostos: number;
  status: StatusOS;
  itens: ItemOS[];
  createdAt: string;
}

// ======= ESTOQUE =======
export interface ItemEstoque {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  unidade: string;
  nivelCritico: number;
  createdAt: string;
}

// ======= USUÁRIOS =======
export type NivelAcesso = 'master' | 'admin' | 'vendedor' | 'producao' | 'estoque';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  nivel: NivelAcesso;
  ativo: boolean;
  createdAt: string;
}
