// ======= CUSTOS =======
// ======= PROSPECÇÃO (CRM) =======
export interface RegistroProspeccao {
  id: string; // único da prospecção
  clienteId: string;
  vendedorId: string; // Para controle de acesso/visão
  
  // Checks de histórico
  checkOrcamentos: boolean;
  checkPedidos: boolean;
  checkOS: boolean;
  
  // Checks de contato
  checkTelefone: boolean;
  checkWhatsapp: boolean;
  checkEmail: boolean;
  
  // Exclusividade / Trava
  emAtendimentoPor?: string; // ID do Usuário
  emAtendimentoDesde?: string; // ISO String
  
  numeroInteracoes: number;
  dataUltimaInteracao: string; // ISO String (para calcular os 30 dias de ociosidade)
  createdAt: string;
}

// ======= FIM =======
export interface Tubo {
  id: string;
  diametro: number;
  parede: number;
  precoBarra6000mm: number;
  imagem?: string;
}

export interface Eixo {
  id: string;
  diametro: string;
  precoBarra6000mm: number;
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

export type RegimeTributario = 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real' | 'Isento';

export interface EmpresaEmissora {
  id: string;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  ie: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  telefone: string;
  email: string;
  regimeTributario: RegimeTributario;
  bairro: string;
  logo?: string;
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
  regimeTributario: RegimeTributario;
  aniversarioEmpresa?: string;
  redesSociais?: string;
  createdAt: string;
}

// ======= FORNECEDORES (mesma estrutura, "compradores" = vendedores do fornecedor) =======
export type Fornecedor = Cliente;

// ======= PRODUTOS =======
export type TipoRolete = 'RC' | 'RR' | 'RG' | 'RI' | 'RRA';

export interface Produto {
  id: string;
  codigo: string;
  codigoCliente?: string;
  nome: string;
  nomeCompleto?: string;
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
  aliqPIS?: number;
  aliqCOFINS?: number;
  aliqICMS?: number;
  aliqIPI?: number;
  valorPIS?: number;
  valorCOFINS?: number;
  valorICMS?: number;
  valorIPI?: number;
}

export interface ItemProdutoOrcamento {
  id: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  ncm?: string;
  medidas?: string;
  descricao?: string;
  aliqPIS?: number;
  aliqCOFINS?: number;
  aliqICMS?: number;
  aliqIPI?: number;
  valorPIS?: number;
  valorCOFINS?: number;
  valorICMS?: number;
  valorIPI?: number;
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
  prazoPagamento?: string;
  dataEntrega: string;
  itensRolete: ItemOrcamento[];
  itensProduto: ItemProdutoOrcamento[];
  status: StatusOrcamento;
  empresaEmissoraId: string;
  valorTotal: number;
  createdAt: string;
  dataAprovacao?: string;
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
  motivoCancelamento?: string;
  dataCancelamento?: string;
  statusHistory?: { status: string; date: string }[];
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
  motivoCancelamento?: string;
  dataCancelamento?: string;
  statusHistory?: { status: string; date: string }[];
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

// ======= NÍVEIS DE ACESSO (SETORES) =======
export type NivelAcesso = 'master' | 'admin' | 'SEO' | 'Administrador' | 'Vendas' | 'Estoque' | 'Produção';
export type Genero = 'M' | 'F';

export type PermissaoModulo = 'inicio' | 'custos' | 'clientes' | 'produtos' | 'orcamentos' | 'pedidos' | 'producao' | 'estoque' | 'chat' | 'ia' | 'usuarios' | 'prospeccao';

export interface PermissoesUsuario {
  ver: PermissaoModulo[];
  editar: PermissaoModulo[];
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  whatsapp?: string;
  login: string;
  senha: string;
  nivel: NivelAcesso;
  genero?: Genero;
  ativo: boolean;
  foto?: string;
  permissoes?: PermissoesUsuario;
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
