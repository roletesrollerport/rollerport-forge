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

// ===== Seed data from spreadsheets =====
const SEED_TUBOS: Tubo[] = [
  { id: '1', diametro: 50, parede: 3, valorMetro: 27.02 },
  { id: '2', diametro: 50, parede: 3.75, valorMetro: 13.47 },
  { id: '3', diametro: 60, parede: 3, valorMetro: 13.28 },
  { id: '4', diametro: 60, parede: 5, valorMetro: 21.36 },
  { id: '5', diametro: 63, parede: 3, valorMetro: 13.98 },
  { id: '6', diametro: 76, parede: 3, valorMetro: 37.99 },
  { id: '7', diametro: 102, parede: 2.25, valorMetro: 33.12 },
  { id: '8', diametro: 102, parede: 2.65, valorMetro: 38.86 },
  { id: '9', diametro: 102, parede: 3.75, valorMetro: 57.24 },
  { id: '10', diametro: 115, parede: 3, valorMetro: 26.10 },
  { id: '11', diametro: 127, parede: 3, valorMetro: 64.54 },
  { id: '12', diametro: 140, parede: 3.35, valorMetro: 36.75 },
  { id: '13', diametro: 152, parede: 3, valorMetro: 35.88 },
  { id: '14', diametro: 165, parede: 3.75, valorMetro: 48.54 },
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
  { id: '10', diametro: '20-INOX', valorMetro: 17.00 },
];

const SEED_CONJUNTOS: Conjunto[] = [
  { id: '1', codigo: '50X15-1', valor: 8.00 },
  { id: '2', codigo: '50X15-2', valor: 8.00 },
  { id: '3', codigo: '60X17-1', valor: 8.00 },
  { id: '4', codigo: '76X20-1', valor: 8.00 },
  { id: '5', codigo: '76X20-2', valor: 12.00 },
  { id: '6', codigo: '102X20-1', valor: 26.00 },
  { id: '7', codigo: '102X25-1', valor: 26.00 },
  { id: '8', codigo: '115X25-1', valor: 24.00 },
  { id: '9', codigo: '127X25-1', valor: 25.00 },
  { id: '10', codigo: '140X30-1', valor: 19.00 },
  { id: '11', codigo: '152X30-1', valor: 22.00 },
  { id: '12', codigo: '165X30-1', valor: 65.00 },
];

const SEED_REVESTIMENTOS: Revestimento[] = [
  { id: '1', tipo: 'SPIRAFLEX AZ-2', valorMetroOuPeca: 7.14 },
  { id: '2', tipo: 'SPIRAFLEX AZ-3', valorMetroOuPeca: 15.70 },
  { id: '3', tipo: 'SPIRAFLEX AZ-4', valorMetroOuPeca: 21.00 },
  { id: '4', tipo: 'SPIRAFLEX AZ-5', valorMetroOuPeca: 34.12 },
  { id: '5', tipo: 'SPIRAFLEX LA-2', valorMetroOuPeca: 7.14 },
  { id: '6', tipo: 'SPIRAFLEX LA-3', valorMetroOuPeca: 15.70 },
  { id: '7', tipo: 'ABI-102 X 50 X 50', valorMetroOuPeca: 4.30 },
  { id: '8', tipo: 'ABI-152 X 102 X 50', valorMetroOuPeca: 8.20 },
];

const SEED_ENCAIXES: Encaixe[] = [
  { id: '1', tipo: 'LPW', preco: 0.00 },
  { id: '2', tipo: 'BARBER GREENE', preco: 2.00 },
  { id: '3', tipo: 'FAÇO', preco: 4.00 },
  { id: '4', tipo: 'ROSCA EXTERNA', preco: 5.00 },
  { id: '5', tipo: 'ROSCA INTERNA', preco: 8.00 },
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

  // Settings
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
