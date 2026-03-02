import type {
  Tubo, Eixo, Conjunto, Revestimento, Encaixe,
  Cliente, Orcamento, Pedido, OrdemServico, ItemEstoque, Usuario, Produto,
  Notificacao, MetaVendedor
} from './types';

function load<T>(key: string, fallback: T): T {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : fallback;
  } catch { return fallback; }
}

function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ===== Complete seed data from spreadsheet =====
const SEED_TUBOS: Tubo[] = [
  { id: '1', diametro: 50, parede: 3, valorMetro: 27.02 },
  { id: '2', diametro: 50, parede: 3.75, valorMetro: 13.47 },
  { id: '3', diametro: 60, parede: 3, valorMetro: 13.28 },
  { id: '4', diametro: 60, parede: 5, valorMetro: 21.36 },
  { id: '5', diametro: 63, parede: 3, valorMetro: 13.98 },
  { id: '6', diametro: 63, parede: 3.75, valorMetro: 17.26 },
  { id: '7', diametro: 70, parede: 3, valorMetro: 15.61 },
  { id: '8', diametro: 70, parede: 5, valorMetro: 25.25 },
  { id: '9', diametro: 76, parede: 3, valorMetro: 37.99 },
  { id: '10', diametro: 76, parede: 3.75, valorMetro: 21.05 },
  { id: '11', diametro: 102, parede: 2.25, valorMetro: 33.12 },
  { id: '12', diametro: 102, parede: 2.65, valorMetro: 38.86 },
  { id: '13', diametro: 102, parede: 3.75, valorMetro: 57.24 },
  { id: '14', diametro: 102, parede: 4.25, valorMetro: 32.27 },
  { id: '15', diametro: 115, parede: 3, valorMetro: 26.10 },
  { id: '16', diametro: 115, parede: 3.75, valorMetro: 32.41 },
  { id: '17', diametro: 115, parede: 4.25, valorMetro: 36.56 },
  { id: '18', diametro: 127, parede: 3, valorMetro: 64.54 },
  { id: '19', diametro: 127, parede: 3.75, valorMetro: 35.90 },
  { id: '20', diametro: 127, parede: 4.25, valorMetro: 40.52 },
  { id: '21', diametro: 140, parede: 3.35, valorMetro: 36.75 },
  { id: '22', diametro: 140, parede: 3.75, valorMetro: 41.01 },
  { id: '23', diametro: 140, parede: 4.25, valorMetro: 46.31 },
  { id: '24', diametro: 152, parede: 3, valorMetro: 35.88 },
  { id: '25', diametro: 152, parede: 3.75, valorMetro: 44.62 },
  { id: '26', diametro: 152, parede: 4.25, valorMetro: 50.40 },
  { id: '27', diametro: 152, parede: 4.75, valorMetro: 56.14 },
  { id: '28', diametro: 165, parede: 3.75, valorMetro: 48.54 },
  { id: '29', diametro: 165, parede: 4.25, valorMetro: 54.84 },
];

const SEED_EIXOS: Eixo[] = [
  { id: '1', diametro: '15', valorMetro: 14.06 },
  { id: '2', diametro: '17', valorMetro: 18.06 },
  { id: '3', diametro: '20', valorMetro: 24.99 },
  { id: '4', diametro: '25', valorMetro: 39.05 },
  { id: '5', diametro: '30', valorMetro: 56.23 },
  { id: '6', diametro: '35', valorMetro: 76.54 },
  { id: '7', diametro: '40', valorMetro: 99.97 },
  { id: '8', diametro: '45', valorMetro: 41.91 },
  { id: '9', diametro: '50', valorMetro: 51.74 },
  { id: '10', diametro: '55', valorMetro: 62.61 },
  { id: '11', diametro: '60', valorMetro: 74.51 },
  { id: '12', diametro: '65', valorMetro: 87.45 },
  { id: '13', diametro: '70', valorMetro: 101.42 },
  { id: '14', diametro: '75', valorMetro: 116.42 },
  { id: '15', diametro: '80', valorMetro: 132.46 },
  { id: '16', diametro: '15-INOX', valorMetro: 16.00 },
  { id: '17', diametro: '20-INOX', valorMetro: 17.00 },
  { id: '18', diametro: '25-INOX', valorMetro: 18.00 },
];

const SEED_CONJUNTOS: Conjunto[] = [
  { id: '1', codigo: '50X15-1', valor: 8.00 },
  { id: '2', codigo: '50X15-2', valor: 8.00 },
  { id: '3', codigo: '50X15-1-NYLON', valor: 8.00 },
  { id: '4', codigo: '50X15-2-NYLON', valor: 8.00 },
  { id: '5', codigo: '50X20-1', valor: 8.00 },
  { id: '6', codigo: '50X20-2', valor: 8.00 },
  { id: '7', codigo: '60X15-1', valor: 8.00 },
  { id: '8', codigo: '60X15-2', valor: 8.00 },
  { id: '9', codigo: '60X15-1-NYLON', valor: 8.00 },
  { id: '10', codigo: '60X15-2-NYLON', valor: 8.00 },
  { id: '11', codigo: '60X17-1', valor: 8.00 },
  { id: '12', codigo: '60X17-2', valor: 8.00 },
  { id: '13', codigo: '60X17-1-NYLON', valor: 8.00 },
  { id: '14', codigo: '60X17-2-NYLON', valor: 8.00 },
  { id: '15', codigo: '60X20-1', valor: 8.00 },
  { id: '16', codigo: '60X20-2', valor: 8.00 },
  { id: '17', codigo: '60X25-1', valor: 8.00 },
  { id: '18', codigo: '60X25-2', valor: 8.00 },
  { id: '19', codigo: '63X15-1', valor: 8.00 },
  { id: '20', codigo: '63X15-2', valor: 8.00 },
  { id: '21', codigo: '63X15-1-NYLON', valor: 8.00 },
  { id: '22', codigo: '63X15-2-NYLON', valor: 8.00 },
  { id: '23', codigo: '63X17-1', valor: 8.00 },
  { id: '24', codigo: '63X17-2', valor: 8.00 },
  { id: '25', codigo: '63X17-1-NYLON', valor: 8.00 },
  { id: '26', codigo: '63X17-2-NYLON', valor: 8.00 },
  { id: '27', codigo: '63X20-1', valor: 8.00 },
  { id: '28', codigo: '63X20-2', valor: 8.00 },
  { id: '29', codigo: '63X20-1-NYLON', valor: 8.00 },
  { id: '30', codigo: '63X20-2-NYLON', valor: 8.00 },
  { id: '31', codigo: '63X25-1', valor: 8.00 },
  { id: '32', codigo: '63X25-2', valor: 8.00 },
  { id: '33', codigo: '70X15-1', valor: 8.00 },
  { id: '34', codigo: '70X15-2', valor: 8.00 },
  { id: '35', codigo: '70X20-1', valor: 8.00 },
  { id: '36', codigo: '70X20-2', valor: 8.00 },
  { id: '37', codigo: '70X25-1', valor: 8.00 },
  { id: '38', codigo: '70X25-2', valor: 8.00 },
  { id: '39', codigo: '70X30-1', valor: 8.00 },
  { id: '40', codigo: '70X30-2', valor: 8.00 },
  { id: '41', codigo: '76X15-1', valor: 8.00 },
  { id: '42', codigo: '76X15-2', valor: 8.00 },
  { id: '43', codigo: '76X15-1-NYLON', valor: 8.00 },
  { id: '44', codigo: '76X15-2-NYLON', valor: 8.00 },
  { id: '45', codigo: '76X17-1', valor: 8.00 },
  { id: '46', codigo: '76X17-2', valor: 8.00 },
  { id: '47', codigo: '76X17-1-NYLON', valor: 8.00 },
  { id: '48', codigo: '76X17-2-NYLON', valor: 8.00 },
  { id: '49', codigo: '76X20-1', valor: 8.00 },
  { id: '50', codigo: '76X20-2', valor: 12.00 },
  { id: '51', codigo: '76X20-1-NYLON', valor: 12.00 },
  { id: '52', codigo: '76X20-2-NYLON', valor: 12.00 },
  { id: '53', codigo: '76X25-1', valor: 12.00 },
  { id: '54', codigo: '76X25-2', valor: 12.00 },
  { id: '55', codigo: '102X20-1', valor: 26.00 },
  { id: '56', codigo: '102X20-2', valor: 26.00 },
  { id: '57', codigo: '102X20-1 NYLON', valor: 26.00 },
  { id: '58', codigo: '102X20-2 NYLON', valor: 26.00 },
  { id: '59', codigo: '102X25-1', valor: 26.00 },
  { id: '60', codigo: '102X25-2', valor: 26.00 },
  { id: '61', codigo: '102X30-1', valor: 26.00 },
  { id: '62', codigo: '102X30-2', valor: 24.00 },
  { id: '63', codigo: '102X35-1', valor: 24.00 },
  { id: '64', codigo: '102X35-2', valor: 24.00 },
  { id: '65', codigo: '102X40-1', valor: 24.00 },
  { id: '66', codigo: '102X40-2', valor: 24.00 },
  { id: '67', codigo: '115X20-1', valor: 24.00 },
  { id: '68', codigo: '115X20-2', valor: 24.00 },
  { id: '69', codigo: '115X25-1', valor: 24.00 },
  { id: '70', codigo: '115X25-2', valor: 24.00 },
  { id: '71', codigo: '115X30-1', valor: 24.00 },
  { id: '72', codigo: '115X30-2', valor: 24.00 },
  { id: '73', codigo: '115X35-1', valor: 24.00 },
  { id: '74', codigo: '115X35-2', valor: 24.00 },
  { id: '75', codigo: '115X40-1', valor: 24.00 },
  { id: '76', codigo: '115X40-2', valor: 24.00 },
  { id: '77', codigo: '127X20-1', valor: 24.00 },
  { id: '78', codigo: '127X20-2', valor: 48.00 },
  { id: '79', codigo: '127X25-1', valor: 25.00 },
  { id: '80', codigo: '127X25-2', valor: 19.00 },
  { id: '81', codigo: '127X30-1', valor: 19.00 },
  { id: '82', codigo: '127X30-2', valor: 19.00 },
  { id: '83', codigo: '127X35-1', valor: 19.00 },
  { id: '84', codigo: '127X35-2', valor: 19.00 },
  { id: '85', codigo: '127X40-1', valor: 19.00 },
  { id: '86', codigo: '127X40-2', valor: 19.00 },
  { id: '87', codigo: '140X20-1', valor: 19.00 },
  { id: '88', codigo: '140X20-2', valor: 19.00 },
  { id: '89', codigo: '140X25-1', valor: 19.00 },
  { id: '90', codigo: '140X25-2', valor: 19.00 },
  { id: '91', codigo: '140X30-1', valor: 19.00 },
  { id: '92', codigo: '140X30-2', valor: 19.00 },
  { id: '93', codigo: '140X35-1', valor: 19.00 },
  { id: '94', codigo: '140X35-2', valor: 19.00 },
  { id: '95', codigo: '140X40-1', valor: 19.00 },
  { id: '96', codigo: '140X40-2', valor: 19.00 },
  { id: '97', codigo: '152X20-1', valor: 19.00 },
  { id: '98', codigo: '152X20-2', valor: 19.00 },
  { id: '99', codigo: '152X25-1', valor: 19.00 },
  { id: '100', codigo: '152X25-2', valor: 22.00 },
  { id: '101', codigo: '152X30-1', valor: 22.00 },
  { id: '102', codigo: '152X30-2', valor: 24.00 },
  { id: '103', codigo: '152X35-1', valor: 24.00 },
  { id: '104', codigo: '152X35-2', valor: 24.00 },
  { id: '105', codigo: '152X40-1', valor: 24.00 },
  { id: '106', codigo: '152X40-2', valor: 65.00 },
  { id: '107', codigo: '165X20-1', valor: 65.00 },
  { id: '108', codigo: '165X20-2', valor: 65.00 },
  { id: '109', codigo: '165X25-1', valor: 65.00 },
  { id: '110', codigo: '165X25-2', valor: 65.00 },
  { id: '111', codigo: '165X30-1', valor: 65.00 },
  { id: '112', codigo: '165X30-2', valor: 65.00 },
  { id: '113', codigo: '165X35-1', valor: 65.00 },
  { id: '114', codigo: '165X35-2', valor: 65.00 },
  { id: '115', codigo: '165X40-1', valor: 65.00 },
  { id: '116', codigo: '165X40-2', valor: 65.00 },
];

const SEED_REVESTIMENTOS: Revestimento[] = [
  // Spiraflex
  { id: '1', tipo: 'SPIRAFLEX AZ-2', valorMetroOuPeca: 7.14 },
  { id: '2', tipo: 'SPIRAFLEX AZ-3', valorMetroOuPeca: 15.70 },
  { id: '3', tipo: 'SPIRAFLEX AZ-4', valorMetroOuPeca: 21.00 },
  { id: '4', tipo: 'SPIRAFLEX AZ-5', valorMetroOuPeca: 34.12 },
  { id: '5', tipo: 'SPIRAFLEX AZ-6', valorMetroOuPeca: 53.34 },
  { id: '6', tipo: 'SPIRAFLEX LA-2', valorMetroOuPeca: 7.14 },
  { id: '7', tipo: 'SPIRAFLEX LA-3', valorMetroOuPeca: 15.70 },
  { id: '8', tipo: 'SPIRAFLEX LA-4', valorMetroOuPeca: 21.00 },
  { id: '9', tipo: 'SPIRAFLEX LA-5', valorMetroOuPeca: 34.12 },
  { id: '10', tipo: 'SPIRAFLEX LA-6', valorMetroOuPeca: 53.34 },
  // Anéis
  { id: '11', tipo: 'ABI-102 X 50 X 50', valorMetroOuPeca: 4.30 },
  { id: '12', tipo: 'ABI-152 X 102 X 50', valorMetroOuPeca: 8.20 },
  { id: '13', tipo: 'ABI-127 x 76 x 50', valorMetroOuPeca: 7.00 },
  { id: '14', tipo: 'ABI-114 x 50 x 50', valorMetroOuPeca: 5.80 },
  { id: '15', tipo: 'ABI-165 x 102 x 50', valorMetroOuPeca: 9.50 },
  { id: '16', tipo: 'ABI-140 x 102 x 50', valorMetroOuPeca: 7.00 },
  { id: '17', tipo: 'ABI-127 x 89 x 50', valorMetroOuPeca: 6.00 },
  { id: '18', tipo: 'ABI-90 x 50 x 50', valorMetroOuPeca: 4.30 },
  { id: '19', tipo: 'ABI-178 x 102 x 50', valorMetroOuPeca: 13.00 },
];

const SEED_ENCAIXES: Encaixe[] = [
  { id: '1', tipo: 'LPW', preco: 0.00 },
  { id: '2', tipo: 'BARBER GREENE', preco: 2.00 },
  { id: '3', tipo: 'FAÇO', preco: 4.00 },
  { id: '4', tipo: 'ROSCA EXTERNA', preco: 5.00 },
  { id: '5', tipo: 'ROSCA INTERNA', preco: 8.00 },
  { id: '6', tipo: 'FURO NO EIXO', preco: 2.00 },
];

const SEED_CLIENTES: Cliente[] = [
  { id: '1', nome: 'Polimix', cnpj: '12.345.678/0001-90', email: 'contato@polimix.com.br', telefone: '(11) 3456-7890', whatsapp: '(11) 93456-7890', endereco: 'Rua Industrial, 500', cidade: 'São Paulo', estado: 'SP', contato: 'João Silva', compradores: [{ nome: 'João Silva', telefone: '(11) 3456-7890', email: 'joao@polimix.com.br', whatsapp: '(11) 93456-7890' }], createdAt: '2025-01-15' },
  { id: '2', nome: 'Votorantim Cimentos', cnpj: '22.333.444/0001-55', email: 'compras@votorantim.com', telefone: '(11) 2345-6789', whatsapp: '(11) 92345-6789', endereco: 'Av. Paulista, 1000', cidade: 'São Paulo', estado: 'SP', contato: 'Maria Souza', compradores: [{ nome: 'Maria Souza', telefone: '(11) 2345-6789', email: 'maria@votorantim.com', whatsapp: '(11) 92345-6789' }], createdAt: '2025-02-01' },
];

const SEED_PRODUTOS: Produto[] = [
  { id: '1', codigo: 'RC-001', nome: 'Rolete de Carga', tipo: 'RC', medidas: '', descricao: 'Rolete de carga padrão', miniDescricao: 'Rolete para correia transportadora', valor: 0, createdAt: '2025-01-01' },
  { id: '2', codigo: 'RR-001', nome: 'Rolete de Retorno', tipo: 'RR', medidas: '', descricao: 'Rolete de retorno padrão', miniDescricao: 'Rolete de retorno', valor: 0, createdAt: '2025-01-01' },
  { id: '3', codigo: 'RG-001', nome: 'Rolete Guia', tipo: 'RG', medidas: '', descricao: 'Rolete guia padrão', miniDescricao: 'Rolete guia lateral', valor: 0, createdAt: '2025-01-01' },
  { id: '4', codigo: 'RI-001', nome: 'Rolete de Impacto', tipo: 'RI', medidas: '', descricao: 'Rolete de impacto padrão', miniDescricao: 'Rolete de impacto para carga', valor: 0, createdAt: '2025-01-01' },
  { id: '5', codigo: 'RRA-001', nome: 'Rolete de Retorno com Anéis', tipo: 'RRA', medidas: '', descricao: 'Rolete de retorno auto-limpante com anéis', miniDescricao: 'Rolete auto-limpante', valor: 0, createdAt: '2025-01-01' },
];

const SEED_USUARIOS: Usuario[] = [
  { id: '1', nome: 'Admin Master', email: 'admin@rollerport.com.br', nivel: 'master', ativo: true, createdAt: '2025-01-01' },
  { id: '2', nome: 'Paulo Vendas', email: 'paulo@rollerport.com.br', nivel: 'vendedor', ativo: true, createdAt: '2025-01-10' },
];

// ===== Store functions =====
export const store = {
  getTubos: (): Tubo[] => load('rp_tubos', SEED_TUBOS),
  saveTubos: (d: Tubo[]) => save('rp_tubos', d),

  getEixos: (): Eixo[] => load('rp_eixos', SEED_EIXOS),
  saveEixos: (d: Eixo[]) => save('rp_eixos', d),

  getConjuntos: (): Conjunto[] => load('rp_conjuntos', SEED_CONJUNTOS),
  saveConjuntos: (d: Conjunto[]) => save('rp_conjuntos', d),

  getRevestimentos: (): Revestimento[] => load('rp_revestimentos', SEED_REVESTIMENTOS),
  saveRevestimentos: (d: Revestimento[]) => save('rp_revestimentos', d),

  getEncaixes: (): Encaixe[] => load('rp_encaixes', SEED_ENCAIXES),
  saveEncaixes: (d: Encaixe[]) => save('rp_encaixes', d),

  getClientes: (): Cliente[] => load('rp_clientes', SEED_CLIENTES),
  saveClientes: (d: Cliente[]) => save('rp_clientes', d),

  getProdutos: (): Produto[] => load('rp_produtos', SEED_PRODUTOS),
  saveProdutos: (d: Produto[]) => save('rp_produtos', d),

  getOrcamentos: (): Orcamento[] => load('rp_orcamentos', []),
  saveOrcamentos: (d: Orcamento[]) => save('rp_orcamentos', d),

  getPedidos: (): Pedido[] => load('rp_pedidos', []),
  savePedidos: (d: Pedido[]) => save('rp_pedidos', d),

  getOrdensServico: (): OrdemServico[] => load('rp_os', []),
  saveOrdensServico: (d: OrdemServico[]) => save('rp_os', d),

  getEstoque: (): ItemEstoque[] => load('rp_estoque', []),
  saveEstoque: (d: ItemEstoque[]) => save('rp_estoque', d),

  getUsuarios: (): Usuario[] => load('rp_usuarios', SEED_USUARIOS),
  saveUsuarios: (d: Usuario[]) => save('rp_usuarios', d),

  getNotificacoes: (): Notificacao[] => load('rp_notificacoes', []),
  saveNotificacoes: (d: Notificacao[]) => save('rp_notificacoes', d),

  getMetas: (): MetaVendedor[] => load('rp_metas', []),
  saveMetas: (d: MetaVendedor[]) => save('rp_metas', d),

  getTaxaConversao: (): number => load('rp_taxa_conversao', 0),
  saveTaxaConversao: (v: number) => save('rp_taxa_conversao', v),

  nextId: (prefix: string): string => {
    const key = `rp_counter_${prefix}`;
    const n = parseInt(localStorage.getItem(key) || '0') + 1;
    localStorage.setItem(key, String(n));
    return String(n);
  },
  nextNumero: (prefix: string): string => {
    const n = parseInt(localStorage.getItem(`rp_num_${prefix}`) || '0') + 1;
    localStorage.setItem(`rp_num_${prefix}`, String(n));
    return `${String(n).padStart(4, '0')}/2025`;
  },
};
