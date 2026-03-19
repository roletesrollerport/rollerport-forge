import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { store } from '@/lib/store';
import { useUsuarios } from '@/hooks/useUsuarios';
import type { OrdemServico, StatusOS, ItemOS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Edit, Trash2, Printer, CheckCircle, XCircle, ArrowLeft, Search, Clock } from 'lucide-react';
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
  const { usuarios: dbUsuarios } = useUsuarios();
  const loggedUserId = localStorage.getItem('rp_logged_user');
  const currentUser = dbUsuarios.find(u => u.id === loggedUserId);

  const fullAccessRoles = ['master', 'SEO', 'admin', 'Admin', 'Administrador', 'administrador', 'adm/dono'];
  const isFullAccess = currentUser ? fullAccessRoles.includes(currentUser.nivel) : false;

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

  const toggleEtapa = (idx: number, etapa: string) => {
    const items = [...editItems];
    const item = items[idx] as IndexableItemOS;
    items[idx] = { ...item, [etapa]: !item[etapa] };
    setEditItems(items);
  };
  const updateItemField = (idx: number, field: string, value: string | number) => {
    const items = [...editItems]; items[idx] = { ...items[idx], [field]: value }; setEditItems(items);
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
      // Search by OS number, pedido number
      if (o.numero.includes(search) || o.pedidoNumero.includes(search)) return true;
      // Search by orcamento number
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

  const EtapasSection = ({ items, editable }: { items: ItemOS[], editable?: boolean }) => (
    <div className="mt-4 border-t pt-3">
      <h3 className="font-bold text-xs mb-2">ETAPAS DE PRODUÇÃO</h3>
      <div className="space-y-2">
        {items.map((item, itemIdx) => (
          <div key={itemIdx} className="flex items-center gap-4 border rounded p-2 bg-muted/20">
            <span className="text-xs font-semibold min-w-[60px]">Item {item.item}</span>
            {etapas.map(etapa => (
              <label key={etapa} className="flex items-center gap-1.5 text-xs">
                <input type="checkbox"
                  checked={(item as IndexableItemOS)[etapa] as boolean || false}
                  onChange={() => editable && toggleEtapa(itemIdx, etapa)}
                  readOnly={!editable}
                  className="h-4 w-4 rounded border-primary text-primary accent-primary"
                />
                <span className="font-medium uppercase">{etapa}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  const MateriaisSection = ({ editable }: { editable?: boolean }) => {
    const materiais = [
      ['TUBO', 'EIXO', 'CANECA'],
      ['ROLAMENTO', 'ANÉIS DE BORRACHA', 'LABIRINTO / RETENTOR'],
      ['ANEL ELÁSTICO', 'REVESTIMENTO SPIRAFLEX', 'REVESTIMENTO ANEIS'],
      ['BUCHA NYLON', 'TINTA', 'FLANGES / ENGRENAGENS'],
      ['ENCAIXE FAÇO / PORCAS / PARAFUSOS / ARRUELAS', '', ''],
    ];
    return (
      <div className="mt-6 border-t-2 pt-4">
        <h3 className="font-bold text-sm mb-3">MATERIAIS UTILIZADOS</h3>
        <div className="space-y-1">
          {materiais.map((row, ri) => (
            <div key={ri} className="grid grid-cols-3 gap-1">
              {row.map((mat, ci) => (
                <div key={ci} className={`border rounded p-2 min-h-[36px] ${!mat ? 'border-transparent' : ''}`}>
                  {mat && (
                    <>
                      <span className="font-semibold text-[10px] block">{mat}</span>
                      {editable ? (
                        <Input className="h-6 text-[10px] mt-1 border-dashed" placeholder="..." />
                      ) : (
                        <div className="h-5 border-b border-dashed mt-1" />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ========== PRINT VIEW ==========
  if (view === 'print' && current) {
    const pedido = store.getPedidos().find(p => p.id === current.pedidoId);
    const orcamento = pedido ? store.getOrcamentos().find(o => o.id === pedido.orcamentoId) : null;
    const vendedorNome = orcamento?.vendedor || 'Não informado';

    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden">
          <Button variant="outline" onClick={handleBack} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
        </div>
        <div className="bg-card border rounded-lg p-6 max-w-6xl mx-auto print:border-0 print:shadow-none print:max-w-none print:p-2">
          {/* Header: O.S. number top-left */}
          <div className="text-sm font-bold mb-1">O.S. Nº {current.numero}</div>
          <div className="grid grid-cols-4 gap-2 text-xs mb-2 border rounded p-2">
            <div><span className="font-semibold">EMPRESA:</span> {current.empresa}</div>
            <div><span className="font-semibold">VENDEDOR:</span> {vendedorNome}</div>
            <div><span className="font-semibold">PEDIDO:</span> {current.pedidoNumero}</div>
            <div><span className="font-semibold">EMISSÃO:</span> {current.emissao}</div>
            <div><span className="font-semibold">ENTREGA:</span> {current.entrega}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-4">
            <div><span className="font-semibold">DIAS PROPOSTOS:</span> {current.diasPropostos}</div>
            <div><span className="font-semibold">STATUS:</span> {current.status.replace('_', ' ')}</div>
          </div>

          <OSTable items={current.itens} />
          <EtapasSection items={current.itens} />
          <MateriaisSection />
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
          <EtapasSection items={current.itens} />
          <MateriaisSection editable />
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
          <EtapasSection items={editItems} editable />
          <MateriaisSection editable />
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

      <div className="border rounded-lg p-4 bg-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nº O.S., nº pedido, nº orçamento, empresa, comprador, CNPJ, telefone, email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th className="text-left p-3 font-medium">O.S.</th>
            <th className="text-left p-3 font-medium">Empresa</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Pedido</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Emissão</th>
            <th className="text-left p-3 font-medium hidden lg:table-cell">Entrega</th>
            <th className="text-left p-3 font-medium min-w-[150px]">Status</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Dias</th>
            <th className="p-3 w-56"></th>
          </tr></thead>
          <tbody>
            {filteredOrdens.map(os => {
              const pct = statusProgress[os.status] || 0;
              const days = daysSince(os.createdAt);
              const lastStatusChange = os.statusHistory?.length ? os.statusHistory[os.statusHistory.length - 1] : null;
              const daysInStatus = lastStatusChange ? daysSince(lastStatusChange.date) : days;
              return (
                <tr key={os.id} onClick={() => openView(os)} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                  <td className="p-3 font-mono font-medium">{os.numero}</td>
                  <td className="p-3">{os.empresa}</td>
                  <td className="p-3 hidden md:table-cell font-mono">{os.pedidoNumero}</td>
                  <td className="p-3 hidden md:table-cell">{os.emissao}</td>
                  <td className="p-3 hidden lg:table-cell">{os.entrega}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-2 flex-1" />
                      <span className={`text-xs font-medium whitespace-nowrap ${os.status === 'CONCLUIDA' ? 'text-success' : os.status === 'EM_ANDAMENTO' ? 'text-secondary' : 'text-muted-foreground'}`}>{os.status.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    <div className="flex flex-col text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Total: {days}d</span>
                      <span className="text-[10px]">No status: {daysInStatus}d</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(os); }} className="p-1.5 rounded hover:bg-muted" title="Editar"><Edit className="h-4 w-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); openPrint(os); }} className="p-1.5 rounded hover:bg-muted" title="Imprimir"><Printer className="h-4 w-4" /></button>
                      {os.status === 'ABERTA' && <button onClick={(e) => { e.stopPropagation(); updateStatus(os.id, 'EM_ANDAMENTO'); }} className="p-1.5 rounded hover:bg-muted text-primary" title="Aprovar"><CheckCircle className="h-4 w-4" /></button>}
                      {os.status === 'EM_ANDAMENTO' && <button onClick={(e) => { e.stopPropagation(); updateStatus(os.id, 'CONCLUIDA'); }} className="p-1.5 rounded hover:bg-muted text-success" title="Concluir"><CheckCircle className="h-4 w-4" /></button>}
                      <button onClick={(e) => { e.stopPropagation(); cancelarOS(os); }} className="p-1.5 rounded hover:bg-muted text-warning" title="Cancelar"><XCircle className="h-4 w-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteOS(os.id); }} className="p-1.5 rounded hover:bg-muted text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
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
