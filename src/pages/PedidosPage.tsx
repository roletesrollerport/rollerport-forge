import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { store } from '@/lib/store';
import { useUsuarios } from '@/hooks/useUsuarios';
import type { Pedido, StatusPedido, Orcamento } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Factory, Eye, Edit, Trash2, Search, ShoppingCart, XCircle, Printer, ArrowLeft, Clock, Calendar, Truck, ClipboardList, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { AcompanhamentoPedidosModal } from '@/components/AcompanhamentoPedidosModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import logo from '@/assets/logo.png';

const daysSince = (dateStr: string): number => {
  if (!dateStr) return 0;
  const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr.split('/').reverse().join('-'));
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
};

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

const getTechnicalDescription = (item: any) => {
  if (item.produtoNome) return item.produtoNome;
  const parts = [];
  if (item.tipoRolete) parts.push(`Rolete ${item.tipoRolete}`);
  if (item.diametroTubo) parts.push(`ø${item.diametroTubo}x${item.paredeTubo}`);
  if (item.comprimentoTubo) parts.push(`Tubo: ${item.comprimentoTubo}mm`);
  if (item.comprimentoEixo) parts.push(`Eixo: ø${item.diametroEixo}x${item.comprimentoEixo}mm`);
  if (item.tipoEncaixe) parts.push(`Encaixe: ${item.tipoEncaixe}${item.medidaFresado ? ` (${item.medidaFresado})` : ''}`);
  if (item.especificacaoRevestimento) parts.push(`Rev: ${item.especificacaoRevestimento}`);
  return parts.join(' • ');
};

// ========== EDIT VIEW ==========
function PedidoEditView({ pedido, orcamentos, pedidos, setOrcamentos, setPedidos, setCurrentPedido, setView }: {
  pedido: Pedido; orcamentos: Orcamento[]; pedidos: Pedido[];
  setOrcamentos: (o: Orcamento[]) => void; setPedidos: (p: Pedido[]) => void;
  setCurrentPedido: (p: Pedido) => void; setView: (v: 'list' | 'view' | 'print') => void;
}) {
  const orc = orcamentos.find(o => o.id === pedido.orcamentoId);
  const [editOrc, setEditOrc] = useState<Orcamento | null>(orc ? { ...orc, itensRolete: [...(orc.itensRolete || [])], itensProduto: [...(orc.itensProduto || [])] } : null);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState<{ type: 'rolete' | 'produto'; idx: number } | null>(null);

  const saveOrcChanges = () => {
    if (!editOrc) return;
    const itensR = editOrc.itensRolete.map(ir => ({ ...ir, valorTotal: ir.valorPorPeca * ir.quantidade }));
    const itensP = editOrc.itensProduto.map(ip => ({ ...ip, valorTotal: ip.valorUnitario * ip.quantidade }));
    const valorTotal = itensR.reduce((s, i) => s + i.valorTotal, 0) + itensP.reduce((s, i) => s + i.valorTotal, 0);
    const updatedOrc = { ...editOrc, itensRolete: itensR, itensProduto: itensP, valorTotal };
    const updatedOrcs = orcamentos.map(o => o.id === updatedOrc.id ? updatedOrc : o);
    store.saveOrcamentos(updatedOrcs); setOrcamentos(updatedOrcs);
    const updatedPedido = { ...pedido, valorTotal };
    const updatedPedidos = pedidos.map(p => p.id === updatedPedido.id ? updatedPedido : p);
    store.savePedidos(updatedPedidos); setPedidos(updatedPedidos); setCurrentPedido(updatedPedido);
    toast.success('Pedido atualizado!');
  };

  const updateRoleteItem = (idx: number, field: string, value: any) => {
    if (!editOrc) return;
    const items = [...editOrc.itensRolete]; items[idx] = { ...items[idx], [field]: value };
    setEditOrc({ ...editOrc, itensRolete: items });
  };
  const updateProdutoItem = (idx: number, field: string, value: any) => {
    if (!editOrc) return;
    const items = [...editOrc.itensProduto]; items[idx] = { ...items[idx], [field]: value };
    setEditOrc({ ...editOrc, itensProduto: items });
  };
  const confirmDeleteItem = () => {
    if (!editOrc || !deleteItemConfirm) return;
    if (deleteItemConfirm.type === 'rolete') {
      setEditOrc({ ...editOrc, itensRolete: editOrc.itensRolete.filter((_, i) => i !== deleteItemConfirm.idx) });
    } else {
      setEditOrc({ ...editOrc, itensProduto: editOrc.itensProduto.filter((_, i) => i !== deleteItemConfirm.idx) });
    }
    setDeleteItemConfirm(null);
    toast.success('Item removido!');
  };

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="flex gap-2 mobile-btn-scroll">
        <Button variant="outline" onClick={() => setView('list')} className="gap-2 shrink-0"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        <Button variant="outline" onClick={() => setView('print')} className="gap-2 shrink-0"><Printer className="h-4 w-4" /> Imprimir</Button>
        <Button onClick={saveOrcChanges} className="gap-2 shrink-0">Salvar Alterações</Button>
      </div>

      <div className="bg-card border rounded-xl shadow-lg overflow-hidden">
        {/* Card header */}
        <div className="bg-primary/5 border-b px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-lg sm:text-xl font-black text-primary flex items-center gap-3">
            <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
            Pedido {pedido.numero}
            <Badge variant="outline" className="ml-auto font-mono bg-background text-xs">O.S. Pendente</Badge>
          </h2>
        </div>

        <div className="p-4 sm:p-6">
          {/* ===== HEADER GRID - Modern 6-field layout ===== */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6 mb-8 bg-muted/20 rounded-xl p-4 border">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block">Nº Pedido</span>
              <p className="font-black text-sm font-mono text-primary">{pedido.numero}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block">Cliente</span>
              <p className="font-bold text-sm break-words" title={pedido.clienteNome}>{pedido.clienteNome}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block">Vendedor</span>
              <p className="font-bold text-sm">{pedido.vendedor || orc?.vendedor || '-'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block">Nº Orçamento</span>
              <p className="font-bold font-mono text-sm text-blue-600">{pedido.orcamentoNumero || '-'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block">Data Emissão</span>
              <p className="font-bold text-sm flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> {pedido.createdAt}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block">Prazo Entrega</span>
              <p className="font-bold text-sm flex items-center gap-1.5 text-orange-600"><Clock className="h-3.5 w-3.5 shrink-0" /> {pedido.dataEntrega || '-'}</p>
            </div>
          </div>

          {/* Valor Total highlight */}
          <div className="flex justify-end mb-6">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-2">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mr-3">Valor Total</span>
              <span className="font-black text-lg text-emerald-600 font-mono">{fmt(pedido.valorTotal)}</span>
            </div>
          </div>

          {/* ===== ITEMS TABLE ===== */}
          {editOrc && (
            <>
              {editOrc.itensRolete.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Factory className="h-4 w-4 text-muted-foreground" />
                    Itens Rolete
                  </h3>
                  <div className="mobile-table-scroll">
                    <div className="border rounded-xl overflow-hidden shadow-sm min-w-[600px]">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/30 border-b">
                            <th className="p-3 text-left font-black uppercase tracking-tighter text-[10px] w-12">Item</th>
                            <th className="p-3 text-left font-black uppercase tracking-tighter text-[10px]">Descrição Técnica</th>
                            <th className="p-3 text-center font-black uppercase tracking-tighter text-[10px] w-20">Qtd</th>
                            <th className="p-3 text-right font-black uppercase tracking-tighter text-[10px] w-32">Valor Un.</th>
                            <th className="p-3 text-right font-black uppercase tracking-tighter text-[10px] w-28">Total</th>
                            <th className="p-3 text-center font-black uppercase tracking-tighter text-[10px] w-16">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editOrc.itensRolete.map((item, i) => (
                            <tr key={i} className="border-b transition-colors hover:bg-muted/10">
                              <td className="p-3 font-bold text-muted-foreground text-center">{i + 1}</td>
                              <td className="p-3">
                                <div className="flex flex-col gap-1">
                                  <span className="font-bold text-foreground text-[13px] leading-tight">{getTechnicalDescription(item)}</span>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-[9px] h-4 font-black uppercase">{(item as any).tipoRolete}</Badge>
                                    {(item as any).codigo && <span className="text-[10px] text-muted-foreground italic">Cód: {(item as any).codigo}</span>}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <Input type="number" className="h-8 w-16 mx-auto text-xs font-bold text-center" value={item.quantidade} onChange={e => updateRoleteItem(i, 'quantidade', +e.target.value)} />
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-[10px] text-muted-foreground">R$</span>
                                  <Input type="number" className="h-8 w-24 text-xs font-mono text-right font-bold" value={item.valorPorPeca} onChange={e => updateRoleteItem(i, 'valorPorPeca', +e.target.value)} />
                                </div>
                              </td>
                              <td className="p-3 text-right font-bold font-mono text-emerald-700">
                                {fmt(item.valorTotal || (item.valorPorPeca * item.quantidade))}
                              </td>
                              <td className="p-3 text-center">
                                <button onClick={() => setDeleteItemConfirm({ type: 'rolete', idx: i })} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Excluir Item">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {editOrc.itensProduto.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    Itens Produto
                  </h3>
                  <div className="mobile-table-scroll">
                    <div className="border rounded-xl overflow-hidden shadow-sm min-w-[600px]">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/30 border-b">
                            <th className="p-3 text-left font-black uppercase tracking-tighter text-[10px] w-12">Item</th>
                            <th className="p-3 text-left font-black uppercase tracking-tighter text-[10px]">Produto / Descrição</th>
                            <th className="p-3 text-center font-black uppercase tracking-tighter text-[10px] w-20">Qtd</th>
                            <th className="p-3 text-right font-black uppercase tracking-tighter text-[10px] w-32">Valor Un.</th>
                            <th className="p-3 text-right font-black uppercase tracking-tighter text-[10px] w-28">Total</th>
                            <th className="p-3 text-center font-black uppercase tracking-tighter text-[10px] w-16">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editOrc.itensProduto.map((item, i) => (
                            <tr key={i} className="border-b transition-colors hover:bg-muted/10">
                              <td className="p-3 font-bold text-muted-foreground text-center">{(editOrc.itensRolete?.length || 0) + i + 1}</td>
                              <td className="p-3">
                                <span className="font-bold text-foreground text-[13px]">{item.produtoNome}</span>
                                {item.descricao && <p className="text-[10px] text-muted-foreground mt-0.5">{item.descricao}</p>}
                              </td>
                              <td className="p-3 text-center">
                                <Input type="number" className="h-8 w-16 mx-auto text-xs font-bold text-center" value={item.quantidade} onChange={e => updateProdutoItem(i, 'quantidade', +e.target.value)} />
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-[10px] text-muted-foreground">R$</span>
                                  <Input type="number" className="h-8 w-24 text-xs font-mono text-right font-bold" value={item.valorUnitario} onChange={e => updateProdutoItem(i, 'valorUnitario', +e.target.value)} />
                                </div>
                              </td>
                              <td className="p-3 text-right font-bold font-mono text-emerald-700">
                                {fmt(item.valorTotal || (item.valorUnitario * item.quantidade))}
                              </td>
                              <td className="p-3 text-center">
                                <button onClick={() => setDeleteItemConfirm({ type: 'produto', idx: i })} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Excluir Item">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Confirm delete item */}
      <ConfirmDialog
        open={!!deleteItemConfirm}
        onOpenChange={(open) => { if (!open) setDeleteItemConfirm(null); }}
        title="Confirmar Exclusão de Item"
        description="Tem certeza que deseja excluir este item do pedido? Esta ação não pode ser desfeita."
        confirmLabel="Confirmar Exclusão"
        onConfirm={confirmDeleteItem}
      />
    </div>
  );
}

// ========== STATUS ==========
const statusProgress: Record<string, number> = {
  'PENDENTE': 20, 'CONFIRMADO': 40, 'EM_PRODUCAO': 60, 'CONCLUIDO': 80, 'ENTREGUE': 100,
};

function StatusProgressBar({ status }: { status: string }) {
  const pct = statusProgress[status] || 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <Progress value={pct} className="h-2 flex-1" />
      <span className={`text-xs font-medium whitespace-nowrap ${status === 'ENTREGUE' || status === 'CONCLUIDO' ? 'text-success' : status === 'EM_PRODUCAO' ? 'text-secondary' : 'text-muted-foreground'}`}>{status.replace('_', ' ')}</span>
    </div>
  );
}

type View = 'list' | 'view' | 'print';

// ========== MAIN PAGE ==========
export default function PedidosPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('list');
  const [currentPedido, setCurrentPedido] = useState<Pedido | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Pedido | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [trackingVendor, setTrackingVendor] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteOrcConfirmId, setDeleteOrcConfirmId] = useState<string | null>(null);

  const { usuarios: dbUsuarios } = useUsuarios();
  const loggedUserId = '1';
  const currentUser = dbUsuarios.find(u => u.id === loggedUserId);

  const fullAccessRoles = ['master', 'SEO', 'admin', 'Admin', 'Administrador', 'administrador', 'adm/dono'];
  const isFullAccess = currentUser ? fullAccessRoles.includes(currentUser.nivel) : false;

  const clientes = store.getClientes();
  const produtos = store.getProdutos();

  useEffect(() => {
    const load = () => { setPedidos(store.getPedidos()); setOrcamentos(store.getOrcamentos()); };
    load();
    window.addEventListener('rp-data-synced', load);
    return () => window.removeEventListener('rp-data-synced', load);
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearch(q);
  }, [searchParams]);

  const matchesSearch = (text: string, s: string) => text?.toLowerCase().includes(s.toLowerCase());
  const clienteMatchesSearch = (clienteNome: string, s: string) => {
    const cli = clientes.find(c => c.nome === clienteNome);
    if (!cli) return matchesSearch(clienteNome, s);
    const compradorMatch = (cli.compradores || []).some(comp =>
      matchesSearch(comp.nome, s) || comp.telefone?.includes(s) || matchesSearch(comp.email, s)
    );
    return matchesSearch(cli.nome, s) || cli.cnpj?.includes(s) || matchesSearch(cli.email, s) ||
      cli.telefone?.includes(s) || matchesSearch(cli.endereco, s) || compradorMatch;
  };

  const gerarPedido = (orc: Orcamento) => {
    if (pedidos.find(p => p.orcamentoId === orc.id)) { toast.error('Este orçamento já tem um pedido!'); return; }
    const pedido: Pedido = {
      id: store.nextId('ped'), numero: store.nextNumero('ped'), orcamentoId: orc.id,
      orcamentoNumero: orc.numero, clienteNome: orc.clienteNome,
      dataEntrega: orc.previsaoEntrega || orc.dataEntrega, status: 'PENDENTE',
      valorTotal: orc.valorTotal, createdAt: new Date().toISOString().split('T')[0],
      statusHistory: [{ status: 'PENDENTE', date: new Date().toISOString() }],
    };
    const updatedPedidos = [...pedidos, pedido]; store.savePedidos(updatedPedidos); setPedidos(updatedPedidos);
    const updatedOrcs = orcamentos.map(o => o.id === orc.id ? { ...o, status: 'APROVADO' as const, dataAprovacao: new Date().toISOString() } : o);
    store.saveOrcamentos(updatedOrcs); setOrcamentos(updatedOrcs);
    const notifs = store.getNotificacoes();
    notifs.push({ id: store.nextId('notif'), tipo: 'pedido', titulo: `Novo Pedido ${pedido.numero}`, mensagem: `Pedido gerado para ${orc.clienteNome} - ${fmt(orc.valorTotal)}`, lida: false, createdAt: new Date().toISOString() });
    store.saveNotificacoes(notifs); toast.success(`Pedido ${pedido.numero} gerado!`);
  };

  const updateStatus = (id: string, status: StatusPedido) => {
    const updated = pedidos.map(p => {
      if (p.id !== id) return p;
      const history = [...(p.statusHistory || []), { status, date: new Date().toISOString() }];
      return { ...p, status, statusHistory: history };
    });
    store.savePedidos(updated); setPedidos(updated); toast.success('Status atualizado!');
  };

  const cancelarPedido = (pedido: Pedido) => {
    setCancelTarget(pedido);
    setCancelMotivo('');
    setCancelDialogOpen(true);
  };

  const confirmCancelarPedido = () => {
    if (!cancelTarget) return;
    if (!cancelMotivo.trim()) { toast.error('Informe o motivo do cancelamento!'); return; }
    const updatedPedidos = pedidos.filter(p => p.id !== cancelTarget.id); store.savePedidos(updatedPedidos); setPedidos(updatedPedidos);
    const updatedOrcs = orcamentos.map(o => o.id === cancelTarget.orcamentoId ? { ...o, status: 'RASCUNHO' as const } : o);
    store.saveOrcamentos(updatedOrcs); setOrcamentos(updatedOrcs);
    setCancelDialogOpen(false);
    toast.success('Pedido cancelado. Orçamento voltou para edição.'); navigate('/orcamentos');
  };

  const deletePedido = (id: string) => { setDeleteConfirmId(id); };
  const confirmDeletePedido = () => {
    if (!deleteConfirmId) return;
    const updated = pedidos.filter(p => p.id !== deleteConfirmId); store.savePedidos(updated); setPedidos(updated);
    setDeleteConfirmId(null); toast.success('Pedido excluído!');
  };
  const confirmDeleteOrc = () => {
    if (!deleteOrcConfirmId) return;
    const updated = orcamentos.filter(x => x.id !== deleteOrcConfirmId); store.saveOrcamentos(updated); setOrcamentos(updated);
    setDeleteOrcConfirmId(null); toast.success('Orçamento excluído!');
  };

  const gerarOS = (pedido: Pedido) => {
    const orc = orcamentos.find(o => o.id === pedido.orcamentoId);
    if (!orc) return;
    const os = {
      id: store.nextId('os'), numero: store.nextNumero('os'), pedidoId: pedido.id,
      empresa: pedido.clienteNome, pedidoNumero: pedido.numero,
      emissao: new Date().toISOString().split('T')[0], entrega: pedido.dataEntrega,
      entradaProducao: '', diasPropostos: 12, status: 'ABERTA' as const,
      itens: (orc.itensRolete || []).map((item, i) => ({
        item: i + 1, quantidade: item.quantidade, tipo: item.tipoRolete,
        diametroTubo: item.diametroTubo, paredeTubo: item.paredeTubo,
        comprimentoTubo: item.comprimentoTubo, comprimentoEixo: item.comprimentoEixo,
        diametroEixo: item.diametroEixo, encaixeFresado: item.medidaFresado || '',
        comprimentoFresado: 0, medidaAbaFresado: '', tipoEncaixe: item.tipoEncaixe,
        roscaIE: '', furoEixo: '', revestimento: item.especificacaoRevestimento,
        corte: false, torno: false, fresa: false, solda: false, pintura: false, montagem: false,
      })),
      createdAt: new Date().toISOString().split('T')[0],
    };
    store.saveOrdensServico([...store.getOrdensServico(), os]);
    updateStatus(pedido.id, 'EM_PRODUCAO');
    const notifs = store.getNotificacoes();
    notifs.push({ id: store.nextId('notif'), tipo: 'producao', titulo: `O.S. ${os.numero} Gerada`, mensagem: `Ordem de serviço criada para ${pedido.clienteNome}`, lida: false, createdAt: new Date().toISOString() });
    store.saveNotificacoes(notifs); toast.success(`O.S. ${os.numero} gerada!`);
  };

  const orcSemPedido = orcamentos.filter(o => !pedidos.find(p => p.orcamentoId === o.id));

  const nameMatch = (vendedorField: string, userName: string) => {
    const a = (vendedorField || '').trim().toLowerCase();
    const b = (userName || '').trim().toLowerCase();
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a) || a.split(' ')[0] === b.split(' ')[0];
  };

  const filteredOrcs = orcSemPedido
    .filter(o => {
      if (isFullAccess) return true;
      return nameMatch(o.vendedor, currentUser?.nome || '');
    })
    .filter(o =>
      o.numero.includes(search) || clienteMatchesSearch(o.clienteNome, search)
    );

  const filteredPedidos = pedidos
    .filter(p => {
      if (isFullAccess) return true;
      const orc = orcamentos.find(o => o.id === p.orcamentoId);
      const vendor = p.vendedor || orc?.vendedor || '';
      return nameMatch(vendor, currentUser?.nome || '');
    })
    .filter(p =>
      p.numero.includes(search) || (p.orcamentoNumero || '').includes(search) || clienteMatchesSearch(p.clienteNome, search)
    );

  // ========== PRINT VIEW ==========
  if (view === 'print' && currentPedido) {
    const orc = orcamentos.find(o => o.id === currentPedido.orcamentoId);
    const cli = clientes.find(c => c.nome === currentPedido.clienteNome);
    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden">
          <Button variant="outline" onClick={() => setView('list')} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
        </div>
        <div className="bg-card border rounded-lg p-6 max-w-5xl mx-auto print:border-0 print:shadow-none print:max-w-none overflow-hidden">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-4 mb-6">
            <div className="flex items-start gap-4">
              <img src={logo} alt="Rollerport" className="h-16 w-16 sm:h-20 sm:w-20 object-contain shrink-0" />
              <div>
                <h2 className="text-xl font-bold">ROLLERPORT</h2>
                <p className="text-xs text-muted-foreground">Roletes para Correia Transportadora</p>
                <p className="text-xs text-muted-foreground">Rua João Marcos Pimenta Rocha, 16 – Franco da Rocha/SP</p>
                <p className="text-xs text-muted-foreground">CEP: 07832-460 • Tel: (11) 4441-3572</p>
              </div>
            </div>
            {cli && (
              <div className="text-left lg:text-right text-sm w-full lg:w-auto border-t lg:border-t-0 pt-3 lg:pt-0">
                <p className="font-semibold">{cli.nome}</p>
                <p className="text-xs text-muted-foreground">CNPJ: {cli.cnpj}</p>
                <p className="text-xs text-muted-foreground">{cli.endereco}</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm mb-6 border rounded p-4">
            <div><span className="font-semibold">Pedido Nº:</span> {currentPedido.numero}</div>
            <div><span className="font-semibold">Orçamento Nº:</span> {currentPedido.orcamentoNumero || '-'}</div>
            <div><span className="font-semibold">Data:</span> {currentPedido.createdAt}</div>
            <div><span className="font-semibold">Entrega:</span> {currentPedido.dataEntrega}</div>
            <div><span className="font-semibold">Status:</span> {currentPedido.status.replace('_', ' ')}</div>
            <div><span className="font-semibold">Valor Total:</span> {fmt(currentPedido.valorTotal)}</div>
          </div>
          {orc && (
            <div className="mobile-table-scroll">
              <table className="w-full text-sm border-collapse mb-6 min-w-[500px]">
                <thead><tr className="border-b-2">
                  <th className="text-left p-2 font-semibold">Item</th>
                  <th className="text-left p-2 font-semibold">Descrição</th>
                  <th className="text-center p-2 font-semibold">Qtd</th>
                  <th className="text-right p-2 font-semibold">Valor Unit.</th>
                  <th className="text-right p-2 font-semibold">Total</th>
                </tr></thead>
                <tbody>
                  {(orc.itensRolete || []).map((item, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2">{getTechnicalDescription(item)}</td>
                      <td className="p-2 text-center">{item.quantidade}</td>
                      <td className="p-2 text-right">{fmt(item.valorPorPeca)}</td>
                      <td className="p-2 text-right">{fmt(item.valorTotal)}</td>
                    </tr>
                  ))}
                  {(orc.itensProduto || []).map((item, i) => (
                    <tr key={`p-${i}`} className="border-b">
                      <td className="p-2">{(orc.itensRolete?.length || 0) + i + 1}</td>
                      <td className="p-2">{item.produtoNome}</td>
                      <td className="p-2 text-center">{item.quantidade}</td>
                      <td className="p-2 text-right">{fmt(item.valorUnitario)}</td>
                      <td className="p-2 text-right">{fmt(item.valorTotal)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 font-bold">
                    <td colSpan={4} className="p-2 text-right">TOTAL</td>
                    <td className="p-2 text-right">{fmt(currentPedido.valorTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
        <style>{`@media print { @page { size: landscape; margin: 1cm; } body { -webkit-print-color-adjust: exact; } .print\\:hidden { display: none !important; } }`}</style>
      </div>
    );
  }

  // ========== VIEW (editable) ==========
  if (view === 'view' && currentPedido) {
    return <PedidoEditView pedido={currentPedido} orcamentos={orcamentos} pedidos={pedidos}
      setOrcamentos={setOrcamentos} setPedidos={setPedidos} setCurrentPedido={setCurrentPedido}
      setView={setView} />;
  }

  // ========== LIST ==========
  return (
    <div className="space-y-6">
      <div><h1 className="page-header">Pedidos</h1><p className="page-subtitle">Gerencie pedidos e orçamentos pendentes</p></div>

      <div className="border rounded-lg p-4 bg-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nº pedido, nº orçamento, empresa, comprador, CNPJ, telefone, email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* Orçamentos pendentes */}
      {filteredOrcs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Orçamentos (pendentes de pedido)</h2>
          <div className="bg-card rounded-lg border mobile-table-scroll">
            <table className="w-full text-sm min-w-[600px]">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Nº</th>
                <th className="text-left p-3 font-medium">Cliente</th>
                <th className="text-left p-3 font-medium">Data</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Dias</th>
                <th className="text-right p-3 font-medium">Valor</th>
                <th className="p-3 w-40 text-center font-medium">Ações</th>
              </tr></thead>
              <tbody>
                {filteredOrcs.map(o => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-mono font-medium">{o.numero}</td>
                    <td className="p-3">{o.clienteNome}</td>
                    <td className="p-3">{o.dataOrcamento || o.createdAt}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground uppercase">{o.status}</span></td>
                    <td className="p-3">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{daysSince(o.createdAt)}d</span>
                    </td>
                    <td className="p-3 text-right font-mono">{fmt(o.valorTotal)}</td>
                    <td className="p-3">
                      <div className="flex gap-1.5 justify-center items-center">
                        <button onClick={() => navigate('/orcamentos')} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Ver Orçamento"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => gerarPedido(o)} className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-600 transition-colors" title="Gerar Pedido"><ShoppingCart className="h-4 w-4" /></button>
                        <button onClick={() => setDeleteOrcConfirmId(o.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pedidos */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Pedidos</h2>
        <div className="bg-card rounded-lg border mobile-table-scroll">
          <table className="w-full text-sm min-w-[900px]">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium text-xs">Nº Pedido</th>
              <th className="text-left p-3 font-medium text-xs">Nº Orçamento</th>
              <th className="text-left p-3 font-medium text-xs">Empresa</th>
              <th className="text-left p-3 font-medium text-xs">Data</th>
              <th className="text-left p-3 font-medium text-xs min-w-[150px]">Status</th>
              <th className="text-left p-3 font-medium text-xs">Dias</th>
              <th className="text-right p-3 font-medium text-xs">Valor</th>
              <th className="p-3 text-center font-medium text-xs w-64">Ações</th>
            </tr></thead>
            <tbody>
              {filteredPedidos.map(p => {
                const days = daysSince(p.createdAt);
                const lastStatusChange = p.statusHistory?.length ? p.statusHistory[p.statusHistory.length - 1] : null;
                const daysInStatus = lastStatusChange ? daysSince(lastStatusChange.date) : days;
                return (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono font-medium">{p.numero}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{p.orcamentoNumero || '-'}</td>
                  <td className="p-3">{p.clienteNome}</td>
                  <td className="p-3 whitespace-nowrap">{p.createdAt}</td>
                  <td className="p-3"><StatusProgressBar status={p.status} /></td>
                  <td className="p-3">
                    <div className="flex flex-col text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {days}d</span>
                      <span className="text-[10px]">Status: {daysInStatus}d</span>
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono whitespace-nowrap">{fmt(p.valorTotal)}</td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-center items-center">
                      <button onClick={() => { setCurrentPedido(p); setView('view'); }} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Visualizar">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => { setCurrentPedido(p); setView('view'); }} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Editar">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => { setCurrentPedido(p); setView('print'); }} className="p-1.5 rounded-lg hover:bg-muted text-foreground transition-colors" title="Imprimir">
                        <Printer className="h-4 w-4" />
                      </button>
                      {p.status === 'PENDENTE' && (
                        <button onClick={() => gerarOS(p)} className="p-1.5 rounded-lg hover:bg-orange-100 text-orange-600 transition-colors" title="Gerar O.S.">
                          <Factory className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => navigate('/agenda', { state: { followUp: { clienteId: p.cliente_id || orcamentos.find(o => o.id === p.orcamentoId)?.clienteId, orcNumero: p.orcamentoNumero || p.numero } } })}
                        className="p-1.5 rounded-lg hover:bg-violet-100 text-violet-600 transition-colors"
                        title="CRM / Follow-up"
                      >
                        <ClipboardList className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          const orc = orcamentos.find(o => o.id === p.orcamentoId);
                          const vendor = p.vendedor || orc?.vendedor || 'Sistema';
                          setTrackingVendor(vendor);
                          setIsTrackingOpen(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
                        title="Rastrear"
                      >
                        <Truck className="h-4 w-4" />
                      </button>
                      <button onClick={() => cancelarPedido(p)} className="p-1.5 rounded-lg hover:bg-orange-100 text-orange-600 transition-colors" title="Cancelar">
                        <XCircle className="h-4 w-4" />
                      </button>
                      <button onClick={() => deletePedido(p.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {filteredPedidos.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum pedido.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog de cancelamento com motivo obrigatório */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar Pedido {cancelTarget?.numero}</DialogTitle></DialogHeader>
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
              <Button variant="destructive" onClick={confirmCancelarPedido}>Confirmar Cancelamento</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AcompanhamentoPedidosModal
        isOpen={isTrackingOpen}
        onOpenChange={setIsTrackingOpen}
        vendedor={trackingVendor}
        pedidos={pedidos}
        orcamentos={orcamentos}
        onMetaUpdate={() => {}}
        currentUser={currentUser}
      />

      {/* Confirm dialogs - exclusão segura */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
        title="Confirmar Exclusão de Pedido"
        description="Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita."
        confirmLabel="Confirmar Exclusão"
        onConfirm={confirmDeletePedido}
      />
      <ConfirmDialog
        open={!!deleteOrcConfirmId}
        onOpenChange={(open) => { if (!open) setDeleteOrcConfirmId(null); }}
        title="Confirmar Exclusão de Orçamento"
        description="Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita."
        confirmLabel="Confirmar Exclusão"
        onConfirm={confirmDeleteOrc}
      />
    </div>
  );
}
