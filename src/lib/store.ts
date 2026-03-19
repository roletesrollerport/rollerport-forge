import type {
  Tubo, Eixo, Conjunto, Revestimento, Encaixe,
  Cliente, Fornecedor, Orcamento, Pedido, OrdemServico, ItemEstoque, Usuario, Produto,
  Notificacao, MetaVendedor, AgendaItem
} from './types';

function load<T>(key: string, fallback: T): T {
  try {
    const d = localStorage.getItem(key);
    if (d) return JSON.parse(d);
    // First time: persist seed data to localStorage so sync can find it
    if (Array.isArray(fallback) && (fallback as any[]).length > 0) {
      localStorage.setItem(key, JSON.stringify(fallback));
    }
    return fallback;
  } catch { return fallback; }
}

function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
  // Dispatch event so the sync layer can push to DB
  window.dispatchEvent(new CustomEvent('rp-store-save', { detail: { key } }));
}

// ===== Complete seed data from spreadsheet =====
const SEED_TUBOS: Tubo[] = [
  { id: '1', diametro: 50, parede: 3, precoBarra6000mm: 162.12 },
  { id: '2', diametro: 50, parede: 3.75, precoBarra6000mm: 80.82 },
  { id: '3', diametro: 60, parede: 3, precoBarra6000mm: 79.68 },
  { id: '4', diametro: 60, parede: 5, precoBarra6000mm: 128.16 },
  { id: '5', diametro: 63, parede: 3, precoBarra6000mm: 83.88 },
  { id: '6', diametro: 63, parede: 3.75, precoBarra6000mm: 103.56 },
  { id: '7', diametro: 70, parede: 3, precoBarra6000mm: 93.66 },
  { id: '8', diametro: 70, parede: 5, precoBarra6000mm: 151.50 },
  { id: '9', diametro: 76, parede: 3, precoBarra6000mm: 227.94 },
  { id: '10', diametro: 76, parede: 3.75, precoBarra6000mm: 126.30 },
  { id: '11', diametro: 102, parede: 2.25, precoBarra6000mm: 198.72 },
  { id: '12', diametro: 102, parede: 2.65, precoBarra6000mm: 233.16 },
  { id: '13', diametro: 102, parede: 3.75, precoBarra6000mm: 343.44 },
  { id: '14', diametro: 102, parede: 4.25, precoBarra6000mm: 193.62 },
  { id: '15', diametro: 115, parede: 3, precoBarra6000mm: 156.60 },
  { id: '16', diametro: 115, parede: 3.75, precoBarra6000mm: 194.46 },
  { id: '17', diametro: 115, parede: 4.25, precoBarra6000mm: 219.36 },
  { id: '18', diametro: 127, parede: 3, precoBarra6000mm: 387.24 },
  { id: '19', diametro: 127, parede: 3.75, precoBarra6000mm: 215.40 },
  { id: '20', diametro: 127, parede: 4.25, precoBarra6000mm: 243.12 },
  { id: '21', diametro: 140, parede: 3.35, precoBarra6000mm: 220.50 },
  { id: '22', diametro: 140, parede: 3.75, precoBarra6000mm: 246.06 },
  { id: '23', diametro: 140, parede: 4.25, precoBarra6000mm: 277.86 },
  { id: '24', diametro: 152, parede: 3, precoBarra6000mm: 215.28 },
  { id: '25', diametro: 152, parede: 3.75, precoBarra6000mm: 267.72 },
  { id: '26', diametro: 152, parede: 4.25, precoBarra6000mm: 302.40 },
  { id: '27', diametro: 152, parede: 4.75, precoBarra6000mm: 336.84 },
  { id: '28', diametro: 165, parede: 3.75, precoBarra6000mm: 291.24 },
  { id: '29', diametro: 165, parede: 4.25, precoBarra6000mm: 329.04 },
];

const SEED_EIXOS: Eixo[] = [
  { id: '1', diametro: '15', precoBarra6000mm: 84.36 },
  { id: '2', diametro: '17', precoBarra6000mm: 108.36 },
  { id: '3', diametro: '20', precoBarra6000mm: 149.94 },
  { id: '4', diametro: '25', precoBarra6000mm: 234.30 },
  { id: '5', diametro: '30', precoBarra6000mm: 337.38 },
  { id: '6', diametro: '35', precoBarra6000mm: 459.24 },
  { id: '7', diametro: '40', precoBarra6000mm: 599.82 },
  { id: '8', diametro: '45', precoBarra6000mm: 251.46 },
  { id: '9', diametro: '50', precoBarra6000mm: 310.44 },
  { id: '10', diametro: '55', precoBarra6000mm: 375.66 },
  { id: '11', diametro: '60', precoBarra6000mm: 447.06 },
  { id: '12', diametro: '65', precoBarra6000mm: 524.70 },
  { id: '13', diametro: '70', precoBarra6000mm: 608.52 },
  { id: '14', diametro: '75', precoBarra6000mm: 698.52 },
  { id: '15', diametro: '80', precoBarra6000mm: 794.76 },
  { id: '16', diametro: '15-INOX', precoBarra6000mm: 96.00 },
  { id: '17', diametro: '20-INOX', precoBarra6000mm: 102.00 },
  { id: '18', diametro: '25-INOX', precoBarra6000mm: 108.00 },
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
  { id: '1', nome: 'Sistema Rollerport', email: 'gerente@rollerport.com.br', telefone: '(11) 4441-3572', whatsapp: '(11) 94441-3572', login: 'Gerente De sistema', senha: '••••••', nivel: 'master', ativo: true, createdAt: '2025-01-01' },
  { id: '2', nome: 'Paulo Vendas', email: 'paulo@rollerport.com.br', telefone: '', whatsapp: '', login: 'paulo', senha: '••••••', nivel: 'Vendas', ativo: true, createdAt: '2025-01-10' },
];

const SEED_AGENDA: AgendaItem[] = [
  {
    id: '1',
    titulo: 'Visita Técnica - Polimix',
    descricao: 'Verificar alinhamento dos roletes de carga na linha 4.',
    data_inicio: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T10:00:00`; })(),
    data_fim: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T11:30:00`; })(),
    tipo: 'Visita Técnica',
    cliente_id: '1',
    clienteNome: 'Polimix',
    status: false,
    createdAt: new Date().toISOString()
  }
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

  getFornecedores: (): Fornecedor[] => load('rp_fornecedores', []),
  saveFornecedores: (d: Fornecedor[]) => save('rp_fornecedores', d),

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

  getUsuarios: (): Usuario[] => {
    return load('rp_usuarios', SEED_USUARIOS);
  },
  saveUsuarios: (d: Usuario[]) => save('rp_usuarios', d),

  getNotificacoes: (): Notificacao[] => load('rp_notificacoes', []),
  saveNotificacoes: (d: Notificacao[]) => save('rp_notificacoes', d),

  getMetas: (): MetaVendedor[] => load('rp_metas', []),
  saveMetas: (d: MetaVendedor[]) => save('rp_metas', d),

  getAgenda: (): AgendaItem[] => {
    const raw = load('rp_agenda', SEED_AGENDA);
    // Deduplicate by id to prevent phantom duplicates from stale seeds
    const seen = new Set<string>();
    return raw.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  },
  saveAgenda: (d: AgendaItem[]) => save('rp_agenda', d),

  getTaxaConversao: (): number => load('rp_taxa_conversao', 0),
  saveTaxaConversao: (v: number) => save('rp_taxa_conversao', v),

  nextId: (prefix: string): string => {
    const key = `rp_counter_${prefix}`;
    const n = parseInt(localStorage.getItem(key) || '1000') + 1;
    localStorage.setItem(key, String(n));
    return `${prefix}_${n}`;
  },
  nextNumero: (): string => {
    const year = new Date().getFullYear();
    const yearShort = String(year).slice(-2);
    const key = `rp_num_global_${year}`;
    const stored = localStorage.getItem(key);
    // Standardize starting at 955 so the first new one is 956
    const n = (stored !== null ? parseInt(stored) : 955) + 1;
    localStorage.setItem(key, String(n));
    return `${String(n).padStart(4, '0')}/${yearShort}`;
  },

  /**
   * One-time migration: renumber EVERYTHING starting at 956/26
   * Syncs Orçamentos, Pedidos, and Ordens de Serviço.
   */
  migrateNumeracao956: () => {
    const migrationKey = 'rp_migration_numeracao_956_v3';
    if (localStorage.getItem(migrationKey)) return;

    const year = new Date().getFullYear();
    const yearShort = String(year).slice(-2);
    
    const orcamentos: Orcamento[] = load('rp_orcamentos', []);
    const pedidos: Pedido[] = load('rp_pedidos', []);
    const ordens: OrdemServico[] = load('rp_os', []);

    if (orcamentos.length === 0) {
      localStorage.setItem(migrationKey, '1');
      return;
    }

    // Sort by createdAt to preserve chronological order
    const sortedOrcs = [...orcamentos].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let counter = 956;
    const orcIdToNewNum: Record<string, string> = {};

    sortedOrcs.forEach(orc => {
      const newNum = `${String(counter).padStart(4, '0')}/${yearShort}`;
      orcIdToNewNum[orc.id] = newNum;
      orc.numero = newNum;
      counter++;
    });

    // Map Pedidos to new numbers and cache vendedor
    const pedIdToNewNum: Record<string, string> = {};
    const pedIdToVendedor: Record<string, string> = {};
    const updatedPedidos = pedidos.map(p => {
      const newNum = orcIdToNewNum[p.orcamentoId];
      const orc = sortedOrcs.find(o => o.id === p.orcamentoId);
      const vendor = p.vendedor || orc?.vendedor || '';
      if (newNum) {
        p.numero = newNum;
        p.orcamentoNumero = newNum;
        pedIdToNewNum[p.id] = newNum;
      }
      if (vendor) pedIdToVendedor[p.id] = vendor;
      return p;
    });

    // Map OS to new numbers and sync vendedor
    const updatedOrdens = ordens.map(os => {
      const newNum = pedIdToNewNum[os.pedidoId];
      const vendor = pedIdToVendedor[os.pedidoId];
      if (newNum) {
        os.numero = newNum;
        os.pedidoNumero = newNum;
      }
      if (vendor) os.vendedor = vendor;
      return os;
    });

    save('rp_orcamentos', sortedOrcs);
    save('rp_pedidos', updatedPedidos);
    save('rp_os', updatedOrdens);

    // Update the new global counter
    const numKey = `rp_num_global_${year}`;
    localStorage.setItem(numKey, String(counter - 1));

    localStorage.setItem(migrationKey, '1');
  },
};

// Run one-time migration on module load
store.migrateNumeracao956();
