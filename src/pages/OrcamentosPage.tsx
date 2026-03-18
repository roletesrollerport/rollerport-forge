import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { store } from '@/lib/store';
import { useUsuarios } from '@/hooks/useUsuarios';
import type { Orcamento, ItemOrcamento, ItemProdutoOrcamento, StatusOrcamento, TipoFrete, Cliente, Comprador, Produto, Tubo, Eixo, Conjunto, Revestimento, Encaixe, EmpresaEmitente } from '@/lib/types';
import { useCustos } from '@/hooks/useCustos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Eye, Edit, Search, Settings2, Package, Printer,
  ShoppingCart, ArrowLeft, UserPlus, X as XIcon, Copy, History,
  FileText, Mail, Settings2 as SettingsIcon, Check, PlusCircle,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import logoRollerport from '@/assets/logo-rollerport.png';
import logoFerreira from '@/assets/logo-ferreira.png';
import qrcode from '@/assets/qrcode-rollerport.jpeg';

const emptyItem = (): ItemOrcamento => ({
  id: '', tipoRolete: '' as any, quantidade: '' as any, diametroTubo: '' as any, paredeTubo: '' as any, comprimentoTubo: '' as any,
  comprimentoEixo: '' as any, diametroEixo: '' as any, tipoEncaixe: '', medidaFresado: '', conjunto: '',
  tipoRevestimento: '', especificacaoRevestimento: '', quantidadeAneis: '' as any, custo: 0,
  multiplicador: 1.8, desconto: '' as any, valorPorPeca: 0, valorTotal: 0, ncm: '8431.39.00',
  aliqPIS: 0, aliqCOFINS: 0, aliqICMS: 0, aliqIPI: 0, valorPIS: 0, valorCOFINS: 0, valorICMS: 0, valorIPI: 0
});

function calcItem(item: ItemOrcamento, tubos: Tubo[], eixos: Eixo[], conjuntos: Conjunto[], revestimentos: Revestimento[], encaixes: Encaixe[]): ItemOrcamento {

  const tubo = tubos.find(t => t.diametro === item.diametroTubo && t.parede === item.paredeTubo);
  const eixo = eixos.find(e => e.diametro === String(item.diametroEixo));
  const conj = conjuntos.find(c => c.codigo === item.conjunto);
  const rev = revestimentos.find(r => r.tipo === item.especificacaoRevestimento);
  const enc = encaixes.find(e => e.tipo === item.tipoEncaixe);

  // ETAPA 1 – Cálculo do tubo (aproveitamento de barra de 6000 mm)
  let custoTubo = 0;
  if (tubo && item.comprimentoTubo > 0 && item.comprimentoTubo < 6000) {
    const QT = Math.max(1, Math.floor(6000 / item.comprimentoTubo));
    custoTubo = tubo.precoBarra6000mm / QT;
  }

  // ETAPA 2 – Cálculo do eixo (aproveitamento de barra de 6000 mm)
  let custoEixo = 0;
  if (eixo && item.comprimentoEixo > 0 && item.comprimentoEixo < 6000) {
    const QE = Math.max(1, Math.floor(6000 / item.comprimentoEixo));
    custoEixo = eixo.precoBarra6000mm / QE;
  }

  // ETAPA 3 – Custo base
  const custoConj = conj ? conj.valor : 0;
  const custoEnc = enc ? enc.preco : 0;

  // ETAPA 4 – Revestimento
  let custoRev = 0;
  if (rev) {
    const isSpiraflex = rev.tipo.toUpperCase().includes('SPIRAFLEX');
    if (isSpiraflex) {
      custoRev = rev.valorMetroOuPeca * (item.comprimentoEixo / 1000);
    } else {
      custoRev = rev.valorMetroOuPeca * (item.quantidadeAneis || 1);
    }
  }

  const custo = custoTubo + custoEixo + custoConj + custoEnc + custoRev;
  const multiplicador = item.multiplicador || 1.8;
  const desconto = item.desconto || 0;
  
  // O valor total é o preço final de venda. Os impostos são destacados "por dentro".
  const valorPorPeca = custo * multiplicador * (1 - desconto / 100);
  const valorTotal = valorPorPeca * item.quantidade;

  // Extração informativa dos impostos (por dentro do total)
  const aliqPIS = item.aliqPIS || 0;
  const aliqCOFINS = item.aliqCOFINS || 0;
  const aliqICMS = item.aliqICMS || 0;
  const aliqIPI = item.aliqIPI || 0;

  const valorPIS = valorTotal * (aliqPIS / 100);
  const valorCOFINS = valorTotal * (aliqCOFINS / 100);
  const valorICMS = valorTotal * (aliqICMS / 100);
  const valorIPI = valorTotal * (aliqIPI / 100);

  return { 
    ...item, 
    custo: +custo.toFixed(2), 
    valorPorPeca: +valorPorPeca.toFixed(2), 
    valorTotal: +valorTotal.toFixed(2),
    aliqPIS, aliqCOFINS, aliqICMS, aliqIPI,
    valorPIS: +valorPIS.toFixed(2),
    valorCOFINS: +valorCOFINS.toFixed(2),
    valorICMS: +valorICMS.toFixed(2),
    valorIPI: +valorIPI.toFixed(2)
  };
}

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

const EMPRESAS = {
  rollerport: {
    nome: 'ROLLERPORT',
    razaoSocialCompleta: 'ROLLERPORT INDUSTRIA, COMERCIO SERVIÇOS DE ROLETES LTDA',
    subtitulo: 'Fábrica de Roletes',
    cnpj: '58.234.180/0001-56',
    ie: '312.259.169.119',
    endereco: 'Rua João Marcos Pimenta Rocha, 16 – Pólo Industrial',
    cidadeEstado: 'Franco da Rocha/SP – CEP: 07832-460',
    telefone: '(11) 4441-3572',
    email: 'faturamento@rollerport.com.br',
    regimeTributario: 'simples_nacional' as const,
    logo: logoRollerport,
    banco: 'BANCO SANTANDER (033)',
    razaoSocial: 'FERREIRA ROLETES IND. COM. SERV. LTDA (Rollerport)',
    cnpjBanco: '10.311.350/0001-22',
    agencia: '3744',
    contaCorrente: '130094436',
    chavePix: '10.311.350/0001-22',
    // Fiscal info for print
    fiscalLabel: 'PIS/PASEP: 2,49% | COFINS: 11,51%',
    fiscalNota: 'Regime: Simples Nacional – Tributos já inclusos no preço unitário.',
  },
  ferreira_roletes: {
    nome: 'FERREIRA ROLETES',
    razaoSocialCompleta: 'FERREIRA ROLETES, INDÚSTRIA COMERCIO E SERVIÇO LTDA',
    subtitulo: 'Ind. Com. Serv. Ltda',
    cnpj: '10.311.350/0001-22',
    ie: '312.034.593.110',
    endereco: 'Rua João Marcos Pimenta Rocha, 16 – Pólo Industrial',
    cidadeEstado: 'Franco da Rocha/SP – CEP: 07832-460',
    telefone: '(11) 4441-3572',
    email: 'contato@ferreiraroletes.com.br',
    regimeTributario: 'lucro_presumido' as const,
    logo: logoFerreira,
    banco: 'BANCO SANTANDER (033)',
    razaoSocial: 'FERREIRA ROLETES IND. COM. SERV. LTDA',
    cnpjBanco: '10.311.350/0001-22',
    agencia: '3744',
    contaCorrente: '130094436',
    chavePix: '10.311.350/0001-22',
    // Fiscal info for print (ICMS is dynamic based on destination)
    fiscalLabel: '', // built dynamically
    fiscalNota: 'Regime: Lucro Presumido – Tributos já inclusos no preço unitário.',
  },
};

type View = 'list' | 'form' | 'view' | 'print';

export default function OrcamentosPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [view, setView] = useState<View>('list');
  const [viewOrc, setViewOrc] = useState<Orcamento | null>(null);
  const [editingOrc, setEditingOrc] = useState<Orcamento | null>(null);
  const [searchList, setSearchList] = useState('');

  // Categoria: cliente ou revenda
  const [categoriaOrc, setCategoriaOrc] = useState<'cliente' | 'revenda'>('cliente');

  // Form state
  const [clienteId, setClienteId] = useState('');
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [tipoFrete, setTipoFrete] = useState<TipoFrete>('FOB');
  const [condicaoPagamento, setCondicaoPagamento] = useState('');
  const [vendedor, setVendedor] = useState('');
  const [dataOrcamento, setDataOrcamento] = useState(new Date().toLocaleDateString('pt-BR'));
  const [previsaoEntrega, setPrevisaoEntrega] = useState('');
  const [observacao, setObservacao] = useState('');
  const [compradorSelecionado, setCompradorSelecionado] = useState('');
  const [itensRolete, setItensRolete] = useState<ItemOrcamento[]>([]);
  const [itensProduto, setItensProduto] = useState<ItemProdutoOrcamento[]>([]);
  const [prazoPagamento, setPrazoPagamento] = useState('');
  const [empresaEmitente, setEmpresaEmitente] = useState<EmpresaEmitente>('rollerport');

  // Sub-panels
  const [showProdutoSearch, setShowProdutoSearch] = useState(false);
  const [produtoSearch, setProdutoSearch] = useState('');
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [produtoQtd, setProdutoQtd] = useState(1);
  const [produtoNcm, setProdutoNcm] = useState('');
  const [produtoDesconto, setProdutoDesconto] = useState(0);
  const [produtoAliqPIS, setProdutoAliqPIS] = useState(0);
  const [produtoAliqCOFINS, setProdutoAliqCOFINS] = useState(0);
  const [produtoAliqICMS, setProdutoAliqICMS] = useState(0);
  const [produtoAliqIPI, setProdutoAliqIPI] = useState(0);

  // Estados para Orçamento Técnico
  const [showTecnico, setShowTecnico] = useState(false);
  const [tecnicoData, setTecnicoData] = useState<string[]>([
    'Tubo industrial com costura em aço carbono conforme NBR-6591 ø101,6x2,25mm',
    'Eixo trefilado SAE-1020 ø20mm',
    'Rolamento rígido de uma carreira de esferas 6204 2RS C3 marca GBR ou similar',
    'Porta rolamento estampado em chapa de aço soldado no tubo',
    'Lubrificação permanente com graxa especial a base de lítio',
    'Vedação composta por múltiplos labirintos fabricados em poliamida, projetados para uso em ambientes agressivos',
    'Rolos com garantia contra defeitos de fabricação 08 meses',
    'Rolos com pintura Eletrostática em poliéster cor vermelha',
    'Cavaletes com pintura esmalte sintético cor azul',
  ]);

  const [showRoleteForm, setShowRoleteForm] = useState(false);
  const [roleteItem, setRoleteItem] = useState<ItemOrcamento>(emptyItem());
  const [codigoRolete, setCodigoRolete] = useState('');

  // Cadastro rápido cliente (completo igual à tela de clientes)
  const [showCadCliente, setShowCadCliente] = useState(false);
  const [cadCliente, setCadCliente] = useState<Omit<Cliente, 'id' | 'createdAt'>>({
    nome: '', cnpj: '', email: '', telefone: '', whatsapp: '', endereco: '', cidade: '', estado: '', contato: '',
    compradores: [{ nome: '', telefone: '', email: '', whatsapp: '', aniversario: '', redesSociais: '' }],
    aniversarioEmpresa: '', redesSociais: '',
  });

  // Cadastro rápido comprador
  const [showCadComprador, setShowCadComprador] = useState(false);
  const [cadComprador, setCadComprador] = useState({ nome: '', telefone: '', email: '', whatsapp: '', aniversario: '', redesSociais: '' });

  // Cadastro rápido produto
  const [showCadProduto, setShowCadProduto] = useState(false);
  const [cadProduto, setCadProduto] = useState({ codigo: '', nome: '', medidas: '', descricao: '', valor: 0, ncm: '' });

  // Histórico de orçamentos do cliente
  const [showClienteHistory, setShowClienteHistory] = useState(false);

  const [clientes, setClientes] = useState(store.getClientes());
  const [revendas, setRevendas] = useState(store.getFornecedores());
  const [produtos, setProdutos] = useState(store.getProdutos());

  const { usuarios: dbUsuarios } = useUsuarios();
  const loggedUserId = localStorage.getItem('rp_logged_user');
  const currentUser = dbUsuarios.find(u => u.id === loggedUserId);

  const fullAccessRoles = ['master', 'SEO', 'admin', 'Admin', 'Administrador', 'administrador', 'adm/dono'];
  const isFullAccess = currentUser ? fullAccessRoles.includes(currentUser.nivel) : false;

  // Re-read from store when data syncs from other users
  useEffect(() => {
    const reload = () => {
      setClientes(store.getClientes());
      setRevendas(store.getFornecedores());
      setProdutos(store.getProdutos());
    };
    window.addEventListener('rp-data-synced', reload);
    window.addEventListener('rp-store-save', reload);
    return () => {
      window.removeEventListener('rp-data-synced', reload);
      window.removeEventListener('rp-store-save', reload);
    };
  }, []);
  const costData = useCustos();
  const { tubos, eixos, conjuntos, revestimentos, encaixes } = costData;

  const listaAtiva = categoriaOrc === 'revenda' ? revendas : clientes;
  const clienteSelecionado = listaAtiva.find(c => c.id === clienteId);
  const labelContato = categoriaOrc === 'revenda' ? 'Vendedor' : 'Comprador';
  const labelContatos = categoriaOrc === 'revenda' ? 'Vendedores' : 'Compradores';

  const filteredClientes = listaAtiva.filter(c => {
    const s = clienteSearch.toLowerCase();
    if (!s) return true;
    const compradorMatch = (c.compradores || []).some(comp =>
      comp.nome?.toLowerCase().includes(s) || comp.telefone?.includes(clienteSearch) || comp.email?.toLowerCase().includes(s)
    );
    return c.nome.toLowerCase().includes(s) || c.cnpj.includes(clienteSearch) ||
      c.telefone.includes(clienteSearch) || c.email.toLowerCase().includes(s) ||
      c.endereco?.toLowerCase().includes(s) || c.whatsapp?.includes(clienteSearch) || compradorMatch;
  });

  // Orçamentos do cliente selecionado (ordenados por data, mais recente primeiro)
  const clienteOrcamentos = clienteId
    ? orcamentos.filter(o => o.clienteId === clienteId).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    : [];

  const filteredProdutos = produtos.filter(p =>
    p.tipo === 'GENERICO' && (
      p.nome.toLowerCase().includes(produtoSearch.toLowerCase()) ||
      p.codigo.toLowerCase().includes(produtoSearch.toLowerCase())
    )
  );

  const diametrosTubo = [...new Set(tubos.map(t => t.diametro))].sort((a, b) => a - b);
  const paredesTubo = (diam: number) => [...new Set(tubos.filter(t => t.diametro === diam).map(t => t.parede))].sort((a, b) => a - b);
  const diametrosEixo = eixos.map(e => e.diametro);

  useEffect(() => {
    const load = () => setOrcamentos(store.getOrcamentos());
    load();
    window.addEventListener('rp-data-synced', load);
    return () => window.removeEventListener('rp-data-synced', load);
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchList(q);
  }, [searchParams]);

  // Restore draft from session on mount
  useEffect(() => {
    try {
      const draft = localStorage.getItem('orc_draft');
      if (draft) {
        const d = JSON.parse(draft);
        if (d.clienteId || d.itensRolete?.length || d.itensProduto?.length) {
          setClienteId(d.clienteId || '');
          setClienteSearch(d.clienteSearch || '');
          setTipoFrete(d.tipoFrete || 'FOB');
          setCondicaoPagamento(d.condicaoPagamento || '');
          setVendedor(d.vendedor || '');
          setDataOrcamento(d.dataOrcamento || new Date().toLocaleDateString('pt-BR'));
          setPrevisaoEntrega(d.previsaoEntrega || '');
          setObservacao(d.observacao || '');
          setCompradorSelecionado(d.compradorSelecionado || '');
          setItensRolete(d.itensRolete || []);
          setItensProduto(d.itensProduto || []);
          setPrazoPagamento(d.prazoPagamento || '');
          setEmpresaEmitente(d.empresaEmitente || 'rollerport');
          if (d.editingOrc) setEditingOrc(d.editingOrc);
          setView('form');
        }
      }
    } catch {}
  }, []);

  // Autosave draft to localStorage on every change when in form view
  useEffect(() => {
    if (view === 'form') {
      const draft = { clienteId, clienteSearch, tipoFrete, condicaoPagamento, vendedor, dataOrcamento, previsaoEntrega, observacao, compradorSelecionado, itensRolete, itensProduto, prazoPagamento, empresaEmitente, editingOrc };
      localStorage.setItem('orc_draft', JSON.stringify(draft));
    }
  }, [view, clienteId, clienteSearch, tipoFrete, condicaoPagamento, vendedor, dataOrcamento, previsaoEntrega, observacao, compradorSelecionado, itensRolete, itensProduto, prazoPagamento, empresaEmitente, editingOrc]);

  // Autosave as draft every 10 seconds when in form view
  const autosaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (view === 'form') {
      autosaveTimer.current = setInterval(() => {
        if (!clienteId && itensRolete.length === 0 && itensProduto.length === 0) return;
        const orc: Orcamento = {
          id: editingOrc?.id || store.nextId('orc'),
          numero: editingOrc?.numero || store.nextNumero('orc'),
          clienteId,
          clienteNome: listaAtiva.find(c => c.id === clienteId)?.nome || 'Sem cliente',
          compradorNome: compradorSelecionado,
          empresaEmitente,
          tipoFrete, condicaoPagamento, vendedor, dataOrcamento, prazoPagamento,
          previsaoEntrega, observacao,
          dataEntrega: previsaoEntrega,
          itensRolete, itensProduto,
          status: editingOrc?.status || 'RASCUNHO',
          valorTotal: +(itensRolete.reduce((s, i) => s + i.valorTotal, 0) + itensProduto.reduce((s, i) => s + i.valorTotal, 0)).toFixed(2),
          createdAt: editingOrc?.createdAt || new Date().toISOString().split('T')[0],
        };
        let updated: Orcamento[];
        if (editingOrc) {
          updated = orcamentos.map(o => o.id === editingOrc.id ? orc : o);
        } else {
          updated = [...orcamentos, orc];
          setEditingOrc(orc);
        }
        store.saveOrcamentos(updated);
        setOrcamentos(updated);
      }, 10000);
    }
    return () => { if (autosaveTimer.current) clearInterval(autosaveTimer.current); };
  }, [view, clienteId, tipoFrete, condicaoPagamento, vendedor, previsaoEntrega, observacao, itensRolete, itensProduto, compradorSelecionado, empresaEmitente]);

  const resetForm = () => {
    setClienteId(''); setClienteSearch(''); setTipoFrete('FOB');
    setCondicaoPagamento(''); setVendedor('');
    setDataOrcamento(new Date().toLocaleDateString('pt-BR'));
    setPrevisaoEntrega(''); setObservacao(''); setCompradorSelecionado('');
    setItensRolete([]); setItensProduto([]);
    setEditingOrc(null); setShowProdutoSearch(false);
    setShowRoleteForm(false); setSelectedProduto(null);
    setEmpresaEmitente('rollerport');
    localStorage.removeItem('orc_draft');
  };

  const openNew = () => { resetForm(); setView('form'); };

  const openEdit = (orc: Orcamento) => {
    setEditingOrc(orc);
    setClienteId(orc.clienteId); setClienteSearch(orc.clienteNome);
    setTipoFrete(orc.tipoFrete || 'FOB');
    setCondicaoPagamento(orc.condicaoPagamento || '');
    setVendedor(orc.vendedor || '');
    setDataOrcamento(orc.dataOrcamento || orc.createdAt);
    setPrevisaoEntrega(orc.previsaoEntrega || orc.dataEntrega);
    setObservacao(orc.observacao || '');
    setItensRolete(orc.itensRolete || []);
    setItensProduto(orc.itensProduto || []);
    setPrazoPagamento((orc as any).prazoPagamento || '');
    setEmpresaEmitente(orc.empresaEmitente || 'rollerport');
    setView('form');
  };

  // Clonar orçamento com preços atualizados
  const cloneOrcamento = (orc: Orcamento) => {
    // Recalcular itens rolete com preços atuais
    const itensRoleteAtualizados = (orc.itensRolete || []).map(item => {
      const recalculado = calcItem(item, tubos, eixos, conjuntos, revestimentos, encaixes);
      return { ...recalculado, id: store.nextId('item') };
    });

    // Atualizar itens produto com preços atuais do cadastro
    const itensProdutoAtualizados = (orc.itensProduto || []).map(item => {
      const produtoAtual = produtos.find(p => p.id === item.produtoId);
      const valorAtual = produtoAtual?.valor || item.valorUnitario;
      return {
        ...item,
        id: store.nextId('item'),
        valorUnitario: valorAtual,
        valorTotal: +(valorAtual * item.quantidade).toFixed(2),
      };
    });

    // Preencher formulário com dados clonados
    setClienteId(orc.clienteId);
    setClienteSearch(orc.clienteNome);
    setTipoFrete(orc.tipoFrete || 'FOB');
    setCondicaoPagamento(orc.condicaoPagamento || '');
    setVendedor(orc.vendedor || '');
    setDataOrcamento(new Date().toLocaleDateString('pt-BR'));
    setPrevisaoEntrega(orc.previsaoEntrega || '');
    setObservacao(orc.observacao || '');
    setCompradorSelecionado(orc.compradorNome || '');
    setItensRolete(itensRoleteAtualizados);
    setItensProduto(itensProdutoAtualizados);
    setPrazoPagamento((orc as any).prazoPagamento || '');
    setEmpresaEmitente(orc.empresaEmitente || 'rollerport');
    setEditingOrc(null); // Não é edição, é novo
    setShowClienteHistory(false);
    
    toast.success(`Orçamento ${orc.numero} clonado com preços atualizados!`);
  };

  const totalRoletes = itensRolete.reduce((s, i) => s + i.valorTotal, 0);
  const totalProdutos = itensProduto.reduce((s, i) => s + i.valorTotal, 0);
  const totalGeral = totalRoletes + totalProdutos;
  const totalItens = itensRolete.length + itensProduto.length;

  const handleSave = () => {
    const orc: Orcamento = {
      id: editingOrc?.id || store.nextId('orc'),
      numero: editingOrc?.numero || store.nextNumero('orc'),
      clienteId,
      clienteNome: clienteSelecionado?.nome || 'Sem cliente',
      empresaEmitente,
      tipoFrete, condicaoPagamento, vendedor, dataOrcamento, prazoPagamento,
      previsaoEntrega, observacao,
      dataEntrega: previsaoEntrega,
      itensRolete, itensProduto,
      status: editingOrc?.status || 'RASCUNHO',
      valorTotal: +totalGeral.toFixed(2),
      createdAt: editingOrc?.createdAt || new Date().toISOString().split('T')[0],
    };
    let updated: Orcamento[];
    if (editingOrc) {
      updated = orcamentos.map(o => o.id === editingOrc.id ? orc : o);
    } else {
      updated = [...orcamentos, orc];
    }
    store.saveOrcamentos(updated);
    setOrcamentos(updated);
    setView('list');
    resetForm();
    toast.success(`Orçamento ${orc.numero} salvo!`);
  };

  const deleteOrcamento = (id: string) => {
    const updated = orcamentos.filter(o => o.id !== id);
    store.saveOrcamentos(updated); setOrcamentos(updated);
    toast.success('Orçamento removido!');
  };

  const convertToPedido = (orc: Orcamento) => {
    const pedidos = store.getPedidos();
    const pedido = {
      id: store.nextId('ped'),
      numero: store.nextNumero('ped'),
      orcamentoId: orc.id,
      clienteNome: orc.clienteNome,
      dataEntrega: orc.previsaoEntrega || orc.dataEntrega,
      status: 'PENDENTE' as const,
      valorTotal: orc.valorTotal,
      createdAt: new Date().toISOString().split('T')[0],
    };
    store.savePedidos([...pedidos, pedido]);
    const updated = orcamentos.map(o => o.id === orc.id ? { ...o, status: 'APROVADO' as const } : o);
    store.saveOrcamentos(updated); setOrcamentos(updated);
    toast.success(`Pedido ${pedido.numero} criado!`);
  };

  // Insert produto into orçamento
  const insertProduto = () => {
    if (!selectedProduto) return;
    const valorComDesc = selectedProduto.valor * (1 - produtoDesconto / 100);
    const item: ItemProdutoOrcamento = {
      id: store.nextId('item'),
      produtoId: selectedProduto.id,
      produtoNome: selectedProduto.nome,
      quantidade: produtoQtd,
      valorUnitario: +valorComDesc.toFixed(2),
      valorTotal: +(valorComDesc * produtoQtd).toFixed(2),
      ncm: produtoNcm,
      medidas: (selectedProduto as any).medidas || '',
      descricao: selectedProduto.descricao || '',
      aliqPIS: produtoAliqPIS,
      aliqCOFINS: produtoAliqCOFINS,
      aliqICMS: produtoAliqICMS,
      aliqIPI: produtoAliqIPI,
      valorPIS: +((valorComDesc * produtoQtd) * (produtoAliqPIS / 100)).toFixed(2),
      valorCOFINS: +((valorComDesc * produtoQtd) * (produtoAliqCOFINS / 100)).toFixed(2),
      valorICMS: +((valorComDesc * produtoQtd) * (produtoAliqICMS / 100)).toFixed(2),
      valorIPI: +((valorComDesc * produtoQtd) * (produtoAliqIPI / 100)).toFixed(2),
    };
    setItensProduto([...itensProduto, item]);
    setShowProdutoSearch(false);
    setSelectedProduto(null);
    setProdutoSearch('');
    setProdutoQtd(1);
    setProdutoDesconto(0);
    setProdutoNcm('');
    setProdutoAliqPIS(0);
    setProdutoAliqCOFINS(0);
    setProdutoAliqICMS(0);
    setProdutoAliqIPI(0);
  };

  // Insert rolete into orçamento
  const insertRolete = () => {
    const calculated = calcItem({ ...roleteItem, id: store.nextId('item'), codigoProduto: codigoRolete }, tubos, eixos, conjuntos, revestimentos, encaixes);
    setItensRolete([...itensRolete, calculated]);
    // Salvar rolete como produto na lista de produtos
    const novoProduto: Produto = {
      id: store.nextId('prod'),
      codigo: codigoRolete || `${calculated.tipoRolete}-${calculated.diametroTubo}`,
      nome: `Rolete ${calculated.tipoRolete} ø${calculated.diametroTubo}x${calculated.paredeTubo} T:${calculated.comprimentoTubo}mm E:ø${calculated.diametroEixo} ${calculated.comprimentoEixo}mm`,
      tipo: calculated.tipoRolete,
      medidas: `Tubo ø${calculated.diametroTubo}x${calculated.paredeTubo} Comp.${calculated.comprimentoTubo}mm | Eixo ø${calculated.diametroEixo} Comp.${calculated.comprimentoEixo}mm`,
      descricao: `${calculated.tipoEncaixe ? `Enc: ${calculated.tipoEncaixe} ${calculated.medidaFresado || ''}` : ''} ${calculated.especificacaoRevestimento ? `Rev: ${calculated.especificacaoRevestimento}` : ''}`.trim(),
      valor: calculated.valorPorPeca,
      createdAt: new Date().toISOString().split('T')[0],
    };
    const existingProds = store.getProdutos();
    // Se já existir com mesmo código, atualizar
    const existingIdx = existingProds.findIndex(p => p.codigo === novoProduto.codigo);
    if (existingIdx !== -1) {
      const updatedProds = [...existingProds];
      updatedProds[existingIdx] = { ...existingProds[existingIdx], ...novoProduto, id: existingProds[existingIdx].id };
      store.saveProdutos(updatedProds);
    } else {
      store.saveProdutos([...existingProds, novoProduto]);
    }
    setShowRoleteForm(false);
    setRoleteItem(emptyItem());
    setCodigoRolete('');
  };

  const updateRoleteField = (partial: Partial<ItemOrcamento>) => {
    setRoleteItem(prev => calcItem({ ...prev, ...partial }, tubos, eixos, conjuntos, revestimentos, encaixes));
  };

  // Cadastrar cliente rápido
  const salvarCliente = () => {
    const id = store.nextId(categoriaOrc === 'revenda' ? 'rev' : 'cli');
    const novo: Cliente = {
      ...cadCliente, id, contato: cadCliente.compradores?.[0]?.nome || cadCliente.nome,
      compradores: cadCliente.compradores || [],
      createdAt: new Date().toISOString().split('T')[0],
    };
    if (categoriaOrc === 'revenda') {
      const all = [...revendas, novo];
      store.saveFornecedores(all);
      setRevendas(all);
    } else {
      const all = [...clientes, novo];
      store.saveClientes(all);
    }
    setClienteId(id); setClienteSearch(cadCliente.nome);
    setShowCadCliente(false);
    setCadCliente({
      nome: '', cnpj: '', email: '', telefone: '', whatsapp: '', endereco: '', cidade: '', estado: '', contato: '',
      compradores: [{ nome: '', telefone: '', email: '', whatsapp: '', aniversario: '', redesSociais: '' }],
      aniversarioEmpresa: '', redesSociais: '',
    });
    toast.success(`${categoriaOrc === 'revenda' ? 'Revenda' : 'Cliente'} cadastrado!`);
  };

  // Cadastrar comprador/vendedor rápido
  const salvarComprador = () => {
    if (!clienteSelecionado) return;
    if (categoriaOrc === 'revenda') {
      const updated = revendas.map(c =>
        c.id === clienteId
          ? { ...c, compradores: [...c.compradores, cadComprador] }
          : c
      );
      store.saveFornecedores(updated);
      setRevendas(updated);
    } else {
      const updated = clientes.map(c =>
        c.id === clienteId
          ? { ...c, compradores: [...c.compradores, cadComprador] }
          : c
      );
      store.saveClientes(updated);
    }
    setShowCadComprador(false);
    setCadComprador({ nome: '', telefone: '', email: '', whatsapp: '', aniversario: '', redesSociais: '' });
    toast.success(`${categoriaOrc === 'revenda' ? 'Vendedor' : 'Comprador'} cadastrado!`);
  };

  // Cadastrar produto rápido
  const salvarProduto = () => {
    // Check for duplicate code
    if (cadProduto.codigo && produtos.some(p => p.codigo === cadProduto.codigo)) {
      toast.error(`O código "${cadProduto.codigo}" já está em uso.`);
      return;
    }

    const id = store.nextId('prod');
    const novo: Produto = {
      id, ...cadProduto, tipo: 'GENERICO',
      ncm: cadProduto.ncm,
      createdAt: new Date().toISOString().split('T')[0],
    } as any;
    store.saveProdutos([...produtos, novo]);
    setShowCadProduto(false);
    setCadProduto({ codigo: '', nome: '', medidas: '', descricao: '', valor: 0, ncm: '' });
    toast.success('Produto cadastrado!');
  };

  const handleSendEmail = (orc: Orcamento) => {
    const emp = EMPRESAS[orc.empresaEmitente || 'rollerport'];
    const subject = encodeURIComponent(`Orçamento ${emp.nome} - Nº ${orc.numero}`);
    const body = encodeURIComponent(`Olá,\n\nSegue os dados principais do Orçamento Nº ${orc.numero}:\n\nCliente: ${orc.clienteNome}\nValor Total: R$ ${orc.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n\nAtenciosamente,\n${emp.nome}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const nameMatch = (vendedorField: string, userName: string) => {
    const a = (vendedorField || '').trim().toLowerCase();
    const b = (userName || '').trim().toLowerCase();
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a) || a.split(' ')[0] === b.split(' ')[0];
  };

  const filteredOrcamentos = orcamentos
    .filter(o => {
      if (isFullAccess) return true;
      return nameMatch(o.vendedor, currentUser?.nome || '');
    })
    .filter(o =>
      o.clienteNome.toLowerCase().includes(searchList.toLowerCase()) ||
      o.numero.includes(searchList)
    );

  // ========== PRINT VIEW ==========
  if (view === 'print' && viewOrc) {
    const cli = clientes.find(c => c.id === viewOrc.clienteId);
    const empPrint = EMPRESAS[viewOrc.empresaEmitente || 'rollerport'];
    const isSimplesNacional = empPrint.regimeTributario === 'simples_nacional';

    // Brazilian tax rates 2026 - Rollerport is in SP
    const destinoUF = cli?.estado || 'SP';
    const origemUF = 'SP';
    // ICMS interestadual from SP
    const icmsInterMap: Record<string, number> = {
      'SP': 0.18, 'MG': 0.12, 'RJ': 0.12, 'PR': 0.12, 'SC': 0.12, 'RS': 0.12, 'ES': 0.12,
      'BA': 0.07, 'SE': 0.07, 'AL': 0.07, 'PE': 0.07, 'PB': 0.07, 'RN': 0.07, 'CE': 0.07,
      'PI': 0.07, 'MA': 0.07, 'PA': 0.07, 'AP': 0.07, 'AM': 0.07, 'RR': 0.07, 'AC': 0.07,
      'RO': 0.07, 'TO': 0.07, 'MT': 0.07, 'MS': 0.07, 'GO': 0.07, 'DF': 0.07,
    };
    const icmsInternoMap: Record<string, number> = {
      'SP': 0.18, 'MG': 0.18, 'RJ': 0.20, 'PR': 0.195, 'SC': 0.17, 'RS': 0.17, 'ES': 0.17,
      'BA': 0.205, 'SE': 0.18, 'AL': 0.19, 'PE': 0.205, 'PB': 0.20, 'RN': 0.20, 'CE': 0.20,
      'PI': 0.215, 'MA': 0.22, 'PA': 0.19, 'AP': 0.18, 'AM': 0.20, 'RR': 0.20, 'AC': 0.19,
      'RO': 0.195, 'TO': 0.20, 'MT': 0.17, 'MS': 0.17, 'GO': 0.19, 'DF': 0.20,
    };
    const taxaICMSOrig = isSimplesNacional ? 0 : (icmsInterMap[destinoUF] || 0.12);
    const taxaICMSDest = isSimplesNacional ? 0 : (origemUF === destinoUF ? 0 : Math.max(0, (icmsInternoMap[destinoUF] || 0.18) - taxaICMSOrig));
    const taxaPIS = isSimplesNacional ? 0 : 0.0165;
    const taxaCOFINS = isSimplesNacional ? 0 : 0.076;
    const taxaIPI = isSimplesNacional ? 0 : 0.05;

    // Build all items for the table
    const allPrintItems: Array<{
      item: number; qtd: number; codigo: string; codExterno: string; descricao: string;
      valorLiquidoUnit: number;
      aliqPIS: number; valorPIS: number;
      aliqCOFINS: number; valorCOFINS: number;
      aliqICMS: number; valorICMS: number;
      aliqIPI: number; valorIPI: number;
      valorTotalComImpostos: number;
    }> = [];

    let idx = 1;
    (viewOrc.itensProduto || []).forEach((ip) => {
      const prod = produtos.find(p => p.id === ip.produtoId);
      const vliq = ip.valorUnitario;
      const aliqPIS = ip.aliqPIS !== undefined ? ip.aliqPIS : (taxaPIS * 100);
      const aliqCOFINS = ip.aliqCOFINS !== undefined ? ip.aliqCOFINS : (taxaCOFINS * 100);
      const aliqICMS = ip.aliqICMS !== undefined ? ip.aliqICMS : (taxaICMSOrig * 100);
      
      const aliqIPI = ip.aliqIPI !== undefined ? ip.aliqIPI : 0;
      
      const valorPISTotal = ip.valorPIS !== undefined ? ip.valorPIS : +((ip.valorUnitario * ip.quantidade) * (aliqPIS / 100)).toFixed(2);
      const valorCOFINSTotal = ip.valorCOFINS !== undefined ? ip.valorCOFINS : +((ip.valorUnitario * ip.quantidade) * (aliqCOFINS / 100)).toFixed(2);
      const valorICMSTotal = ip.valorICMS !== undefined ? ip.valorICMS : +((ip.valorUnitario * ip.quantidade) * (aliqICMS / 100)).toFixed(2);
      const valorIPITotal = ip.valorIPI !== undefined ? ip.valorIPI : +((ip.valorUnitario * ip.quantidade) * (aliqIPI / 100)).toFixed(2);

      const impostosTotaisItem = valorPISTotal + valorCOFINSTotal + valorICMSTotal;
      const valorLiquidoTotal = (ip.valorUnitario * ip.quantidade) - impostosTotaisItem;
      const valorLiquidoUnit = valorLiquidoTotal / ip.quantidade;

      let desc = ip.produtoNome;
      if (ip.ncm || (prod as any)?.ncm) {
        desc += ` (NCM: ${ip.ncm || (prod as any)?.ncm})`;
      }

      allPrintItems.push({
        item: idx++, qtd: ip.quantidade, codigo: prod?.codigo || '-',
        codExterno: (prod as any)?.codigoCliente || '-', descricao: desc,
        valorLiquidoUnit,
        aliqPIS, valorPIS: valorPISTotal,
        aliqCOFINS, valorCOFINS: valorCOFINSTotal,
        aliqICMS, valorICMS: valorICMSTotal,
        aliqIPI, valorIPI: valorIPITotal,
        valorTotalComImpostos: ip.valorTotal + valorIPITotal,
      });
    });
    (viewOrc.itensRolete || []).forEach((ir) => {
      const aliqPIS = ir.aliqPIS !== undefined ? ir.aliqPIS : (taxaPIS * 100);
      const aliqCOFINS = ir.aliqCOFINS !== undefined ? ir.aliqCOFINS : (taxaCOFINS * 100);
      const aliqICMS = ir.aliqICMS !== undefined ? ir.aliqICMS : (taxaICMSOrig * 100);
      
      const aliqIPI = ir.aliqIPI !== undefined ? ir.aliqIPI : 0;
      
      const valorPISTotal = ir.valorPIS !== undefined ? ir.valorPIS : +((ir.valorPorPeca * ir.quantidade) * (aliqPIS / 100)).toFixed(2);
      const valorCOFINSTotal = ir.valorCOFINS !== undefined ? ir.valorCOFINS : +((ir.valorPorPeca * ir.quantidade) * (aliqCOFINS / 100)).toFixed(2);
      const valorICMSTotal = ir.valorICMS !== undefined ? ir.valorICMS : +((ir.valorPorPeca * ir.quantidade) * (aliqICMS / 100)).toFixed(2);
      const valorIPITotal = ir.valorIPI !== undefined ? ir.valorIPI : +((ir.valorPorPeca * ir.quantidade) * (aliqIPI / 100)).toFixed(2);

      const impostosTotaisItem = valorPISTotal + valorCOFINSTotal + valorICMSTotal;
      const valorLiquidoTotal = (ir.valorPorPeca * ir.quantidade) - impostosTotaisItem;
      const valorLiquidoUnit = valorLiquidoTotal / ir.quantidade;

      let desc = `Rolete ${ir.tipoRolete} - Tubo ø${ir.diametroTubo} Comp.${ir.comprimentoTubo}mm - Eixo ø${ir.diametroEixo} Comp.${ir.comprimentoEixo}mm${ir.tipoEncaixe ? ` - Enc: ${ir.tipoEncaixe}` : ''}${ir.medidaFresado ? ` ${ir.medidaFresado}` : ''}${ir.especificacaoRevestimento ? ` - Rev: ${ir.especificacaoRevestimento}` : ''}`;
      if (ir.ncm) desc += `\n(NCM: ${ir.ncm})`;

      allPrintItems.push({
        item: idx++, qtd: ir.quantidade, codigo: ir.codigoProduto || ir.tipoRolete,
        codExterno: ir.codigoExterno || '-', descricao: desc,
        valorLiquidoUnit,
        aliqPIS, valorPIS: valorPISTotal,
        aliqCOFINS, valorCOFINS: valorCOFINSTotal,
        aliqICMS, valorICMS: valorICMSTotal,
        aliqIPI, valorIPI: valorIPITotal,
        valorTotalComImpostos: ir.valorTotal + valorIPITotal,
      });
    });

    const totals = allPrintItems.reduce((acc, i) => ({
      valorTotalSemImpostos: acc.valorTotalSemImpostos + (i.valorLiquidoUnit * i.qtd),
      valorPIS: acc.valorPIS + i.valorPIS,
      valorCOFINS: acc.valorCOFINS + i.valorCOFINS,
      valorICMS: acc.valorICMS + i.valorICMS,
      valorIPI: acc.valorIPI + i.valorIPI,
      valorTotalComImpostos: acc.valorTotalComImpostos + i.valorTotalComImpostos,
    }), { valorTotalSemImpostos: 0, valorPIS: 0, valorCOFINS: 0, valorICMS: 0, valorIPI: 0, valorTotalComImpostos: 0 });

    // Find vendedor info
    const usuarios = store.getUsuarios();
    const cleanOrcVendedor = (viewOrc.vendedor || '').trim().toLowerCase();
    const vendedorUser = usuarios.find(u => (u.nome || '').trim().toLowerCase() === cleanOrcVendedor || (u.login || '').trim().toLowerCase() === cleanOrcVendedor);

    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden">
          <Button variant="outline" onClick={() => setView('list')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <FileText className="h-4 w-4" /> Gerar PDF
          </Button>
          <Button 
            variant={showTecnico ? "default" : "outline"} 
            onClick={() => setShowTecnico(!showTecnico)} 
            className="gap-2"
          >
            <SettingsIcon className="h-4 w-4" /> Orçamento Técnico
          </Button>
          <Button variant="outline" onClick={() => handleSendEmail(viewOrc)} className="gap-2">
            <Mail className="h-4 w-4" /> Enviar por E-mail
          </Button>
        </div>

        <div className="bg-white text-black border rounded-lg p-3 mx-auto print:border-0 print:shadow-none print:p-2" style={{ maxWidth: '1200px' }}>
          {/* ===== HEADER: Logo+Empresa left, QR+Cliente right ===== */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <img src={logo} alt={empPrint.nome} className="h-16 object-contain" />
              <div>
                <h2 className="text-base font-bold leading-tight">{empPrint.nome}</h2>
                <p className="text-[10px] font-semibold">{empPrint.subtitulo}</p>
                <p className="text-[10px]">{empPrint.endereco}</p>
                <p className="text-[10px]">{empPrint.cidadeEstado}</p>
                <p className="text-[10px]">CNPJ: {empPrint.cnpj}</p>
                <p className="text-[10px]">Tel: {empPrint.telefone} • {empPrint.email}</p>
              </div>
              <div className="flex flex-col items-center ml-2">
                <img src={qrcode} alt={`QR Code ${empPrint.nome}`} className="h-14 w-14 object-contain" />
                <p className="text-[7px] text-gray-500 mt-0.5 text-center leading-tight">Aponte a câmera<br/>para nossas redes</p>
              </div>
            </div>
            {cli && (
              <div className="text-right text-xs">
                <p className="font-bold text-sm">{cli.nome}</p>
                <p>CNPJ: {cli.cnpj}</p>
                <p>{cli.endereco}</p>
                <p>{cli.cidade}/{cli.estado}</p>
                <p>Tel: {cli.telefone}</p>
                {cli.email && <p>{cli.email}</p>}
                {viewOrc.compradorNome && <p>Comprador: {viewOrc.compradorNome}</p>}
              </div>
            )}
          </div>

          <div className="h-2" />

          {/* ===== Orçamento info line ===== */}
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs border-y py-2 bg-gray-50/50">
            <span>Orçamento Nº: <strong>{viewOrc.numero}</strong></span>
            <span>Data: <strong>{viewOrc.dataOrcamento}</strong></span>
            <span>
              {vendedorUser?.genero === 'F' ? 'Vendedora' : 'Vendedor'}: <strong>{vendedorUser ? vendedorUser.nome : viewOrc.vendedor || '-'}</strong>
            </span>
            {vendedorUser?.telefone && <span>Tel: <strong>{vendedorUser.telefone}</strong></span>}
            {vendedorUser?.whatsapp && <span>WhatsApp: <strong>{vendedorUser.whatsapp}</strong></span>}
            {vendedorUser?.email && <span>E-mail: <strong>{vendedorUser.email}</strong></span>}
            <span>Frete: <strong>{viewOrc.tipoFrete === 'CIF' ? 'CIF (vendedor)' : 'FOB (comprador)'}</strong></span>
            <span>Pagamento: <strong>{viewOrc.condicaoPagamento || '-'}</strong></span>
            <span>Entrega: <strong>{viewOrc.previsaoEntrega ? `${viewOrc.previsaoEntrega} Dias Úteis` : '-'}</strong></span>
            <span>Validade: <strong>5 dias úteis</strong></span>
          </div>

          <div className="h-2" />

          {/* ===== TABLE ===== */}
          <table className="w-full text-[8px] border-collapse table-fixed">
            <thead>
              <tr className="bg-gray-100 uppercase text-[7px] font-bold">
                <th className="border p-1 text-center whitespace-nowrap w-[28px]" rowSpan={2}>ITEM</th>
                <th className="border p-1 text-center whitespace-nowrap w-[44px]" rowSpan={2}>CÓD.</th>
                <th className="border p-1 text-center whitespace-nowrap w-[40px]" rowSpan={2}>CÓD. CLI.</th>
                <th className="border p-1 text-left w-[31%]" rowSpan={2}>DESCRIÇÃO</th>
                <th className="border p-1 text-center whitespace-nowrap w-[25px]" rowSpan={2}>QTD</th>
                <th className="border p-1 text-right whitespace-nowrap w-[55px]" rowSpan={2}>VLR UNIT.<br/>(SEM IMP)</th>
                <th className="border p-1 text-right whitespace-nowrap w-[55px]" rowSpan={2}>VLR TOTAL<br/>(SEM IMP)</th>
                <th className="border p-1 text-center whitespace-nowrap" colSpan={2}>PIS</th>
                <th className="border p-1 text-center whitespace-nowrap" colSpan={2}>COFINS</th>
                <th className="border p-1 text-center whitespace-nowrap" colSpan={2}>ICMS</th>
                <th className="border p-1 text-center whitespace-nowrap w-[40px]" rowSpan={2}>IPI</th>
                <th className="border p-1 text-right whitespace-nowrap w-[80px] bg-green-200" rowSpan={2}>VLR TOTAL<br/>COM IMPOS.</th>
              </tr>
              <tr className="bg-gray-100 text-[6px] uppercase font-bold">
                <th className="border p-1 text-center whitespace-nowrap w-[13px]">ALÍQ.</th>
                <th className="border p-1 text-center whitespace-nowrap w-[42px]">VALOR</th>
                <th className="border p-1 text-center whitespace-nowrap w-[13px]">ALÍQ.</th>
                <th className="border p-1 text-center whitespace-nowrap w-[42px]">VALOR</th>
                <th className="border p-1 text-center whitespace-nowrap w-[13px]">ALÍQ.</th>
                <th className="border p-1 text-center whitespace-nowrap w-[42px]">VALOR</th>
              </tr>
            </thead>
            <tbody>
              {allPrintItems.map((row) => (
                <tr key={row.item}>
                  <td className="border p-1 text-center whitespace-nowrap">{String(row.item).padStart(2, '0')}</td>
                  <td className="border p-1 text-center whitespace-nowrap truncate" title={row.codigo}>{row.codigo}</td>
                  <td className="border p-1 text-center whitespace-nowrap truncate" title={row.codExterno}>{row.codExterno || '-'}</td>
                  <td className="border p-1 text-left break-words whitespace-pre-wrap">{row.descricao}</td>
                  <td className="border p-1 text-center whitespace-nowrap font-bold">{row.qtd}</td>
                  <td className="border p-1 text-right whitespace-nowrap">{fmt(row.valorLiquidoUnit)}</td>
                  <td className="border p-1 text-right whitespace-nowrap">{fmt(row.valorLiquidoUnit * row.qtd)}</td>
                  
                  <td className="border p-1 text-center whitespace-nowrap bg-blue-50/50">{row.aliqPIS.toFixed(2)}%</td>
                  <td className="border p-1 text-right whitespace-nowrap bg-blue-50/50 font-medium">{fmt(row.valorPIS)}</td>
                  
                  <td className="border p-1 text-center whitespace-nowrap">{row.aliqCOFINS.toFixed(2)}%</td>
                  <td className="border p-1 text-right whitespace-nowrap font-medium">{fmt(row.valorCOFINS)}</td>
                  
                  <td className="border p-1 text-center whitespace-nowrap bg-blue-50/50">{row.aliqICMS.toFixed(2)}%</td>
                  <td className="border p-1 text-right whitespace-nowrap bg-blue-50/50 font-medium">{fmt(row.valorICMS)}</td>
                  
                  <td className="border p-1 text-right whitespace-nowrap font-medium">{fmt(row.valorIPI)}</td>
                  <td className="border p-1 text-right whitespace-nowrap font-bold bg-green-100">{fmt(row.valorTotalComImpostos)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold uppercase">
                <td className="border p-1 text-center" colSpan={4}>TOTAL</td>
                <td className="border p-1 text-center">{allPrintItems.reduce((s, r) => s + r.qtd, 0)}</td>
                <td className="border p-1"></td>
                <td className="border p-1 text-right">{fmt(totals.valorTotalSemImpostos)}</td>
                <td className="border p-1"></td>
                <td className="border p-1 text-right">{fmt(totals.valorPIS)}</td>
                <td className="border p-1"></td>
                <td className="border p-1 text-right">{fmt(totals.valorCOFINS)}</td>
                <td className="border p-1"></td>
                <td className="border p-1 text-right">{fmt(totals.valorICMS)}</td>
                <td className="border p-1 text-right">{fmt(totals.valorIPI)}</td>
                <td className="border p-1 text-right bg-green-200">{fmt(totals.valorTotalComImpostos)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="text-[7px] text-muted-foreground mt-1 italic font-medium">
            * Valores de impostos destacados apenas para fins informativos, já inclusos no preço final conforme legislação vigente.
          </p>

          {/* PIX / Transferência data on print */}
          {(viewOrc.condicaoPagamento === 'PIX' || viewOrc.condicaoPagamento === 'Transferência Bancária') && (
            <div className="mt-3 border rounded p-3 text-[10px]">
              <p className="font-bold mb-1">Dados Bancários para {viewOrc.condicaoPagamento === 'PIX' ? 'PIX' : 'Transferência Bancária'}:</p>
              <p>{empPrint.banco}</p>
              <p>{empPrint.razaoSocial}</p>
              <p>CNPJ: {empPrint.cnpjBanco}</p>
              <p>Agência: {empPrint.agencia} | Conta Corrente: {empPrint.contaCorrente}</p>
              {viewOrc.condicaoPagamento === 'PIX' && <p className="font-semibold mt-1">Chave PIX (CNPJ): {empPrint.chavePix}</p>}
            </div>
          )}

          {/* Boleto conditions */}
          {viewOrc.condicaoPagamento?.toLowerCase().includes('boleto') && (viewOrc as any).prazoPagamento && (
            <div className="mt-3 border rounded p-3 text-[10px]">
              <p className="font-bold mb-1">Condições do Boleto:</p>
              <p>Prazo: <strong>{(viewOrc as any).prazoPagamento}</strong></p>
            </div>
          )}

          {/* Cheque conditions */}
          {viewOrc.condicaoPagamento?.toLowerCase().includes('cheque') && (viewOrc as any).prazoPagamento && (
            <div className="mt-3 border rounded p-3 text-[10px]">
              <p className="font-bold mb-1">Condições do Cheque:</p>
              <p>Prazo: <strong>{(viewOrc as any).prazoPagamento}</strong></p>
            </div>
          )}

          {viewOrc.observacao && (
            <div className="text-[10px] mt-2 border rounded p-2 bg-muted/20">Observação do Vendedor: <strong>{viewOrc.observacao}</strong></div>
          )}

          {/* ===== Informações Complementares ===== */}
          <div className="mt-2 border rounded p-2 text-[10px]">
            <h3 className="text-center font-bold text-xs mb-1">INFORMAÇÕES COMPLEMENTARES</h3>
            <ol className="list-decimal list-inside text-[9px] space-y-1.5 font-medium">
              <li>FRETE: Os orçamentos elaborados com a condição FOB devem ser retirados a critério do cliente, que deverá efetuar a coleta ou solicitar a transportadora de sua preferência. A ROLLERPORT pode realizar a cotação e a indicação de algumas transportadoras, ficando a cargo do cliente a aprovação e a contratação (<strong>pagamento</strong>) do frete;</li>
              <li>A ROLLERPORT fará o despache da mercadoria em nossa cidade ou em São Paulo - Capital via transportadora, <span className="font-bold underline">NÃO SERÁ ACEITO</span> o envio de mercadorias pelos <strong>CORREIOS</strong> que ultrapassem as dimensões de <strong>20x20x20 e que pesem mais de 10 kg</strong>;</li>
              <li>A quantidade de peças solicitadas interfere e determina os valores cobrados e repassados na prestação de serviço, no valor da mercadoria (rolete, suporte, eixo e tubo) e nos descontos ofertados em orçamento;</li>
              <li>As opções de pagamento ou de faturamento, assim como os parcelamentos, também interferem nos descontos e valores repassados em orçamento;</li>
              <li><span className="text-red-600 font-bold">OBS: ORÇAMENTO SUJEITO A ALTERAÇÃO MEDIANTE A ANÁLISE DE CRÉDITO NO ATO DO FECHAMENTO DO PEDIDO.</span></li>
            </ol>
            <div className="mt-1 bg-yellow-300 p-2 text-[8.5px] font-bold text-left border border-yellow-500 rounded">
              <p className="underline mb-1 whitespace-nowrap">CONFERIR O ORÇAMENTO ANTES DO FECHAMENTO DO PEDIDO, E ATENÇÃO AS MEDIDAS SOLICITADAS. NO CASO DE PEÇAS DESENHADAS, CONFERIR O DESENHO ENVIADO ANTES DO FECHAMENTO DO PEDIDO.</p>
              <p className="underline whitespace-nowrap">ATENÇÃO: OS VALORES DESTE ORÇAMENTO SÃO VÁLIDOS APENAS PARA A QUANTIDADE TOTAL SOLICITADA. PARA QUANTIDADES MENORES, OS PREÇOS SOFRERÃO ALTERAÇÕES.</p>
            </div>
          </div>

          {/* ===== Seção Técnica (Dinâmica) ===== */}
          {showTecnico && (
            <div className="mt-4 border rounded p-3 text-[10px] break-inside-avoid bg-gray-50/30">
              <div className="flex justify-between items-center mb-3">
                <div className="w-10"></div>
                <h3 className="text-center font-bold text-xs">ESPECIFICAÇÕES TÉCNICAS GERAIS DO ROLO</h3>
                <button 
                  onClick={() => setTecnicoData([...tecnicoData, 'Nova especificação...'])}
                  className="print:hidden text-primary hover:text-primary/80 transition-colors"
                  title="Adicionar linha"
                >
                  <PlusCircle className="h-4 w-4" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 gap-y-1.5">
                {tecnicoData.map((content, idx) => {
                  // Color highlighting logic
                  const colors = [
                    { name: 'vermelh', class: 'text-red-600' },
                    { name: 'azul', class: 'text-blue-600' },
                    { name: 'verd', class: 'text-green-600' },
                    { name: 'amarel', class: 'text-yellow-500' },
                    { name: 'pret', class: 'text-gray-900' },
                    { name: 'laranj', class: 'text-orange-500' },
                    { name: 'cinz', class: 'text-gray-500' }
                  ];

                  let displayContent: React.ReactNode = content;
                  for (const color of colors) {
                    if (content.toLowerCase().includes(color.name)) {
                      const parts = content.split(new RegExp(`(${color.name}[a-z]*)`, 'gi'));
                      displayContent = parts.map((p, i) => 
                        p.toLowerCase().includes(color.name) ? <span key={i} className={`${color.class} font-bold`}>{p}</span> : p
                      );
                      break;
                    }
                  }

                  return (
                    <div key={idx} className="group flex flex-col relative">
                      <p className="leading-tight flex items-start">
                        <span className="mr-1">•</span>
                        <span className="hidden print:inline font-bold underline">{displayContent}</span>
                      </p>
                      <div className="print:hidden flex items-center gap-1 mt-0.5">
                        <input 
                          type="text" 
                          className="h-5 px-2 border rounded text-[9px] bg-blue-50/20 w-full focus:bg-white focus:ring-1 focus:ring-primary outline-none transition-all" 
                          value={content} 
                          onChange={e => {
                            const newData = [...tecnicoData];
                            newData[idx] = e.target.value;
                            setTecnicoData(newData);
                          }}
                        />
                        <button 
                          className="text-success p-0.5 hover:bg-success/10 rounded" 
                          title="Confirmar"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => setTecnicoData(tecnicoData.filter((_, i) => i !== idx))}
                          className="text-destructive p-0.5 hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-opacity" 
                          title="Remover linha"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>
          )}

          <div className="text-center text-[10px] mt-2">
            <p className="font-semibold">{empPrint.nome} – {empPrint.subtitulo}</p>
          </div>
        </div>

        <style>{`@media print { @page { size: landscape; margin: 0.5cm; } body { -webkit-print-color-adjust: exact; } .print\\:hidden { display: none !important; } }`}</style>
      </div>
    );
  }

  // ========== FORM VIEW ==========
  if (view === 'form') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{editingOrc ? 'Editar' : 'Novo'} Orçamento</h1>
          <Button variant="outline" onClick={() => { setView('list'); resetForm(); }}>Cancelar</Button>
        </div>

        <div className="border rounded-lg p-5 bg-card space-y-4">
          {/* Cliente / Revenda toggle + search */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs text-primary font-medium">Tipo</label>
              <div className="flex gap-1">
                <button
                  onClick={() => { setCategoriaOrc('cliente'); setClienteId(''); setClienteSearch(''); setCompradorSelecionado(''); }}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${categoriaOrc === 'cliente' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  Cliente
                </button>
                <button
                  onClick={() => { setCategoriaOrc('revenda'); setClienteId(''); setClienteSearch(''); setCompradorSelecionado(''); }}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${categoriaOrc === 'revenda' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  Revenda
                </button>
              </div>
            </div>
            <div className="flex gap-2 items-end">
              <div className="relative flex-[3]">
                <label className="text-xs text-primary font-medium mb-1 block">
                  Buscar {categoriaOrc === 'revenda' ? 'Revenda' : 'Cliente'}
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={`Buscar ${categoriaOrc === 'revenda' ? 'revenda' : 'cliente'} por nome, CNPJ, telefone...`}
                    value={clienteSearch}
                    onChange={e => { setClienteSearch(e.target.value); setClienteId(''); setShowClienteDropdown(true); }}
                    onFocus={() => setShowClienteDropdown(true)}
                    className="pl-10"
                  />
                  {showClienteDropdown && clienteSearch && !clienteId && (
                    <div className="absolute z-50 w-full border rounded mt-1 max-h-40 overflow-y-auto bg-card shadow-lg">
                      {filteredClientes.map(c => (
                        <button key={c.id} onClick={() => { setClienteId(c.id); setClienteSearch(c.nome); setShowClienteDropdown(false); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex justify-between">
                          <span className="font-medium">{c.nome}</span>
                          <span className="text-muted-foreground text-xs">{c.cnpj}</span>
                        </button>
                      ))}
                      {filteredClientes.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum(a) {categoriaOrc === 'revenda' ? 'revenda' : 'cliente'} encontrado(a)</p>}
                    </div>
                  )}
                </div>
              </div>
              <Button variant="outline" size="icon" className="shrink-0 h-9 mb-[1px]" onClick={() => setShowCadCliente(true)} title={`Cadastrar ${categoriaOrc === 'revenda' ? 'revenda' : 'cliente'}`}>
                <UserPlus className="h-4 w-4" />
              </Button>
              <div className="flex flex-col flex-[2] min-w-0">
                <label className="text-xs text-primary font-medium mb-1">Empresa Emitente</label>
                <Select value={empresaEmitente} onValueChange={(value) => setEmpresaEmitente(value as EmpresaEmitente)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rollerport">Rollerport (Simples Nacional)</SelectItem>
                    <SelectItem value="ferreira_roletes">Ferreira Roletes (Lucro Presumido)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Histórico de orçamentos do cliente */}
          {clienteId && clienteOrcamentos.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-3 border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Últimos orçamentos de {clienteSearch}</span>
                  <span className="text-xs text-muted-foreground">({clienteOrcamentos.length})</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClienteHistory(!showClienteHistory)}
                  className="text-xs"
                >
                  {showClienteHistory ? 'Ocultar' : 'Ver histórico'}
                </Button>
              </div>

              {/* Último orçamento - sempre visível */}
              {clienteOrcamentos[0] && (
                <div className="flex items-center justify-between bg-card rounded p-2 border">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{clienteOrcamentos[0].numero}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        clienteOrcamentos[0].status === 'APROVADO' ? 'bg-success/10 text-success' :
                        clienteOrcamentos[0].status === 'ENVIADO' ? 'bg-info/10 text-info' :
                        clienteOrcamentos[0].status === 'REPROVADO' ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>{clienteOrcamentos[0].status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {clienteOrcamentos[0].dataOrcamento || clienteOrcamentos[0].createdAt} • {fmt(clienteOrcamentos[0].valorTotal)} • {(clienteOrcamentos[0].itensRolete?.length || 0) + (clienteOrcamentos[0].itensProduto?.length || 0)} itens
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cloneOrcamento(clienteOrcamentos[0])}
                    className="gap-1.5 text-xs"
                    title="Clonar orçamento com preços atualizados"
                  >
                    <Copy className="h-3.5 w-3.5" /> Clonar com preços atuais
                  </Button>
                </div>
              )}

              {/* Histórico expandido */}
              {showClienteHistory && clienteOrcamentos.length > 1 && (
                <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                  {clienteOrcamentos.slice(1).map(orc => (
                    <div key={orc.id} className="flex items-center justify-between bg-card/50 rounded p-2 border text-sm">
                      <div>
                        <span className="font-mono text-xs">{orc.numero}</span>
                        <span className="text-xs text-muted-foreground ml-2">{orc.dataOrcamento || orc.createdAt}</span>
                        <span className="text-xs text-muted-foreground ml-2">{fmt(orc.valorTotal)}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setViewOrc(orc); setView('print'); }}
                          className="h-7 px-2"
                          title="Ver orçamento"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cloneOrcamento(orc)}
                          className="h-7 px-2"
                          title="Clonar"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Frete, Pagamento, Vendedor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-primary font-medium">Tipo de Frete</label>
              <select value={tipoFrete} onChange={e => setTipoFrete(e.target.value as TipoFrete)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="FOB">FOB (frete por conta do comprador)</option>
                <option value="CIF">CIF (frete por conta do vendedor)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-primary font-medium">Condição de Pagamento</label>
              <select value={condicaoPagamento} onChange={e => setCondicaoPagamento(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="">Selecione...</option>
                <option value="Boleto">Boleto</option>
                <option value="PIX">PIX – CNPJ: 10.311.350/0001-22</option>
                <option value="Transferência Bancária">Transferência – Santander Ag:3744 CC:130094436</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-primary font-medium">Vendedor</label>
              <Input placeholder="Nome do vendedor" value={vendedor} onChange={e => setVendedor(e.target.value)} />
            </div>
          </div>

          {/* Detalhes da forma de pagamento */}
          {(condicaoPagamento === 'Boleto' || condicaoPagamento === 'Cheque') && (
            <div className="bg-muted/20 rounded-lg p-3 border">
              <label className="text-xs text-primary font-medium">
                {condicaoPagamento === 'Boleto' ? 'Prazo do Boleto' : 'Prazo do Cheque'}
              </label>
              <Input
                placeholder={condicaoPagamento === 'Boleto' ? 'Ex: 30/60/90 dias' : 'Ex: 30/60/90 dias'}
                value={(condicaoPagamento === 'Boleto' ? (editingOrc as any)?.prazoBoleto : (editingOrc as any)?.prazoCheque) || prazoPagamento}
                onChange={e => setPrazoPagamento(e.target.value)}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {condicaoPagamento === 'Boleto' ? 'Informe os dias para vencimento. Ex: 30/60/90 dias' : 'Informe para quantos dias será o cheque. Ex: 30/60/90 dias'}
              </p>
            </div>
          )}
          {condicaoPagamento === 'PIX' && (
            <div className="bg-muted/20 rounded-lg p-3 border text-xs">
              <p className="font-semibold text-primary mb-1">Dados para PIX / Transferência:</p>
              <p>{EMPRESAS[empresaEmitente].banco}</p>
              <p>{EMPRESAS[empresaEmitente].razaoSocial}</p>
              <p>CNPJ: {EMPRESAS[empresaEmitente].cnpjBanco}</p>
              <p>Agência: {EMPRESAS[empresaEmitente].agencia} | Conta Corrente: {EMPRESAS[empresaEmitente].contaCorrente}</p>
              <p>PIX: {EMPRESAS[empresaEmitente].chavePix}</p>
            </div>
          )}
          {condicaoPagamento === 'Transferência Bancária' && (
            <div className="bg-muted/20 rounded-lg p-3 border text-xs">
              <p className="font-semibold text-primary mb-1">Dados para Transferência Bancária:</p>
              <p>{EMPRESAS[empresaEmitente].banco}</p>
              <p>{EMPRESAS[empresaEmitente].razaoSocial}</p>
              <p>CNPJ: {EMPRESAS[empresaEmitente].cnpjBanco}</p>
              <p>Agência: {EMPRESAS[empresaEmitente].agencia} | Conta Corrente: {EMPRESAS[empresaEmitente].contaCorrente}</p>
            </div>
          )}

          {/* Data, Previsão, Comprador */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-primary font-medium">Data</label>
              <Input value={dataOrcamento} onChange={e => setDataOrcamento(e.target.value)} placeholder="dd/mm/aaaa" />
            </div>
            <div>
              <label className="text-xs text-primary font-medium">Previsão de Entrega</label>
              <Input placeholder="Ex: 15 dias úteis" value={previsaoEntrega} onChange={e => setPrevisaoEntrega(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-primary font-medium">{labelContato}</label>
              <div className="flex gap-2">
                <select value={compradorSelecionado} onChange={e => setCompradorSelecionado(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Selecione...</option>
                  {clienteSelecionado?.compradores.map((comp, i) => (
                    <option key={i} value={comp.nome}>{comp.nome}</option>
                  ))}
                </select>
                <Button variant="outline" size="icon" onClick={() => setShowCadComprador(true)} title={`Cadastrar ${labelContato.toLowerCase()}`} disabled={!clienteId}>
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Observação */}
          <div>
            <label className="text-xs text-primary font-medium">Observação</label>
            <Textarea placeholder="Observações gerais do orçamento..." value={observacao} onChange={e => setObservacao(e.target.value)} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setShowProdutoSearch(true); setShowRoleteForm(false); }} className="gap-2">
            <Package className="h-4 w-4" /> Inserir Produto
          </Button>
          <Button variant="outline" onClick={() => { setShowRoleteForm(true); setShowProdutoSearch(false); }} className="gap-2 text-primary border-primary">
            <Settings2 className="h-4 w-4" /> Inserir Rolete
          </Button>
        </div>

        {/* ===== Buscar Produto panel ===== */}
        {showProdutoSearch && !selectedProduto && (
          <div className="border rounded-lg p-4 bg-card">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Buscar Produto</h3>
              <button onClick={() => setShowProdutoSearch(false)} className="text-primary text-sm">Cancelar</button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar produto..." value={produtoSearch} onChange={e => setProdutoSearch(e.target.value)} className="pl-10" />
              </div>
              <Button variant="outline" onClick={() => setShowCadProduto(true)}>+ Cadastrar</Button>
            </div>
            {produtoSearch && (
              <div className="mt-2 border rounded max-h-40 overflow-y-auto">
                {filteredProdutos.map(p => (
                  <button key={p.id} onClick={() => { setSelectedProduto(p); setProdutoQtd(1); setProdutoDesconto(0); setProdutoNcm((p as any).ncm || ''); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50">
                    {p.codigo} – {p.nome} <span className="text-muted-foreground ml-2">{fmt(p.valor)}</span>
                  </button>
                ))}
                {filteredProdutos.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum produto encontrado</p>}
              </div>
            )}
          </div>
        )}

        {/* ===== Novo Item - Produto ===== */}
        {selectedProduto && (
          <div className="border rounded-lg p-4 bg-card">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <Package className="h-4 w-4" /> Novo Item – Produto
            </h3>
            <div className="bg-muted/30 rounded p-3 mb-3">
              <p className="font-medium">{selectedProduto.nome}</p>
              <p className="text-xs text-muted-foreground">Valor unitário: {fmt(selectedProduto.valor)}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-primary font-medium">Quantidade</label>
                <Input type="number" value={produtoQtd} onChange={e => setProdutoQtd(+e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-primary font-medium">Desconto (%)</label>
                <Input type="number" value={produtoDesconto} onChange={e => setProdutoDesconto(+e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-primary font-medium">NCM</label>
                <Input placeholder="Digite o NCM" value={produtoNcm} onChange={e => setProdutoNcm(e.target.value)} />
              </div>
              </div>
            <div className="bg-muted/30 rounded p-3 mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-xs text-primary">Valor Unit. Final</span><br /><strong>{fmt(selectedProduto.valor * (1 - produtoDesconto / 100))}</strong></div>
              <div><span className="text-xs text-primary">Total Item</span><br /><strong>{fmt(selectedProduto.valor * (1 - produtoDesconto / 100) * produtoQtd)}</strong></div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={insertProduto} className="gap-2">✓ Inserir no Orçamento</Button>
              <Button variant="outline" onClick={() => { setSelectedProduto(null); setShowProdutoSearch(false); }}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* ===== Novo Item - Rolete ===== */}
        {showRoleteForm && (
          <div className="border rounded-lg p-4 bg-card">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <Settings2 className="h-4 w-4" /> Novo Item – Rolete
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <label className="text-xs text-primary font-medium">Tipo de Rolete</label>
                <select value={roleteItem.tipoRolete} onChange={e => updateRoleteField({ tipoRolete: e.target.value as any })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Selecione...</option>
                  {['RC', 'RR', 'RG', 'RI', 'RRA'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {roleteItem.tipoRolete && (() => {
                  const defaultNames: Record<string, string> = { RC: 'Rolete de Carga', RR: 'Rolete de Retorno', RG: 'Rolete Guia', RI: 'Rolete de Impacto', RRA: 'Rolete de Retorno Auto-alinhante' };
                  const prod = produtos.find(p => p.tipo === roleteItem.tipoRolete && p.nomeCompleto);
                  const fullName = prod?.nomeCompleto || defaultNames[roleteItem.tipoRolete] || '';
                  return fullName ? (
                    <p className="text-[11px] text-primary/70 mt-1 font-semibold">({fullName})</p>
                  ) : null;
                })()}
              </div>
              <div>
                <label className="text-xs text-primary font-medium">Diâmetro do Tubo</label>
                <select value={roleteItem.diametroTubo || ''} onChange={e => updateRoleteField({ diametroTubo: +e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Selecione...</option>
                  {diametrosTubo.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-primary font-medium">Parede do Tubo</label>
                <select value={roleteItem.paredeTubo || ''} onChange={e => updateRoleteField({ paredeTubo: +e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Selecione...</option>
                  {paredesTubo(roleteItem.diametroTubo).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-primary font-medium">Comp. Tubo (mm)</label>
                <div className="relative">
                  <Input type="number" step="0.01" value={roleteItem.comprimentoTubo || ''} onChange={e => updateRoleteField({ comprimentoTubo: e.target.value ? parseFloat(e.target.value) : '' as any })} className="pr-10" />
                  {roleteItem.comprimentoTubo ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{roleteItem.comprimentoTubo} mm</span> : null}
                </div>
              </div>
              <div>
                <label className="text-xs text-primary font-medium">Diâmetro do Eixo</label>
                <select value={roleteItem.diametroEixo || ''} onChange={e => updateRoleteField({ diametroEixo: +e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Selecione...</option>
                  {diametrosEixo.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-primary font-medium">Comp. Eixo (mm)</label>
                <div className="relative">
                  <Input type="number" step="0.01" value={roleteItem.comprimentoEixo || ''} onChange={e => updateRoleteField({ comprimentoEixo: e.target.value ? parseFloat(e.target.value) : '' as any })} className="pr-10" />
                  {roleteItem.comprimentoEixo ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{roleteItem.comprimentoEixo} mm</span> : null}
                </div>
              </div>
              <div>
                <label className="text-xs text-primary font-medium">Tipo do Encaixe</label>
                <select value={roleteItem.tipoEncaixe} onChange={e => updateRoleteField({ tipoEncaixe: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Selecione...</option>
                  {encaixes.map(e => <option key={e.id} value={e.tipo}>{e.tipo}</option>)}
                </select>
              </div>
              {roleteItem.tipoEncaixe && roleteItem.tipoEncaixe !== 'FAÇO' && (
                <div>
                   <label className="text-xs text-primary font-medium">Medida do Encaixe</label>
                  <Input placeholder="Medida do encaixe" value={roleteItem.medidaFresado} onChange={e => updateRoleteField({ medidaFresado: e.target.value })} />
                </div>
              )}
              <div>
                <label className="text-xs text-primary font-medium">Conjunto/Kits</label>
                <select value={roleteItem.conjunto} onChange={e => updateRoleteField({ conjunto: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Selecione...</option>
                  {conjuntos.map(c => <option key={c.id} value={c.codigo}>{c.codigo}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-primary font-medium">Revest. Spiraflex</label>
                <select value={revestimentos.find(r => r.tipo.toUpperCase().includes('SPIRAFLEX') && r.tipo === roleteItem.especificacaoRevestimento) ? roleteItem.especificacaoRevestimento : ''}
                  onChange={e => updateRoleteField({ especificacaoRevestimento: e.target.value, tipoRevestimento: e.target.value ? 'SPIRAFLEX' : '', quantidadeAneis: 0 })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Sem Spiraflex</option>
                  {revestimentos.filter(r => r.tipo.toUpperCase().includes('SPIRAFLEX')).map(r => <option key={r.id} value={r.tipo}>{r.tipo}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-primary font-medium">Revest. Borracha</label>
                <select value={revestimentos.find(r => r.tipo.toUpperCase().includes('ABI') && r.tipo === roleteItem.especificacaoRevestimento) ? roleteItem.especificacaoRevestimento : ''}
                  onChange={e => updateRoleteField({ especificacaoRevestimento: e.target.value, tipoRevestimento: e.target.value ? 'ANEIS' : '', quantidadeAneis: e.target.value ? (roleteItem.quantidadeAneis || 1) : 0 })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Sem Anéis</option>
                  {revestimentos.filter(r => r.tipo.toUpperCase().includes('ABI')).map(r => <option key={r.id} value={r.tipo}>{r.tipo}</option>)}
                </select>
              </div>
              {roleteItem.especificacaoRevestimento && revestimentos.find(r => r.tipo === roleteItem.especificacaoRevestimento && r.tipo.toUpperCase().includes('ABI')) && (
                <div>
                  <label className="text-xs text-primary font-medium">Qtd. Anéis</label>
                  <Input type="number" min={1} value={roleteItem.quantidadeAneis} onChange={e => updateRoleteField({ quantidadeAneis: +e.target.value })} />
                </div>
              )}
              <div>
                <label className="text-xs text-primary font-medium">Adicional</label>
                <Input value={(roleteItem as any).adicional || ''} onChange={e => updateRoleteField({ adicional: e.target.value } as any)} placeholder="Informações adicionais" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mt-3 text-sm">
              <div>
                <label className="text-xs text-primary font-medium">Código do Produto</label>
                <Input placeholder="Ex: RC-102-250" value={codigoRolete} onChange={e => setCodigoRolete(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-primary font-medium">Código do Cliente</label>
                <Input placeholder="Código do cliente" value={(roleteItem as any).codigoExterno || ''} onChange={e => updateRoleteField({ codigoExterno: e.target.value } as any)} />
              </div>
              <div>
                <label className="text-xs text-primary font-medium">Quantidade</label>
                <Input type="number" value={roleteItem.quantidade || ''} onChange={e => updateRoleteField({ quantidade: e.target.value ? +e.target.value : '' as any })} />
              </div>
              <div>
                <label className="text-xs text-primary font-medium">Multiplicador {roleteItem.multiplicador}%</label>
                <Input type="number" step="0.1" value={roleteItem.multiplicador || ''} onChange={e => updateRoleteField({ multiplicador: e.target.value ? +e.target.value : '' as any })} />
              </div>
              <div>
                <label className="text-xs text-primary font-medium">NCM</label>
                <Input placeholder="NCM" value={roleteItem.ncm || '8431.39.00'} onChange={e => updateRoleteField({ ncm: e.target.value } as any)} />
              </div>
              <div>
                <label className="text-xs text-primary font-medium">Desconto (%)</label>
                <Input type="number" value={roleteItem.desconto || ''} onChange={e => updateRoleteField({ desconto: e.target.value ? +e.target.value : '' as any })} />
              </div>
              <div className="col-span-2 sm:col-span-6 h-px bg-muted my-1" />
              <div>
                <label className="text-xs text-primary font-medium">PIS (%)</label>
                <Input type="number" step="0.01" value={roleteItem.aliqPIS || 0} onChange={e => updateRoleteField({ aliqPIS: +e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-primary font-medium">COFINS (%)</label>
                <Input type="number" step="0.01" value={roleteItem.aliqCOFINS || 0} onChange={e => updateRoleteField({ aliqCOFINS: +e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-primary font-medium">ICMS (%)</label>
                <Input type="number" step="0.01" value={roleteItem.aliqICMS || 0} onChange={e => updateRoleteField({ aliqICMS: +e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-primary font-medium">IPI (%)</label>
                <Input type="number" step="0.01" value={roleteItem.aliqIPI || 0} onChange={e => updateRoleteField({ aliqIPI: +e.target.value })} />
              </div>
            </div>
            <div className="bg-muted/30 rounded p-3 mt-3 grid grid-cols-4 gap-3 text-sm">
              <div><span className="text-xs text-primary">Preço Unit. Final</span><br /><strong>{fmt(roleteItem.valorPorPeca)}</strong></div>
              <div><span className="text-xs text-primary">Total Item</span><br /><strong>{fmt(roleteItem.valorTotal)}</strong></div>
              <div>
                <span className="text-xs text-primary">Impostos (Destaque)</span><br />
                <span className="text-[10px] text-muted-foreground">
                  {fmt((roleteItem.valorTotal * ((roleteItem.aliqPIS || 0) + (roleteItem.aliqCOFINS || 0) + (roleteItem.aliqICMS || 0))) / 100)}
                </span>
                <span className="text-[9px] block text-muted-foreground">+ IPI: {fmt((roleteItem.valorTotal * (roleteItem.aliqIPI || 0)) / 100)}</span>
              </div>
              <div className="bg-primary/5 p-1 rounded border border-primary/10">
                <span className="text-xs text-primary font-bold">Valor Líquido Interno</span><br />
                <strong className="text-primary">
                  {fmt(roleteItem.valorTotal * (1 - ((roleteItem.aliqPIS || 0) + (roleteItem.aliqCOFINS || 0) + (roleteItem.aliqICMS || 0)) / 100))}
                </strong>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={insertRolete} className="gap-2">✓ Inserir no Orçamento</Button>
              <Button variant="outline" onClick={() => setShowRoleteForm(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* ===== Itens do Orçamento ===== */}
        {(itensProduto.length > 0 || itensRolete.length > 0) && (
          <div className="border rounded-lg p-4 bg-card overflow-x-auto">
            <h3 className="font-semibold mb-3">Itens do Orçamento - {clienteSelecionado?.nome || clienteSearch || 'Cliente'}</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50 text-primary uppercase text-[10px] font-bold">
                  <th className="border p-2 text-center w-8">#</th>
                  <th className="border p-2 text-left">Código</th>
                  <th className="border p-2 text-left">Descrição</th>
                  <th className="border p-2 text-center w-12">Qtd</th>
                  <th className="border p-2 text-right">Vlr Unit</th>
                  <th className="border p-2 text-center w-12 text-[9px]">PIS%</th>
                  <th className="border p-2 text-center w-12 text-[9px]">COF%</th>
                  <th className="border p-2 text-center w-12 text-[9px]">ICM%</th>
                  <th className="border p-2 text-center w-12 text-[9px]">IPI%</th>
                  <th className="border p-2 text-right">Total Item</th>
                  <th className="border p-2 text-center w-24">Ações</th>
                </tr>
              </thead>
              <tbody>
                {[...itensProduto.map(it => ({ ...it, isProd: true })), ...itensRolete.map(it => ({ ...it, isProd: false }))].map((item, i) => {
                  const aliqPIS = item.aliqPIS || 0;
                  const aliqCOFINS = item.aliqCOFINS || 0;
                  const aliqICMS = item.aliqICMS || 0;
                  const aliqIPI = item.aliqIPI || 0;
                  const valorUnit = 'isProd' in item && item.isProd ? (item as any).valorUnitario : (item as any).valorPorPeca;
                  const codigo = 'isProd' in item && item.isProd ? (produtos.find(p => p.id === (item as any).produtoId)?.codigo || '') : (item as any).codigoProduto || (item as any).tipoRolete;
                  const descricao = 'isProd' in item && item.isProd ? (item as any).produtoNome : `Rolete ${(item as any).tipoRolete} ${(item as any).diametroTubo}x${(item as any).paredeTubo} T:${(item as any).comprimentoTubo} E:${(item as any).diametroEixo} ${(item as any).comprimentoEixo}`;

                  return (
                    <tr key={item.id} className="hover:bg-muted/30 border-b">
                      <td className="p-2 text-center font-mono">{i + 1}</td>
                      <td className="p-2 font-medium">{codigo}</td>
                      <td className="p-2 text-[11px] max-w-[200px] truncate" title={descricao}>{descricao}</td>
                      <td className="p-2 text-center font-bold">{item.quantidade}</td>
                      <td className="p-2 text-right">{fmt(valorUnit)}</td>
                      <td className="p-2 text-center text-muted-foreground">{aliqPIS}%</td>
                      <td className="p-2 text-center text-muted-foreground">{aliqCOFINS}%</td>
                      <td className="p-2 text-center text-muted-foreground">{aliqICMS}%</td>
                      <td className="p-2 text-center text-muted-foreground">{aliqIPI}%</td>
                      <td className="p-2 text-right font-bold text-primary">{fmt(item.valorTotal)}</td>
                      <td className="p-2 text-center">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => {
                            if ('isProd' in item && item.isProd) {
                              const prod = produtos.find(p => p.id === (item as any).produtoId);
                              if (prod) { setSelectedProduto(prod); setProdutoQtd(item.quantidade); setProdutoDesconto(0); }
                            } else {
                              setRoleteItem(item as any); setCodigoRolete((item as any).codigoProduto || ''); setShowRoleteForm(true);
                            }
                          }} className="p-1 text-muted-foreground hover:text-primary transition-colors" title="Ver"><Eye className="h-4 w-4" /></button>
                          
                          <button onClick={() => {
                            if ('isProd' in item && item.isProd) {
                              const prod = produtos.find(p => p.id === (item as any).produtoId);
                              if (prod) { 
                                setSelectedProduto(prod); setProdutoQtd(item.quantidade); setProdutoDesconto(0); 
                                setItensProduto(itensProduto.filter(it => it.id !== item.id));
                              }
                            } else {
                              setRoleteItem(item as any); setCodigoRolete((item as any).codigoProduto || ''); setShowRoleteForm(true);
                              setItensRolete(itensRolete.filter(it => it.id !== item.id));
                            }
                          }} className="p-1 text-muted-foreground hover:text-primary transition-colors" title="Editar"><Edit className="h-4 w-4" /></button>
                          
                          <button onClick={() => {
                            if ('isProd' in item && item.isProd) setItensProduto(itensProduto.filter(it => it.id !== item.id));
                            else setItensRolete(itensRolete.filter(it => it.id !== item.id));
                          }} className="p-1 text-muted-foreground hover:text-destructive transition-colors" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Total + Save */}
        <div className="border-2 border-primary rounded-lg p-4 flex justify-between items-center">
          <span className="font-bold text-lg">Total do Orçamento</span>
          <span className="font-bold text-lg text-primary">{fmt(totalGeral)}</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} className="gap-2">Salvar Orçamento</Button>
          <Button variant="outline" onClick={() => { setView('list'); resetForm(); }}>Cancelar</Button>
        </div>

        {/* ===== Quick register modals ===== */}
        {showCadCliente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30">
            <div className="bg-card rounded-lg border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-3">
              <div className="flex justify-between"><h3 className="font-semibold text-lg">Cadastrar {categoriaOrc === 'revenda' ? 'Revenda' : 'Cliente'}</h3><button onClick={() => setShowCadCliente(false)}><XIcon className="h-4 w-4" /></button></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="text-xs text-muted-foreground">Nome da Empresa</label><Input value={cadCliente.nome} onChange={e => setCadCliente({ ...cadCliente, nome: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">CNPJ</label><Input value={cadCliente.cnpj} onChange={e => setCadCliente({ ...cadCliente, cnpj: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Telefone</label><Input value={cadCliente.telefone} onChange={e => setCadCliente({ ...cadCliente, telefone: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">WhatsApp</label><Input value={cadCliente.whatsapp} onChange={e => setCadCliente({ ...cadCliente, whatsapp: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">E-mail</label><Input value={cadCliente.email} onChange={e => setCadCliente({ ...cadCliente, email: e.target.value })} /></div>
                <div className="col-span-2"><label className="text-xs text-muted-foreground">Endereço</label><Input value={cadCliente.endereco} onChange={e => setCadCliente({ ...cadCliente, endereco: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Cidade</label><Input value={cadCliente.cidade} onChange={e => setCadCliente({ ...cadCliente, cidade: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Estado</label><Input value={cadCliente.estado} onChange={e => setCadCliente({ ...cadCliente, estado: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Aniversário da Empresa</label><Input type="date" value={cadCliente.aniversarioEmpresa || ''} onChange={e => setCadCliente({ ...cadCliente, aniversarioEmpresa: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Redes Sociais</label><Input value={cadCliente.redesSociais || ''} onChange={e => setCadCliente({ ...cadCliente, redesSociais: e.target.value })} placeholder="Instagram, LinkedIn..." /></div>
              </div>
              {/* Compradores */}
              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm">{labelContatos}</h4>
                  <Button variant="outline" size="sm" onClick={() => setCadCliente({ ...cadCliente, compradores: [...cadCliente.compradores, { nome: '', telefone: '', email: '', whatsapp: '', aniversario: '', redesSociais: '' }] })} className="gap-1"><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
                </div>
                {cadCliente.compradores.map((comp, idx) => (
                  <div key={idx} className="border rounded-lg p-3 mb-2 bg-muted/20">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-muted-foreground">{labelContato} {idx + 1}</span>
                      {cadCliente.compradores.length > 1 && (
                        <button onClick={() => setCadCliente({ ...cadCliente, compradores: cadCliente.compradores.filter((_, i) => i !== idx) })} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-xs text-muted-foreground">Nome</label><Input value={comp.nome} onChange={e => { const c = [...cadCliente.compradores]; c[idx] = { ...c[idx], nome: e.target.value }; setCadCliente({ ...cadCliente, compradores: c }); }} /></div>
                      <div><label className="text-xs text-muted-foreground">Telefone</label><Input value={comp.telefone} onChange={e => { const c = [...cadCliente.compradores]; c[idx] = { ...c[idx], telefone: e.target.value }; setCadCliente({ ...cadCliente, compradores: c }); }} /></div>
                      <div><label className="text-xs text-muted-foreground">E-mail</label><Input value={comp.email} onChange={e => { const c = [...cadCliente.compradores]; c[idx] = { ...c[idx], email: e.target.value }; setCadCliente({ ...cadCliente, compradores: c }); }} /></div>
                      <div><label className="text-xs text-muted-foreground">WhatsApp</label><Input value={comp.whatsapp} onChange={e => { const c = [...cadCliente.compradores]; c[idx] = { ...c[idx], whatsapp: e.target.value }; setCadCliente({ ...cadCliente, compradores: c }); }} /></div>
                      <div><label className="text-xs text-muted-foreground">Aniversário</label><Input type="date" value={comp.aniversario || ''} onChange={e => { const c = [...cadCliente.compradores]; c[idx] = { ...c[idx], aniversario: e.target.value }; setCadCliente({ ...cadCliente, compradores: c }); }} /></div>
                      <div><label className="text-xs text-muted-foreground">Redes Sociais</label><Input value={comp.redesSociais || ''} onChange={e => { const c = [...cadCliente.compradores]; c[idx] = { ...c[idx], redesSociais: e.target.value }; setCadCliente({ ...cadCliente, compradores: c }); }} placeholder="Instagram..." /></div>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={salvarCliente} className="w-full">Salvar {categoriaOrc === 'revenda' ? 'Revenda' : 'Cliente'}</Button>
            </div>
          </div>
        )}

        {showCadComprador && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30">
            <div className="bg-card rounded-lg border p-6 w-full max-w-lg space-y-3">
              <div className="flex justify-between"><h3 className="font-semibold">Cadastrar {labelContato}</h3><button onClick={() => setShowCadComprador(false)}><XIcon className="h-4 w-4" /></button></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="text-xs text-muted-foreground">Nome</label><Input value={cadComprador.nome} onChange={e => setCadComprador({ ...cadComprador, nome: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Telefone</label><Input value={cadComprador.telefone} onChange={e => setCadComprador({ ...cadComprador, telefone: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">WhatsApp</label><Input value={cadComprador.whatsapp} onChange={e => setCadComprador({ ...cadComprador, whatsapp: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">E-mail</label><Input value={cadComprador.email} onChange={e => setCadComprador({ ...cadComprador, email: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Aniversário</label><Input type="date" value={cadComprador.aniversario || ''} onChange={e => setCadComprador({ ...cadComprador, aniversario: e.target.value })} /></div>
                <div className="col-span-2"><label className="text-xs text-muted-foreground">Redes Sociais</label><Input value={cadComprador.redesSociais || ''} onChange={e => setCadComprador({ ...cadComprador, redesSociais: e.target.value })} placeholder="Instagram, LinkedIn..." /></div>
              </div>
              <Button onClick={salvarComprador} className="w-full">Salvar {labelContato}</Button>
            </div>
          </div>
        )}

        {showCadProduto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30">
            <div className="bg-card rounded-lg border p-6 w-full max-w-md space-y-3">
              <div className="flex justify-between"><h3 className="font-semibold">Cadastrar Produto</h3><button onClick={() => setShowCadProduto(false)}><XIcon className="h-4 w-4" /></button></div>
              <Input placeholder="Código" value={cadProduto.codigo} onChange={e => setCadProduto({ ...cadProduto, codigo: e.target.value })} />
              <Input placeholder="Nome" value={cadProduto.nome} onChange={e => setCadProduto({ ...cadProduto, nome: e.target.value })} />
              <Input placeholder="Medidas (Ex: 100x50x30mm)" value={cadProduto.medidas} onChange={e => setCadProduto({ ...cadProduto, medidas: e.target.value })} />
              <Input placeholder="Descrição" value={cadProduto.descricao} onChange={e => setCadProduto({ ...cadProduto, descricao: e.target.value })} />
              <Input placeholder="NCM" value={cadProduto.ncm} onChange={e => setCadProduto({ ...cadProduto, ncm: e.target.value })} />
              <Input type="number" step="0.01" placeholder="Valor (R$)" value={cadProduto.valor || ''} onChange={e => setCadProduto({ ...cadProduto, valor: +e.target.value })} />
              <Button onClick={salvarProduto} className="w-full">Salvar</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========== LIST VIEW ==========
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-header">Orçamentos</h1>
          <p className="page-subtitle">Gestão de orçamentos</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Orçamento</Button>
      </div>

      <div className="border rounded-lg p-4 bg-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar empresa, comprador, CNPJ, telefone, email, endereço..." value={searchList} onChange={e => setSearchList(e.target.value)} className="pl-10" />
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Número</th>
              <th className="text-left p-3 font-medium">Empresa</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Comprador</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Data</th>
              <th className="text-right p-3 font-medium">Valor</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="p-3 w-40">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrcamentos.slice().reverse().map(o => (
              <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 font-mono font-medium">{o.numero}</td>
                <td className="p-3">{o.clienteNome || 'Sem cliente'}</td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">{o.compradorNome || '-'}</td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">{o.dataOrcamento || o.createdAt}</td>
                <td className="p-3 text-right font-mono font-medium">{fmt(o.valorTotal)}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    o.status === 'APROVADO' ? 'bg-success/10 text-success' :
                    o.status === 'ENVIADO' ? 'bg-info/10 text-info' :
                    o.status === 'REPROVADO' ? 'bg-destructive/10 text-destructive' :
                    o.status === 'AGUARDANDO' ? 'bg-secondary/10 text-secondary' :
                    'bg-muted text-muted-foreground'
                  }`}>{o.status}</span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setViewOrc(o); setView('print'); }} className="p-1 rounded hover:bg-muted" title="Visualizar"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => openEdit(o)} className="p-1 rounded hover:bg-muted" title="Editar"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => { setViewOrc(o); setView('print'); }} className="p-1 rounded hover:bg-muted" title="Imprimir"><Printer className="h-4 w-4" /></button>
                    <button 
                      onClick={() => navigate('/agenda', { state: { followUp: { clienteId: o.clienteId, orcNumero: o.numero } } })} 
                      className="p-1 rounded hover:bg-muted text-violet-500" 
                      title="Agendar Follow-up"
                    >
                      <Calendar className="h-4 w-4" />
                    </button>
                    <button onClick={() => convertToPedido(o)} className="p-1 rounded hover:bg-muted text-primary" title="Transformar em Pedido"><ShoppingCart className="h-4 w-4" /></button>
                    <button onClick={() => deleteOrcamento(o.id)} className="p-1 rounded hover:bg-muted text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredOrcamentos.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum orçamento encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
