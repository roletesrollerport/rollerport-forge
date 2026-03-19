import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { store } from '@/lib/store';
import { useUsuarios } from '@/hooks/useUsuarios';
import type { OrdemServico, StatusOS, ItemOS, MateriaisItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Edit, Trash2, Printer, CheckCircle, XCircle, ArrowLeft, Search, Clock, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import ConfirmDialog from '@/components/ConfirmDialog';

const daysSince = (dateStr: string): number => {
  if (!dateStr) return 0;
  const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr.split('/').reverse().join('-'));
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
};

type View = 'list' | 'view' | 'edit' | 'print';

const statusProgress: Record<string, number> = { 'ABERTA': 33, 'EM_ANDAMENTO': 66, 'CONCLUIDA': 100 };

const emptyMateriais: MateriaisItem = {
  tubo: '', eixo: '', caneca: '', rolamento: '', aneisBorracha: '', labirintoRetentor: '',
  anelElastico: '', revestimentoSpiraflex: '', revestimentoAneis: '', buchaNylon: '', tinta: '',
  flangesEngrenagens: '', encaixeFaco: '', parafusos: '', porcas: '', arruelas: '',
};

const materiaisFields: { key: keyof MateriaisItem; label: string }[] = [
  { key: 'tubo', label: 'TUBO' },
  { key: 'eixo', label: 'EIXO' },
  { key: 'caneca', label: 'CANECA' },
  { key: 'rolamento', label: 'ROLAMENTO' },
  { key: 'aneisBorracha', label: 'ANÉIS DE BORRACHA' },
  { key: 'labirintoRetentor', label: 'LABIRINTO / RETENTOR' },
  { key: 'anelElastico', label: 'ANEL ELÁSTICO' },
  { key: 'revestimentoSpiraflex', label: 'REVESTIMENTO SPIRAFLEX' },
  { key: 'revestimentoAneis', label: 'REVESTIMENTO ANEIS' },
  { key: 'buchaNylon', label: 'BUCHA NYLON' },
  { key: 'tinta', label: 'TINTA' },
  { key: 'flangesEngrenagens', label: 'FLANGES / ENGRENAGENS' },
  { key: 'encaixeFaco', label: 'ENCAIXE FAÇO' },
  { key: 'parafusos', label: 'PARAFUSOS' },
  { key: 'porcas', label: 'PORCAS' },
  { key: 'arruelas', label: 'ARRUELAS' },
];

export default function ProducaoPage() {
  const navigate = useNavigate();
  const { id: urlId } = useParams();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [view, setView] = useState<View>('list');
  const [current, setCurrent] = useState<OrdemServico | null>(null);
  const [editItems, setEditItems] = useState<ItemOS[]>([]);
  const [search, setSearch] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<OrdemServico | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // Local materiais state for editing (per item index)
  const [materiaisLocal, setMateriaisLocal] = useState<Record<number, MateriaisItem>>({});
  const { usuarios: dbUsuarios } = useUsuarios();
  const loggedUserId = localStorage.getItem('rp_logged_user');
  const currentUser = dbUsuarios.find(u => u.id === loggedUserId);

  const fullAccessRoles = ['master', 'SEO', 'admin', 'Admin', 'Administrador', 'administrador', 'adm/dono'];
  const isFullAccess = currentUser ? fullAccessRoles.includes(currentUser.nivel) : true;

  const clientes = store.getClientes();
  const orcamentos = store.getOrcamentos();

  useEffect(() => {
    const load = () => {
      const ordensServico = store.getOrdensServico();
      setOrdens(ordensServico);

      if (urlId) {
        const os = ordensServico.find(o => o.id === urlId);
        if (os) {
          setCurrent(os);
          setView('view');
          // Initialize local materiais from saved data
          const mLocal: Record<number, MateriaisItem> = {};
          os.itens.forEach((item, idx) => {
            mLocal[idx] = { ...emptyMateriais, ...(item.materiais || {}) };
          });
          setMateriaisLocal(mLocal);
        }
      }
    };
    load();
    window.addEventListener('rp-data-synced', load);
    return () => window.removeEventListener('rp-data-synced', load);
  }, [urlId]);

  const saveOrdens = (updated: OrdemServico[]) => { store.saveOrdensServico(updated); setOrdens(updated); };

  const updateStatus = (id: string, status: StatusOS) => {
    const updated = ordens.map(o => {
      if (o.id !== id) return o;
      const history = [...(o.statusHistory || []), { status, date: new Date().toISOString() }];
      return { ...o, status, statusHistory: history };
    });
    saveOrdens(updated); toast.success('Status atualizado!');
  };

  const cancelarOS = (os: OrdemServico) => {
    setCancelTarget(os);
    setCancelMotivo('');
    setCancelDialogOpen(true);
  };

  const confirmCancelarOS = () => {
    if (!cancelTarget) return;
    if (!cancelMotivo.trim()) { toast.error('Informe o motivo do cancelamento!'); return; }
    saveOrdens(ordens.filter(o => o.id !== cancelTarget.id));
    const pedidos = store.getPedidos();
    store.savePedidos(pedidos.map(p => p.id === cancelTarget.pedidoId ? { ...p, status: 'PENDENTE' as const } : p));
    setCancelDialogOpen(false);
    toast.success('O.S. cancelada. Pedido voltou para pendente.'); navigate('/pedidos');
  };

  const deleteOS = (id: string) => { setDeleteConfirmId(id); };
  const confirmDeleteOS = () => {
    if (!deleteConfirmId) return;
    saveOrdens(ordens.filter(o => o.id !== deleteConfirmId));
    setDeleteConfirmId(null); toast.success('O.S. excluída!');
  };

  const openView = (os: OrdemServico) => { navigate(`/producao/${os.id}`); };
  const openEdit = (os: OrdemServico) => { setCurrent(os); setEditItems([...os.itens]); setView('edit'); };
  const openPrint = (os: OrdemServico) => { setCurrent(os); setView('print'); };

  const saveEdit = () => {
    if (!current) return;
    saveOrdens(ordens.map(o => o.id === current.id ? { ...o, itens: editItems } : o));
    setCurrent({ ...current, itens: editItems });
    setView('view');
    toast.success('O.S. atualizada!');
  };

  const handleBack = () => {
    navigate('/producao');
    setView('list');
    setCurrent(null);
  };

  type IndexableItemOS = ItemOS & { [key: string]: string | number | boolean };

  // Toggle etapa checkbox and save immediately (works from view and edit)
  const toggleEtapaAndSave = (itemIdx: number, etapa: string) => {
    if (!current) return;
    const updatedItens = current.itens.map((item, idx) => {
      if (idx !== itemIdx) return item;
      return { ...item, [etapa]: !(item as IndexableItemOS)[etapa] };
    });
    // Calculate status based on etapas
    const etapaKeys = ['corte', 'torno', 'fresa', 'solda', 'pintura', 'montagem'];
    const allCompleted = updatedItens.every(item => 
      etapaKeys.every(e => (item as IndexableItemOS)[e])
    );
    const anyStarted = updatedItens.some(item => 
      etapaKeys.some(e => (item as IndexableItemOS)[e])
    );
    
    let newStatus: StatusOS = current.status;
    if (allCompleted) {
      newStatus = 'CONCLUIDA';
    } else if (anyStarted && current.status === 'ABERTA') {
      newStatus = 'EM_ANDAMENTO';
    }

    const updatedOS: OrdemServico = { ...current, itens: updatedItens, status: newStatus };
    if (newStatus !== current.status) {
      updatedOS.statusHistory = [...(current.statusHistory || []), { status: newStatus, date: new Date().toISOString() }];
    }
    
    const updatedOrdens = ordens.map(o => o.id === current.id ? updatedOS : o);
    saveOrdens(updatedOrdens);
    setCurrent(updatedOS);
    toast.success('Etapa atualizada!');
  };

  const toggleEtapa = (idx: number, etapa: string) => {
    const items = [...editItems];
    const item = items[idx] as IndexableItemOS;
    items[idx] = { ...item, [etapa]: !item[etapa] };
    setEditItems(items);
  };

  const updateItemField = (idx: number, field: string, value: string | number) => {
    const items = [...editItems]; items[idx] = { ...items[idx], [field]: value }; setEditItems(items);
  };

  // Materiais handlers
  const updateMaterialField = (itemIdx: number, key: keyof MateriaisItem, value: string) => {
    setMateriaisLocal(prev => ({
      ...prev,
      [itemIdx]: { ...(prev[itemIdx] || { ...emptyMateriais }), [key]: value },
    }));
  };

  const saveMateriais = (itemIdx: number) => {
    if (!current) return;
    const mat = materiaisLocal[itemIdx] || { ...emptyMateriais };
    const updatedItens = current.itens.map((item, idx) => 
      idx === itemIdx ? { ...item, materiais: mat } : item
    );
    const updatedOS = { ...current, itens: updatedItens };
    const updatedOrdens = ordens.map(o => o.id === current.id ? updatedOS : o);
    saveOrdens(updatedOrdens);
    setCurrent(updatedOS);
    toast.success(`Materiais do Item ${current.itens[itemIdx].item} salvos!`);
  };

  const clearMaterialField = (itemIdx: number, key: keyof MateriaisItem) => {
    setMateriaisLocal(prev => ({
      ...prev,
      [itemIdx]: { ...(prev[itemIdx] || { ...emptyMateriais }), [key]: '' },
    }));
  };

  // Comprehensive search
  const clienteMatchesSearch = (empresa: string, s: string) => {
    const cli = clientes.find(c => c.nome === empresa);
    if (!cli) return empresa?.toLowerCase().includes(s.toLowerCase());
    const compradorMatch = (cli.compradores || []).some(comp =>
      comp.nome?.toLowerCase().includes(s.toLowerCase()) || comp.telefone?.includes(s) || comp.email?.toLowerCase().includes(s.toLowerCase())
    );
    return cli.nome?.toLowerCase().includes(s.toLowerCase()) || cli.cnpj?.includes(s) || cli.email?.toLowerCase().includes(s.toLowerCase()) ||
      cli.telefone?.includes(s) || cli.endereco?.toLowerCase().includes(s.toLowerCase()) || compradorMatch;
  };

  const nameMatch = (vendedorField: string, userName: string) => {
    const a = (vendedorField || '').trim().toLowerCase();
    const b = (userName || '').trim().toLowerCase();
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a) || a.split(' ')[0] === b.split(' ')[0];
  };

  const filteredOrdens = ordens
    .filter(o => {
      if (isFullAccess) return true;
      const pedido = store.getPedidos().find(p => p.id === o.pedidoId);
      const orc = store.getOrcamentos().find(orc => orc.id === pedido?.orcamentoId);
      const vendor = orc?.vendedor || '';
      return nameMatch(vendor, currentUser?.nome || '');
    })
    .filter(o => {
      if (!search) return true;
      const s = search.toLowerCase();
      if (o.numero.includes(search) || o.pedidoNumero.includes(search)) return true;
      const pedido = store.getPedidos().find(p => p.id === o.pedidoId);
      if (pedido?.orcamentoNumero?.includes(search)) return true;
      return clienteMatchesSearch(o.empresa, search);
    });

  const etapas = ['corte', 'torno', 'fresa', 'solda', 'pintura', 'montagem'];

  const OSTable = ({ items, editable }: { items: ItemOS[], editable?: boolean }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead><tr className="border-b-2 bg-muted/50">
          <th className="p-2 text-left font-semibold">ITEM</th>
          <th className="p-2 text-left font-semibold">QTD</th>
          <th className="p-2 text-left font-semibold">TIPO</th>
          <th className="p-2 text-left font-semibold">ø TUBO</th>
          <th className="p-2 text-left font-semibold">PAREDE</th>
          <th className="p-2 text-left font-semibold">COMP. TUBO</th>
          <th className="p-2 text-left font-semibold">COMP. EIXO</th>
          <th className="p-2 text-left font-semibold">ø EIXO</th>
           <th className="p-2 text-left font-semibold">TIPO ENCAIXE</th>
           <th className="p-2 text-left font-semibold">MED. ENCAIXE</th>
           <th className="p-2 text-left font-semibold">REVESTIMENTO</th>
        </tr></thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-b last:border-0">
              <td className="p-2">{item.item}</td>
              <td className="p-2">{editable ? <Input type="number" className="h-7 w-14 text-xs" value={item.quantidade} onChange={e => updateItemField(idx, 'quantidade', +e.target.value)} /> : item.quantidade}</td>
              <td className="p-2 font-medium">{item.tipo}</td>
              <td className="p-2">{item.diametroTubo}</td>
              <td className="p-2">{item.paredeTubo}</td>
              <td className="p-2">{item.comprimentoTubo}</td>
              <td className="p-2">{item.comprimentoEixo}</td>
              <td className="p-2">{item.diametroEixo}</td>
              <td className="p-2">{item.tipoEncaixe}</td>
               <td className="p-2">{editable ? <Input className="h-7 w-16 text-xs" value={item.encaixeFresado} onChange={e => updateItemField(idx, 'encaixeFresado', e.target.value)} /> : item.encaixeFresado}</td>
               <td className="p-2">{item.revestimento || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Etapas section for VIEW mode — directly toggleable and saving
  const EtapasSectionView = ({ items }: { items: ItemOS[] }) => (
    <div className="mt-4 border-t pt-3">
      <h3 className="font-bold text-xs mb-2">ETAPAS DE PRODUÇÃO</h3>
      <div className="space-y-2">
        {items.map((item, itemIdx) => {
          const checkedCount = etapas.filter(e => (item as IndexableItemOS)[e]).length;
          return (
            <div key={itemIdx} className="flex items-center gap-4 border rounded p-2 bg-muted/20">
              <span className="text-xs font-semibold min-w-[60px]">Item {item.item}</span>
              {etapas.map(etapa => (
                <label key={etapa} className="flex items-center gap-1.5 text-xs cursor-pointer select-none group">
                  <input type="checkbox"
                    checked={(item as IndexableItemOS)[etapa] as boolean || false}
                    onChange={() => toggleEtapaAndSave(itemIdx, etapa)}
                    className="h-4 w-4 rounded border-primary text-primary accent-primary cursor-pointer"
                  />
                  <span className={`font-medium uppercase ${(item as IndexableItemOS)[etapa] ? 'text-green-600' : ''}`}>{etapa}</span>
                </label>
              ))}
              <span className="ml-auto text-[10px] text-muted-foreground font-medium">
                {checkedCount}/{etapas.length}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Etapas section for EDIT mode
  const EtapasSectionEdit = ({ items }: { items: ItemOS[] }) => (
    <div className="mt-4 border-t pt-3">
      <h3 className="font-bold text-xs mb-2">ETAPAS DE PRODUÇÃO</h3>
      <div className="space-y-2">
        {items.map((item, itemIdx) => (
          <div key={itemIdx} className="flex items-center gap-4 border rounded p-2 bg-muted/20">
            <span className="text-xs font-semibold min-w-[60px]">Item {item.item}</span>
            {etapas.map(etapa => (
              <label key={etapa} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <input type="checkbox"
                  checked={(item as IndexableItemOS)[etapa] as boolean || false}
                  onChange={() => toggleEtapa(itemIdx, etapa)}
                  className="h-4 w-4 rounded border-primary text-primary accent-primary cursor-pointer"
                />
                <span className="font-medium uppercase">{etapa}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  // Materiais section - render function (NOT a component) to avoid losing input focus
  const renderMateriais = (items: ItemOS[], editable?: boolean) => (
    <div className="mt-6 border-t-2 pt-4">
      <h3 className="font-bold text-sm mb-3">MATERIAIS UTILIZADOS</h3>
      {items.map((item, itemIdx) => {
        const mat = materiaisLocal[itemIdx] || item.materiais || { ...emptyMateriais };
        return (
          <div key={itemIdx} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-xs text-muted-foreground">MATERIAIS - ITEM {item.item}</h4>
              {editable && (
                <div className="flex gap-1">
                  <button 
                    onClick={() => saveMateriais(itemIdx)}
                    className="p-1.5 rounded hover:bg-green-50 text-green-600 border border-green-200" 
                    title="Salvar materiais"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {materiaisFields.map(({ key, label }) => (
                <div key={key} className="border rounded p-2.5 min-h-[70px]">
                  <span className="font-semibold text-xs block mb-1">{label}</span>
                  {editable ? (
                    <div className="flex items-center gap-1.5">
                      <input 
                        className="h-9 text-sm border border-dashed rounded px-2 flex-1 w-full bg-background focus:outline-none focus:ring-2 focus:ring-ring" 
                        placeholder="Informar..." 
                        value={mat[key] || ''}
                        onChange={e => updateMaterialField(itemIdx, key, e.target.value)}
                      />
                      {mat[key] && (
                        <button
                          onClick={() => clearMaterialField(itemIdx, key)}
                          className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 shrink-0"
                          title="Limpar campo"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm mt-1 min-h-[28px] border-b border-dashed py-1">
                      {(item.materiais && item.materiais[key]) || '...'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ========== PRINT VIEW ==========
  if (view === 'print' && current) {
    const pedido = store.getPedidos().find(p => p.id === current.pedidoId);
    const orcamento = pedido ? store.getOrcamentos().find(o => o.id === pedido.orcamentoId) : null;
    const vendedorNome = orcamento?.vendedor || 'Não informado';

    // Print materiais fields for compact layout — 2 rows × 8 columns  
    const printMateriaisRow1: { key: keyof MateriaisItem; label: string }[] = [
      { key: 'tubo', label: 'TUBO' },
      { key: 'eixo', label: 'EIXO' },
      { key: 'caneca', label: 'CANECA' },
      { key: 'rolamento', label: 'ROLAMENTO' },
      { key: 'aneisBorracha', label: 'ANÉIS DE BORRACHA' },
      { key: 'labirintoRetentor', label: 'LABIRINTO/RETENTOR' },
      { key: 'anelElastico', label: 'ANEL ELÁSTICO' },
      { key: 'revestimentoSpiraflex', label: 'REVEST. SPIRAFLEX' },
    ];
    const printMateriaisRow2: { key: keyof MateriaisItem; label: string }[] = [
      { key: 'revestimentoAneis', label: 'REVEST. ANEIS' },
      { key: 'buchaNylon', label: 'BUCHA NYLON' },
      { key: 'tinta', label: 'TINTA' },
      { key: 'flangesEngrenagens', label: 'FLANGES/ENGREN.' },
      { key: 'encaixeFaco', label: 'ENCAIXE FAÇO' },
      { key: 'parafusos', label: 'PARAFUSOS' },
      { key: 'porcas', label: 'PORCAS' },
      { key: 'arruelas', label: 'ARRUELAS' },
    ];

    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden">
          <Button variant="outline" onClick={handleBack} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
        </div>
        <div className="bg-card border rounded-lg p-6 max-w-6xl mx-auto print:border-0 print:shadow-none print:max-w-none print:p-2">
          {/* Header */}
          <div className="text-sm font-bold mb-1">O.S. Nº {current.numero}</div>
          <div className="grid grid-cols-4 gap-2 text-xs mb-2 border rounded p-2">
            <div><span className="font-semibold">EMPRESA:</span><br />{current.empresa}</div>
            <div><span className="font-semibold">VENDEDOR:</span><br />{vendedorNome}</div>
            <div><span className="font-semibold">PEDIDO:</span><br />{current.pedidoNumero}</div>
            <div><span className="font-semibold">EMISSÃO:</span><br />{current.emissao}</div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs mb-4 border rounded p-2">
            <div><span className="font-semibold">ENTREGA:</span><br />{current.entrega}</div>
            <div><span className="font-semibold">DIAS PROPOSTOS:</span><br />{current.diasPropostos}</div>
            <div><span className="font-semibold">STATUS:</span><br />{current.status.replace('_', ' ')}</div>
          </div>

          {/* Per-item: table + materials */}
          {current.itens.map((item, itemIdx) => {
            const mat = item.materiais || { ...emptyMateriais };
            return (
              <div key={itemIdx} className="mb-4">
                <h3 className="font-bold text-xs mb-1 mt-2">DADOS DO ITEM {item.item}</h3>
                <table className="w-full text-xs border-collapse border mb-1">
                  <thead><tr className="border-b-2 bg-muted/50">
                    <th className="p-1.5 text-left font-semibold border">ITEM</th>
                    <th className="p-1.5 text-left font-semibold border">QTD</th>
                    <th className="p-1.5 text-left font-semibold border">TIPO</th>
                    <th className="p-1.5 text-left font-semibold border">Ø TUBO</th>
                    <th className="p-1.5 text-left font-semibold border">PAREDE</th>
                    <th className="p-1.5 text-left font-semibold border">COMP. TUBO</th>
                    <th className="p-1.5 text-left font-semibold border">COMP. EIXO</th>
                    <th className="p-1.5 text-left font-semibold border">Ø EIXO</th>
                    <th className="p-1.5 text-left font-semibold border">TIPO ENCAIXE</th>
                    <th className="p-1.5 text-left font-semibold border">MED. ENCAIXE</th>
                    <th className="p-1.5 text-left font-semibold border">REVESTIMENTO</th>
                  </tr></thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-1.5 border text-center">{item.item}</td>
                      <td className="p-1.5 border text-center">{item.quantidade}</td>
                      <td className="p-1.5 border text-center font-medium">{item.tipo}</td>
                      <td className="p-1.5 border text-center">{item.diametroTubo}</td>
                      <td className="p-1.5 border text-center">{item.paredeTubo}</td>
                      <td className="p-1.5 border text-center">{item.comprimentoTubo}</td>
                      <td className="p-1.5 border text-center">{item.comprimentoEixo}</td>
                      <td className="p-1.5 border text-center">{item.diametroEixo}</td>
                      <td className="p-1.5 border text-center font-medium">{item.tipoEncaixe}</td>
                      <td className="p-1.5 border text-center">{item.encaixeFresado || '-'}</td>
                      <td className="p-1.5 border text-center">{item.revestimento || '-'}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Materiais inline */}
                <div className="border rounded p-1.5 mt-1">
                  <span className="font-bold text-[8px] block mb-0.5">MATERIAIS UTILIZADOS (ITEM {item.item})</span>
                  <div className="grid grid-cols-8 gap-0.5 text-[8px]">
                    {printMateriaisRow1.map(({ key, label }) => (
                      <div key={key} className="border rounded px-1 py-0.5 min-h-[22px] flex flex-col justify-center">
                        <span className="font-semibold block leading-tight">{label}:</span>
                        <span className="truncate">{mat[key] || '...'}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-8 gap-0.5 text-[8px] mt-0.5">
                    {printMateriaisRow2.map(({ key, label }) => (
                      <div key={key} className="border rounded px-1 py-0.5 min-h-[22px] flex flex-col justify-center">
                        <span className="font-semibold block leading-tight">{label}:</span>
                        <span className="truncate">{mat[key] || '...'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <style>{`@media print { @page { size: landscape; margin: 0.3cm; } body { -webkit-print-color-adjust: exact; font-size: 9px; } .print\\:hidden { display: none !important; } }`}</style>
      </div>
    );
  }

  // ========== VIEW ==========
  if (view === 'view' && current) {
    const pedido = store.getPedidos().find(p => p.id === current.pedidoId);
    const orcamento = pedido ? store.getOrcamentos().find(o => o.id === pedido.orcamentoId) : null;
    const vendedorNome = orcamento?.vendedor || 'Não informado';

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBack} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          <Button variant="outline" onClick={() => openPrint(current)} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
        </div>
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-bold mb-4">O.S. {current.numero}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-6">
            <div><span className="text-muted-foreground">Empresa:</span> <strong>{current.empresa}</strong></div>
            <div><span className="text-muted-foreground">Vendedor:</span> <strong>{vendedorNome}</strong></div>
            <div><span className="text-muted-foreground">Pedido:</span> <strong>{current.pedidoNumero}</strong></div>
            <div><span className="text-muted-foreground">Emissão:</span> <strong>{current.emissao}</strong></div>
            <div><span className="text-muted-foreground">Entrega:</span> <strong>{current.entrega}</strong></div>
            <div><span className="text-muted-foreground">Dias Propostos:</span> <strong>{current.diasPropostos}</strong></div>
            <div><span className="text-muted-foreground">Status:</span> <strong>{current.status}</strong></div>
          </div>
          <OSTable items={current.itens} />
          <EtapasSectionView items={current.itens} />
          {renderMateriais(current.itens, true)}
        </div>
      </div>
    );
  }

  // ========== EDIT ==========
  if (view === 'edit' && current) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Editar O.S. {current.numero}</h2>
          <Button variant="outline" onClick={handleBack}>Cancelar</Button>
        </div>
        <div className="bg-card border rounded-lg p-6">
          <OSTable items={editItems} editable />
          <EtapasSectionEdit items={editItems} />
          {renderMateriais(editItems, true)}
          <div className="flex gap-2 mt-4">
            <Button onClick={saveEdit}>Salvar Alterações</Button>
            <Button variant="outline" onClick={handleBack}>Cancelar</Button>
          </div>
        </div>
      </div>
    );
  }

  // ========== LIST ==========
  return (
    <div className="space-y-6">
      <div><h1 className="page-header">Produção</h1><p className="page-subtitle">Ordens de serviço e acompanhamento</p></div>

      <div className="border rounded-lg p-4 bg-card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nº O.S., nº pedido, nº orçamento, empresa, comprador, CNPJ, telefone, email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th className="text-left p-3 px-6 font-medium w-[120px]">O.S.</th>
            <th className="text-left p-3 font-medium w-[100px]">Usuário</th>
            <th className="text-left p-3 font-medium w-[200px]">Empresa</th>
            <th className="text-left p-3 font-medium hidden md:table-cell w-[100px]">Pedido</th>
            <th className="text-left p-3 font-medium hidden md:table-cell w-[90px]">Emissão</th>
            <th className="text-left p-3 font-medium hidden lg:table-cell w-[90px]">Entrega</th>
            <th className="text-left p-3 font-medium w-[550px]">Status</th>
            <th className="text-left p-3 font-medium hidden md:table-cell w-[100px]">Dias</th>
            <th className="p-3 px-6 w-44 text-right">Ações</th>
          </tr></thead>
          <tbody>
            {filteredOrdens.map(os => {
              const pct = statusProgress[os.status] || 0;
              const days = daysSince(os.createdAt);
              const lastStatusChange = os.statusHistory?.length ? os.statusHistory[os.statusHistory.length - 1] : null;
              const daysInStatus = lastStatusChange ? daysSince(lastStatusChange.date) : days;
              return (
                <tr key={os.id} onClick={() => openView(os)} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer whitespace-nowrap">
                  <td className="p-3 px-6 font-mono font-medium text-[11px] w-[120px]">{os.numero}</td>
                  <td className="p-3 text-[10px] text-muted-foreground truncate w-[100px]" title={os.vendedor || '-'}>{os.vendedor || '-'}</td>
                  <td className="p-3 font-medium text-xs w-[200px] truncate">{os.empresa ? os.empresa.split(' ')[0] : '-'}</td>
                  <td className="p-3 hidden md:table-cell font-mono text-[10px] w-[100px]">{os.pedidoNumero}</td>
                  <td className="p-3 hidden md:table-cell text-[10px] w-[90px]">
                    {os.emissao ? (
                      (() => {
                        const [y, m, d] = os.emissao.split('-');
                        return `${d}/${m}/${y.slice(-2)}`;
                      })()
                    ) : '-'}
                  </td>
                  <td className="p-3 hidden lg:table-cell text-[10px] w-[90px]">{os.entrega}</td>
                  <td className="p-3 w-[550px]">
                    <div className="space-y-1">
                      {(() => {
                        const totalEtapas = os.itens.length * etapas.length;
                        const concluídas = os.itens.reduce((acc, item) => {
                          return acc + etapas.filter(e => (item as any)[e]).length;
                        }, 0);
                        const percent = totalEtapas > 0 ? (concluídas / totalEtapas) * 100 : 0;
                        
                        // Get names of completed stages (unique)
                        const completedNames = Array.from(new Set(
                          os.itens.flatMap(item => etapas.filter(e => (item as any)[e]))
                        )).map(e => e.toUpperCase()).join(', ');

                        return (
                          <>
                            <div className="flex items-center gap-1.5">
                              <div className="w-24"><Progress value={percent} className="h-1.5" /></div>
                              <span className={`text-[10px] font-bold ${os.status === 'CONCLUIDA' ? 'text-success' : os.status === 'EM_ANDAMENTO' ? 'text-secondary' : 'text-muted-foreground'}`}>
                                {os.status.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="flex flex-col text-[10px] text-muted-foreground leading-tight whitespace-nowrap overflow-hidden">
                              <span className="font-semibold">{concluídas}/{totalEtapas} etapas concluídas</span>
                              {completedNames && <span className="truncate" title={completedNames}>{completedNames}</span>}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="p-3 hidden md:table-cell w-[100px]">
                    <div className="flex flex-col text-[10px] text-muted-foreground leading-tight">
                      <span className="flex items-center gap-1 font-medium"><Clock className="h-2.5 w-2.5" /> Total: {days}d</span>
                      <span className="opacity-70 text-[9px]">Status: {daysInStatus}d</span>
                    </div>
                  </td>
                  <td className="p-3 px-6 w-44" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-0.5 justify-end">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(os); }} className="p-1 rounded hover:bg-muted" title="Editar"><Edit className="h-3.5 w-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); openPrint(os); }} className="p-1 rounded hover:bg-muted" title="Imprimir"><Printer className="h-3.5 w-3.5" /></button>
                      {os.status === 'ABERTA' && <button onClick={(e) => { e.stopPropagation(); updateStatus(os.id, 'EM_ANDAMENTO'); }} className="p-1 rounded hover:bg-muted text-primary" title="Aprovar"><CheckCircle className="h-3.5 w-3.5" /></button>}
                      {os.status === 'EM_ANDAMENTO' && <button onClick={(e) => { e.stopPropagation(); updateStatus(os.id, 'CONCLUIDA'); }} className="p-1 rounded hover:bg-muted text-success" title="Concluir"><CheckCircle className="h-3.5 w-3.5" /></button>}
                      <button onClick={(e) => { e.stopPropagation(); cancelarOS(os); }} className="p-1 rounded hover:bg-muted text-orange-500" title="Cancelar"><XCircle className="h-3.5 w-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteOS(os.id); }} className="p-1 rounded hover:bg-muted text-destructive" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredOrdens.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhuma O.S. criada.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Dialog de cancelamento */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar O.S. {cancelTarget?.numero}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Informe o motivo do cancelamento antes de prosseguir:</p>
            <Textarea 
              value={cancelMotivo} 
              onChange={e => setCancelMotivo(e.target.value)} 
              placeholder="Motivo do cancelamento..." 
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Voltar</Button>
              <Button variant="destructive" onClick={confirmCancelarOS}>Confirmar Cancelamento</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
        title="Confirmar Exclusão de O.S."
        description="Tem certeza que deseja excluir esta ordem de serviço? Esta ação não pode ser desfeita."
        confirmLabel="Confirmar Exclusão"
        onConfirm={confirmDeleteOS}
      />
    </div>
  );
}
