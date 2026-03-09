import { useState, useEffect, useRef, useCallback } from 'react';
import { store } from '@/lib/store';
import type { Orcamento, ItemOrcamento, ItemProdutoOrcamento, StatusOrcamento, TipoFrete, Cliente, Comprador, Produto, Tubo, Eixo, Conjunto, Revestimento, Encaixe } from '@/lib/types';
import { useCustos } from '@/hooks/useCustos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Trash2, Eye, Edit, Search, Settings2, Package, Printer,
  ShoppingCart, ArrowLeft, UserPlus, X as XIcon
} from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import qrcode from '@/assets/qrcode-rollerport.jpeg';

const emptyItem = (): ItemOrcamento => ({
  id: '', tipoRolete: '' as any, quantidade: '' as any, diametroTubo: '' as any, paredeTubo: '' as any, comprimentoTubo: '' as any,
  comprimentoEixo: '' as any, diametroEixo: '' as any, tipoEncaixe: '', medidaFresado: '', conjunto: '',
  tipoRevestimento: '', especificacaoRevestimento: '', quantidadeAneis: '' as any, custo: 0,
  multiplicador: 1.8, desconto: '' as any, valorPorPeca: 0, valorTotal: 0, ncm: '8431.39.00',
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

  // ETAPA 5 – Preço final (multiplicador padrão 1.8, inclui impostos)
  const desconto = item.desconto || 0;
  const valorPorPeca = custo * item.multiplicador * (1 - desconto / 100);
  const valorTotal = valorPorPeca * item.quantidade;

  return { ...item, custo: +custo.toFixed(2), valorPorPeca: +valorPorPeca.toFixed(2), valorTotal: +valorTotal.toFixed(2) };
}

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

type View = 'list' | 'form' | 'view' | 'print';

export default function OrcamentosPage() {
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

  // Sub-panels
  const [showProdutoSearch, setShowProdutoSearch] = useState(false);
  const [produtoSearch, setProdutoSearch] = useState('');
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [produtoQtd, setProdutoQtd] = useState(1);
  const [produtoNcm, setProdutoNcm] = useState('');
  const [produtoDesconto, setProdutoDesconto] = useState(0);

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

  const [clientes, setClientes] = useState(store.getClientes());
  const [revendas, setRevendas] = useState(store.getFornecedores());
  const [produtos, setProdutos] = useState(store.getProdutos());

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

  const clienteSelecionado = clientes.find(c => c.id === clienteId);

  const filteredClientes = clientes.filter(c => {
    const s = clienteSearch.toLowerCase();
    if (!s) return true;
    const compradorMatch = (c.compradores || []).some(comp =>
      comp.nome?.toLowerCase().includes(s) || comp.telefone?.includes(clienteSearch) || comp.email?.toLowerCase().includes(s)
    );
    return c.nome.toLowerCase().includes(s) || c.cnpj.includes(clienteSearch) ||
      c.telefone.includes(clienteSearch) || c.email.toLowerCase().includes(s) ||
      c.endereco?.toLowerCase().includes(s) || c.whatsapp?.includes(clienteSearch) || compradorMatch;
  });

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
          if (d.editingOrc) setEditingOrc(d.editingOrc);
          setView('form');
        }
      }
    } catch {}
  }, []);

  // Autosave draft to localStorage on every change when in form view
  useEffect(() => {
    if (view === 'form') {
      const draft = { clienteId, clienteSearch, tipoFrete, condicaoPagamento, vendedor, dataOrcamento, previsaoEntrega, observacao, compradorSelecionado, itensRolete, itensProduto, prazoPagamento, editingOrc };
      localStorage.setItem('orc_draft', JSON.stringify(draft));
    }
  }, [view, clienteId, clienteSearch, tipoFrete, condicaoPagamento, vendedor, dataOrcamento, previsaoEntrega, observacao, compradorSelecionado, itensRolete, itensProduto, prazoPagamento, editingOrc]);

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
          clienteNome: clientes.find(c => c.id === clienteId)?.nome || 'Sem cliente',
          compradorNome: compradorSelecionado,
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
  }, [view, clienteId, tipoFrete, condicaoPagamento, vendedor, previsaoEntrega, observacao, itensRolete, itensProduto, compradorSelecionado]);

  const resetForm = () => {
    setClienteId(''); setClienteSearch(''); setTipoFrete('FOB');
    setCondicaoPagamento(''); setVendedor('');
    setDataOrcamento(new Date().toLocaleDateString('pt-BR'));
    setPrevisaoEntrega(''); setObservacao(''); setCompradorSelecionado('');
    setItensRolete([]); setItensProduto([]);
    setEditingOrc(null); setShowProdutoSearch(false);
    setShowRoleteForm(false); setSelectedProduto(null);
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
    setView('form');
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
    };
    setItensProduto([...itensProduto, item]);
    setShowProdutoSearch(false);
    setSelectedProduto(null);
    setProdutoSearch('');
    setProdutoQtd(1);
    setProdutoDesconto(0);
    setProdutoNcm('');
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
    // Não duplicar se já existir com mesmo código
    if (!existingProds.some(p => p.codigo === novoProduto.codigo && p.tipo === novoProduto.tipo)) {
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
    const id = store.nextId('cli');
    const novo: Cliente = {
      ...cadCliente, id, contato: cadCliente.compradores?.[0]?.nome || cadCliente.nome,
      compradores: cadCliente.compradores || [],
      createdAt: new Date().toISOString().split('T')[0],
    };
    const all = [...clientes, novo];
    store.saveClientes(all);
    setClienteId(id); setClienteSearch(cadCliente.nome);
    setShowCadCliente(false);
    setCadCliente({
      nome: '', cnpj: '', email: '', telefone: '', whatsapp: '', endereco: '', cidade: '', estado: '', contato: '',
      compradores: [{ nome: '', telefone: '', email: '', whatsapp: '', aniversario: '', redesSociais: '' }],
      aniversarioEmpresa: '', redesSociais: '',
    });
    toast.success('Cliente cadastrado!');
  };

  // Cadastrar comprador rápido
  const salvarComprador = () => {
    if (!clienteSelecionado) return;
    const updated = clientes.map(c =>
      c.id === clienteId
        ? { ...c, compradores: [...c.compradores, cadComprador] }
        : c
    );
    store.saveClientes(updated);
    setShowCadComprador(false);
    setCadComprador({ nome: '', telefone: '', email: '', whatsapp: '', aniversario: '', redesSociais: '' });
    toast.success('Comprador cadastrado!');
  };

  // Cadastrar produto rápido
  const salvarProduto = () => {
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

  const filteredOrcamentos = orcamentos.filter(o =>
    o.clienteNome.toLowerCase().includes(searchList.toLowerCase()) ||
    o.numero.includes(searchList)
  );

  // ========== PRINT VIEW ==========
  if (view === 'print' && viewOrc) {
    const cli = clientes.find(c => c.id === viewOrc.clienteId);

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
    const taxaICMSOrig = icmsInterMap[destinoUF] || 0.12;
    const taxaICMSDest = origemUF === destinoUF ? 0 : Math.max(0, (icmsInternoMap[destinoUF] || 0.18) - taxaICMSOrig);
    const taxaPIS = 0.0165;
    const taxaCOFINS = 0.076;
    const taxaIPI = 0.05;

    // Build all items for the table
    const allPrintItems: Array<{
      item: number; qtd: number; codigo: string; codExterno: string; descricao: string;
      ncm: string; valorLiquido: number; pis: number; cofins: number; icmsOrigem: number;
      icmsDestino: number; valorUnitario: number; valorTotal: number; valorIPI: number;
    }> = [];

    let idx = 1;
    (viewOrc.itensProduto || []).forEach((ip) => {
      const prod = produtos.find(p => p.id === ip.produtoId);
      const vliq = ip.valorUnitario;
      const pisVal = +(vliq * taxaPIS).toFixed(2);
      const cofinsVal = +(vliq * taxaCOFINS).toFixed(2);
      const icmsOrig = +(vliq * taxaICMSOrig).toFixed(2);
      const icmsDest = +(vliq * taxaICMSDest).toFixed(2);
      const ipiVal = +(vliq * taxaIPI).toFixed(2);
      allPrintItems.push({
        item: idx++, qtd: ip.quantidade, codigo: prod?.codigo || '-',
        codExterno: (prod as any)?.codigoCliente || '', descricao: ip.produtoNome,
        ncm: ip.ncm || (prod as any)?.ncm || '', valorLiquido: vliq, pis: pisVal, cofins: cofinsVal,
        icmsOrigem: icmsOrig, icmsDestino: icmsDest, valorUnitario: ip.valorUnitario,
        valorTotal: ip.valorTotal, valorIPI: ip.valorTotal,
      });
    });
    (viewOrc.itensRolete || []).forEach((ir) => {
      const vliq = ir.valorPorPeca;
      const pisVal = +(vliq * taxaPIS).toFixed(2);
      const cofinsVal = +(vliq * taxaCOFINS).toFixed(2);
      const icmsOrig = +(vliq * taxaICMSOrig).toFixed(2);
      const icmsDest = +(vliq * taxaICMSDest).toFixed(2);
      const ipiVal = +(vliq * taxaIPI).toFixed(2);
      allPrintItems.push({
        item: idx++, qtd: ir.quantidade, codigo: ir.codigoProduto || ir.tipoRolete,
        codExterno: ir.codigoExterno || '', descricao: `Rolete ${ir.tipoRolete} - Tubo ø${ir.diametroTubo} Comp.${ir.comprimentoTubo}mm - Eixo ø${ir.diametroEixo} Comp.${ir.comprimentoEixo}mm${ir.tipoEncaixe ? ` - Enc: ${ir.tipoEncaixe}` : ''}${ir.medidaFresado ? ` ${ir.medidaFresado}` : ''}${ir.especificacaoRevestimento ? ` - Rev: ${ir.especificacaoRevestimento}` : ''}`,
        ncm: ir.ncm || '', valorLiquido: vliq, pis: pisVal, cofins: cofinsVal,
        icmsOrigem: icmsOrig, icmsDestino: icmsDest, valorUnitario: ir.valorPorPeca,
        valorTotal: ir.valorTotal, valorIPI: ir.valorTotal,
      });
    });

    const totals = allPrintItems.reduce((acc, i) => ({
      valorLiquido: acc.valorLiquido + i.valorLiquido * i.qtd,
      pis: acc.pis + i.pis * i.qtd,
      cofins: acc.cofins + i.cofins * i.qtd,
      icmsOrigem: acc.icmsOrigem + i.icmsOrigem * i.qtd,
      icmsDestino: acc.icmsDestino + i.icmsDestino * i.qtd,
      valorTotal: acc.valorTotal + i.valorTotal,
      valorIPI: acc.valorIPI + i.valorIPI,
    }), { valorLiquido: 0, pis: 0, cofins: 0, icmsOrigem: 0, icmsDestino: 0, valorTotal: 0, valorIPI: 0 });

    // Find vendedor info
    const usuarios = store.getUsuarios();
    const vendedorUser = usuarios.find(u => u.nome === viewOrc.vendedor);

    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden">
          <Button variant="outline" onClick={() => setView('list')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </Button>
        </div>

        <div className="bg-white text-black border rounded-lg p-6 mx-auto print:border-0 print:shadow-none print:p-4" style={{ maxWidth: '1200px' }}>
          {/* ===== HEADER: Logo+Rollerport left, QR+Cliente right ===== */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Rollerport" className="h-16 object-contain" />
              <div>
                <h2 className="text-base font-bold leading-tight">ROLLERPORT</h2>
                <p className="text-[10px] font-semibold">Fábrica de Roletes</p>
                <p className="text-[10px]">Rua João Marcos Pimenta Rocha, 16 – Pólo Industrial</p>
                <p className="text-[10px]">Franco da Rocha/SP – CEP: 07832-460</p>
                <p className="text-[10px]">CNPJ: 58.234.180/0001-56</p>
                <p className="text-[10px]">Tel: (11) 4441-3572 • contato@rollerport.com.br</p>
              </div>
              <div className="flex flex-col items-center ml-2">
                <img src={qrcode} alt="QR Code Rollerport" className="h-14 w-14 object-contain" />
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

          {/* ===== Spacer ===== */}
          <div className="h-6" />

          {/* ===== Orçamento info line ===== */}
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs border-y py-2">
            <span>Orçamento Nº: <strong>{viewOrc.numero}</strong></span>
            <span>Data: <strong>{viewOrc.dataOrcamento}</strong></span>
            <span>{vendedorUser?.genero === 'F' ? 'Vendedora' : (vendedorUser ? 'Vendedor' : 'Vendedor')}: <strong>{viewOrc.vendedor || '-'}</strong></span>
            {vendedorUser?.telefone && <span>Tel: <strong>{vendedorUser.telefone}</strong></span>}
            {vendedorUser?.whatsapp && <span>WhatsApp: <strong>{vendedorUser.whatsapp}</strong></span>}
            {vendedorUser?.email && <span>E-mail: <strong>{vendedorUser.email}</strong></span>}
            <span>Frete: <strong>{viewOrc.tipoFrete === 'CIF' ? 'CIF' : 'FOB'}</strong></span>
            <span>Pagamento: <strong>{viewOrc.condicaoPagamento || '-'}</strong></span>
          </div>

          {/* ===== Spacer ===== */}
          <div className="h-6" />

          {/* ===== TABLE ===== */}
          <table className="w-full text-[9px] border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1 text-center whitespace-nowrap">Item</th>
                <th className="border p-1 text-center whitespace-nowrap">Qtd</th>
                <th className="border p-1 text-center whitespace-nowrap">Código</th>
                <th className="border p-1 text-center whitespace-nowrap">Cód. Cliente</th>
                <th className="border p-1 text-left whitespace-nowrap" style={{minWidth: '180px'}}>Descrição</th>
                <th className="border p-1 text-right whitespace-nowrap">Vlr Unit.</th>
                <th className="border p-1 text-center whitespace-nowrap">NCM</th>
                <th className="border p-1 text-right whitespace-nowrap">Vlr Líq.</th>
                <th className="border p-1 text-right whitespace-nowrap">PIS</th>
                <th className="border p-1 text-right whitespace-nowrap">Cofins</th>
                <th className="border p-1 text-right whitespace-nowrap">ICMS Orig.</th>
                <th className="border p-1 text-right whitespace-nowrap">ICMS Dest.</th>
                <th className="border p-1 text-right whitespace-nowrap">Vlr Total</th>
                <th className="border p-1 text-right whitespace-nowrap">Vlr c/ IPI</th>
              </tr>
            </thead>
            <tbody>
              {allPrintItems.map((row) => (
                <tr key={row.item}>
                  <td className="border p-1 text-center">{String(row.item).padStart(2, '0')}</td>
                  <td className="border p-1 text-center">{row.qtd}</td>
                  <td className="border p-1 text-center">{row.codigo}</td>
                  <td className="border p-1 text-center">{row.codExterno || '-'}</td>
                  <td className="border p-1 text-left">{row.descricao}</td>
                  <td className="border p-1 text-right">{fmt(row.valorUnitario)}</td>
                  <td className="border p-1 text-center">{row.ncm || '-'}</td>
                  <td className="border p-1 text-right">{fmt(row.valorLiquido)}</td>
                  <td className="border p-1 text-right">{fmt(row.pis)}</td>
                  <td className="border p-1 text-right">{fmt(row.cofins)}</td>
                  <td className="border p-1 text-right">{fmt(row.icmsOrigem)}</td>
                  <td className="border p-1 text-right">{fmt(row.icmsDestino)}</td>
                  <td className="border p-1 text-right">{fmt(row.valorTotal)}</td>
                  <td className="border p-1 text-right">{fmt(row.valorIPI)}</td>
                </tr>
              ))}
              {/* TOTALS ROW */}
              <tr className="bg-gray-100 font-bold">
                <td className="border p-1 text-center" colSpan={2}>TOTAL</td>
                <td className="border p-1" colSpan={4}></td>
                <td className="border p-1 text-center"></td>
                <td className="border p-1 text-right">{fmt(totals.valorLiquido)}</td>
                <td className="border p-1 text-right">{fmt(totals.pis)}</td>
                <td className="border p-1 text-right">{fmt(totals.cofins)}</td>
                <td className="border p-1 text-right">{fmt(totals.icmsOrigem)}</td>
                <td className="border p-1 text-right">{fmt(totals.icmsDestino)}</td>
                <td className="border p-1 text-right">{fmt(totals.valorTotal)}</td>
                <td className="border p-1 text-right">{fmt(totals.valorIPI)}</td>
              </tr>
            </tbody>
          </table>

          {/* ===== Footer ===== */}
          <div className="mt-4 grid grid-cols-3 gap-4 text-[10px] border-t pt-3">
            <div>Previsão de Entrega: <strong>{viewOrc.previsaoEntrega ? `${viewOrc.previsaoEntrega} Dias Úteis` : '-'}</strong></div>
            <div>Condição de Pagamento: <strong>{viewOrc.condicaoPagamento || '-'}</strong></div>
            <div>Tipo de Frete: <strong>{viewOrc.tipoFrete === 'CIF' ? 'CIF (vendedor)' : 'FOB (comprador)'}</strong></div>
          </div>

          {/* PIX / Transferência data on print */}
          {(viewOrc.condicaoPagamento === 'PIX' || viewOrc.condicaoPagamento === 'Transferência Bancária') && (
            <div className="mt-3 border rounded p-3 text-[10px]">
              <p className="font-bold mb-1">Dados Bancários para {viewOrc.condicaoPagamento === 'PIX' ? 'PIX' : 'Transferência Bancária'}:</p>
              <p>BANCO SANTANDER (033)</p>
              <p>FERREIRA ROLETES IND. COM. SERV. LTDA (Rollerport)</p>
              <p>CNPJ: 10.311.350/0001-22</p>
              <p>Agência: 3744 | Conta Corrente: 130094436</p>
              {viewOrc.condicaoPagamento === 'PIX' && <p className="font-semibold mt-1">Chave PIX (CNPJ): 10.311.350/0001-22</p>}
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
            <div className="text-[10px] mt-2">Observação: <strong>{viewOrc.observacao}</strong></div>
          )}
          <div className="text-center text-[10px] mt-6">
            <p className="font-semibold">ROLLERPORT – Fábrica de Roletes</p>
            <p className="text-gray-500">Orçamento válido por 5 dias úteis.</p>
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
          {/* Cliente */}
          <div>
            <label className="text-xs text-primary font-medium">Cliente</label>
            <div className="flex gap-2 mt-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CNPJ, telefone, e-mail..."
                  value={clienteSearch}
                  onChange={e => { setClienteSearch(e.target.value); setClienteId(''); setShowClienteDropdown(true); }}
                  onFocus={() => setShowClienteDropdown(true)}
                  className="pl-10"
                />
                {showClienteDropdown && clienteSearch && !clienteId && (
                  <div className="absolute z-10 w-full border rounded mt-1 max-h-40 overflow-y-auto bg-card shadow-lg">
                    {filteredClientes.map(c => (
                      <button key={c.id} onClick={() => { setClienteId(c.id); setClienteSearch(c.nome); setShowClienteDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex justify-between">
                        <span className="font-medium">{c.nome}</span>
                        <span className="text-muted-foreground text-xs">{c.cnpj}</span>
                      </button>
                    ))}
                    {filteredClientes.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado</p>}
                  </div>
                )}
              </div>
              <Button variant="outline" size="icon" onClick={() => setShowCadCliente(true)} title="Cadastrar cliente">
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

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
              <p>BANCO SANTANDER</p>
              <p>FERREIRA ROLETES IND. COM. SERV. LTDA (Rollerport)</p>
              <p>CNPJ: 10.311.350/0001-22</p>
              <p>Agência: 3744 | Conta Corrente: 130094436</p>
              <p>PIX: 10.311.350/0001-22</p>
            </div>
          )}
          {condicaoPagamento === 'Transferência Bancária' && (
            <div className="bg-muted/20 rounded-lg p-3 border text-xs">
              <p className="font-semibold text-primary mb-1">Dados para Transferência Bancária:</p>
              <p>BANCO SANTANDER</p>
              <p>FERREIRA ROLETES IND. COM. SERV. LTDA (Rollerport)</p>
              <p>CNPJ: 10.311.350/0001-22</p>
              <p>Agência: 3744 | Conta Corrente: 130094436</p>
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
              <label className="text-xs text-primary font-medium">Comprador</label>
              <div className="flex gap-2">
                <select value={compradorSelecionado} onChange={e => setCompradorSelecionado(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Selecione...</option>
                  {clienteSelecionado?.compradores.map((comp, i) => (
                    <option key={i} value={comp.nome}>{comp.nome}</option>
                  ))}
                </select>
                <Button variant="outline" size="icon" onClick={() => setShowCadComprador(true)} title="Cadastrar comprador" disabled={!clienteId}>
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
            <div>
              <label className="text-xs text-primary font-medium">Descrição da Peça</label>
              <Input value={selectedProduto.nome} readOnly className="bg-muted/30" />
            </div>
            <div className="bg-muted/30 rounded p-3 mt-3 grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-xs text-primary">Valor Unit.</span><br /><strong>{fmt(selectedProduto.valor)}</strong></div>
              <div><span className="text-xs text-primary">Valor c/ Desc.</span><br /><strong>{fmt(selectedProduto.valor * (1 - produtoDesconto / 100))}</strong></div>
              <div><span className="text-xs text-primary">Total</span><br /><strong>{fmt(selectedProduto.valor * (1 - produtoDesconto / 100) * produtoQtd)}</strong></div>
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
            </div>
            <div className="bg-muted/30 rounded p-3 mt-3 grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-xs text-primary">Custo Unit.</span><br /><strong>{fmt(roleteItem.custo)}</strong></div>
              <div><span className="text-xs text-primary">Valor/Peça</span><br /><strong>{fmt(roleteItem.valorPorPeca)}</strong></div>
              <div><span className="text-xs text-primary">Total</span><br /><strong>{fmt(roleteItem.valorTotal)}</strong></div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={insertRolete} className="gap-2">✓ Inserir no Orçamento</Button>
              <Button variant="outline" onClick={() => setShowRoleteForm(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* ===== Itens do Orçamento ===== */}
        {(itensProduto.length > 0 || itensRolete.length > 0) && (
          <div className="border rounded-lg p-4 bg-card">
            <h3 className="font-semibold mb-3">Itens do Orçamento - {clienteSelecionado?.nome || clienteSearch || 'Cliente'}</h3>
            <div className="space-y-2">
              {itensProduto.map((item, i) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{produtos.find(p => p.id === item.produtoId)?.codigo || ''} – {item.produtoNome}</p>
                      <p className="text-xs text-muted-foreground">Qtd: {item.quantidade} • Valor/Peça: {fmt(item.valorUnitario)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-primary">{fmt(item.valorTotal)}</span>
                    <button onClick={() => {
                      const prod = produtos.find(p => p.id === item.produtoId);
                      if (prod) { setSelectedProduto(prod); setProdutoQtd(item.quantidade); setProdutoDesconto(0); }
                    }} className="text-muted-foreground hover:text-primary" title="Ver"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => {
                      const prod = produtos.find(p => p.id === item.produtoId);
                      if (prod) { setSelectedProduto(prod); setProdutoQtd(item.quantidade); setProdutoDesconto(0); setItensProduto(itensProduto.filter((_, idx) => idx !== i)); }
                    }} className="text-muted-foreground hover:text-primary" title="Editar"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => setItensProduto(itensProduto.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive" title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {itensRolete.map((item, i) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border">
                  <div className="flex items-center gap-3">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Rolete {item.tipoRolete} - Tubo ø{item.diametroTubo} Comp.{item.comprimentoTubo}mm - Eixo ø{item.diametroEixo} Comp.{item.comprimentoEixo}mm{item.tipoEncaixe ? ` - Enc: ${item.tipoEncaixe}` : ''}{item.medidaFresado ? ` ${item.medidaFresado}` : ''}{item.especificacaoRevestimento ? ` - Rev: ${item.especificacaoRevestimento}` : ''}</p>
                      <p className="text-xs text-muted-foreground">Qtd: {item.quantidade} • Valor/Peça: {fmt(item.valorPorPeca)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-primary">{fmt(item.valorTotal)}</span>
                    <button onClick={() => { setRoleteItem(item); setCodigoRolete(item.codigoProduto || ''); setShowRoleteForm(true); }} className="text-muted-foreground hover:text-primary" title="Ver"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => { setRoleteItem(item); setCodigoRolete(item.codigoProduto || ''); setShowRoleteForm(true); setItensRolete(itensRolete.filter((_, idx) => idx !== i)); }} className="text-muted-foreground hover:text-primary" title="Editar"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => setItensRolete(itensRolete.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive" title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
              <div className="flex justify-between"><h3 className="font-semibold text-lg">Cadastrar Cliente</h3><button onClick={() => setShowCadCliente(false)}><XIcon className="h-4 w-4" /></button></div>
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
                  <h4 className="font-semibold text-sm">Compradores</h4>
                  <Button variant="outline" size="sm" onClick={() => setCadCliente({ ...cadCliente, compradores: [...cadCliente.compradores, { nome: '', telefone: '', email: '', whatsapp: '', aniversario: '', redesSociais: '' }] })} className="gap-1"><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
                </div>
                {cadCliente.compradores.map((comp, idx) => (
                  <div key={idx} className="border rounded-lg p-3 mb-2 bg-muted/20">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Comprador {idx + 1}</span>
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
              <Button onClick={salvarCliente} className="w-full">Salvar Cliente</Button>
            </div>
          </div>
        )}

        {showCadComprador && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30">
            <div className="bg-card rounded-lg border p-6 w-full max-w-lg space-y-3">
              <div className="flex justify-between"><h3 className="font-semibold">Cadastrar Comprador</h3><button onClick={() => setShowCadComprador(false)}><XIcon className="h-4 w-4" /></button></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="text-xs text-muted-foreground">Nome</label><Input value={cadComprador.nome} onChange={e => setCadComprador({ ...cadComprador, nome: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Telefone</label><Input value={cadComprador.telefone} onChange={e => setCadComprador({ ...cadComprador, telefone: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">WhatsApp</label><Input value={cadComprador.whatsapp} onChange={e => setCadComprador({ ...cadComprador, whatsapp: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">E-mail</label><Input value={cadComprador.email} onChange={e => setCadComprador({ ...cadComprador, email: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Aniversário</label><Input type="date" value={cadComprador.aniversario || ''} onChange={e => setCadComprador({ ...cadComprador, aniversario: e.target.value })} /></div>
                <div className="col-span-2"><label className="text-xs text-muted-foreground">Redes Sociais</label><Input value={cadComprador.redesSociais || ''} onChange={e => setCadComprador({ ...cadComprador, redesSociais: e.target.value })} placeholder="Instagram, LinkedIn..." /></div>
              </div>
              <Button onClick={salvarComprador} className="w-full">Salvar Comprador</Button>
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
