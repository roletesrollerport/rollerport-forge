// ======= CUSTOS =======
export interface Tubo {
  id: string;
  diametro: number;
  parede: number;
  valorMetro: number;
  imagem?: string;
}

export interface Eixo {
  id: string;
  diametro: string;
  valorMetro: number;
  imagem?: string;
}

export interface Conjunto {
  id: string;
  codigo: string;
  valor: number;
  imagem?: string;
}

export interface Revestimento {
  id: string;
  tipo: string;
  valorMetroOuPeca: number;
  imagem?: string;
}

export interface Encaixe {
  id: string;
  tipo: string;
  preco: number;
  imagem?: string;
}

// ======= CLIENTES =======
export interface Comprador {
  nome: string;
  telefone: string;
  email: string;
  whatsapp: string;
  aniversario?: string;
  redesSociais?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  cnpj: string;
  email: string;
  telefone: string;
  whatsapp: string;
  endereco: string;
  cidade: string;
  estado: string;
  contato: string;
  compradores: Comprador[];
  aniversarioEmpresa?: string;
  redesSociais?: string;
  createdAt: string;
}

// ======= PRODUTOS =======
export type TipoRolete = 'RC' | 'RR' | 'RG' | 'RI' | 'RRA';

export interface Produto {
  id: string;
  codigo: string;
  codigoCliente?: string;
  nome: string;
  tipo: TipoRolete | 'GENERICO';
  medidas: string;
  descricao: string;
  miniDescricao?: string;
  valor: number;
  createdAt: string;
}

// ======= ORÇAMENTOS =======
export type StatusOrcamento = 'RASCUNHO' | 'ENVIADO' | 'AGUARDANDO' | 'APROVADO' | 'REPROVADO';

export type TipoFrete = 'CIF' | 'FOB';

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
  ncm?: string;
  codigoExterno?: string;
  codigoProduto?: string;
}

export interface ItemProdutoOrcamento {
  id: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface Orcamento {
  id: string;
  numero: string;
  clienteId: string;
  clienteNome: string;
  compradorNome?: string;
  tipoFrete: TipoFrete;
  condicaoPagamento: string;
  vendedor: string;
  dataOrcamento: string;
  previsaoEntrega: string;
  observacao: string;
  dataEntrega: string;
  itensRolete: ItemOrcamento[];
  itensProduto: ItemProdutoOrcamento[];
  status: StatusOrcamento;
  valorTotal: number;
  createdAt: string;
}

// ======= PEDIDOS =======
export type StatusPedido = 'PENDENTE' | 'CONFIRMADO' | 'EM_PRODUCAO' | 'CONCLUIDO' | 'ENTREGUE';

export interface Pedido {
  id: string;
  numero: string;
  orcamentoId: string;
  orcamentoNumero?: string;
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
  metragem?: number;
  nivelCritico: number;
  imagem?: string;
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
  foto?: string;
  createdAt: string;
}

// ======= NOTIFICAÇÕES =======
export interface Notificacao {
  id: string;
  tipo: 'aniversario' | 'pedido' | 'producao' | 'chat';
  titulo: string;
  mensagem: string;
  lida: boolean;
  createdAt: string;
}

// ======= VENDEDOR META =======
export interface MetaVendedor {
  vendedor: string;
  metaMensal: number;
}
