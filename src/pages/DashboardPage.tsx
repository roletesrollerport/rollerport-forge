import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { useUsuarios } from '@/hooks/useUsuarios';
import { usePresenceContext } from '@/contexts/PresenceContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText, ShoppingCart, Users, Factory, TrendingUp, CheckCircle, Truck,
  Eye, Printer, Target, Save, Edit, ArrowLeft, Trash2, X,
  ClipboardList,
  Package,
  Check,
  Edit2
} from 'lucide-react';
import VendorReportView from '@/components/VendorReportView';
import { AcompanhamentoPedidosModal } from '@/components/AcompanhamentoPedidosModal';
import { toast } from 'sonner';

const fmt = (v: number) => `R$ ${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace(/\.(\d{2})$/, ',$1')}`;

const formatCurrencyInput = (value: number): string => {
  if (!value && value !== 0) return '';
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace(/\.(\d{2})$/, ',$1');
};

/* ------------------------------------------------------------------ */
/*  Clickable status chip                                              */
/* ------------------------------------------------------------------ */
function StatusChip({ label, count, colorClass, onClick }: { label: string; count: number; colorClass: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded text-[11px] font-semibold transition-all hover:scale-105 hover:shadow-sm ${colorClass} ${onClick ? 'cursor-pointer' : ''}`}
    >
      {label}: {count}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Top-level stat card (Orçamentos / Pedidos / Clientes / O.S.)       */
/* ------------------------------------------------------------------ */
function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color, 
  onClick, 
  items, 
  onViewAll 
}: { 
  icon: any; 
  label: string; 
  value: string | number; 
  color: string; 
  onClick?: () => void; 
  items?: { id: string, label: string, user: string }[];
  onViewAll?: () => void;
}) {
  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-all">
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className={`flex items-center justify-center h-12 w-12 rounded-lg ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-2">
        {items && items.length > 0 ? (
          <ul className="space-y-1.5 border-t pt-2 list-none m-0 p-0 text-xs">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between items-center text-muted-foreground w-full gap-2">
                <span className="font-semibold text-foreground shrink-0 max-w-[55%] truncate text-left" title={item.label}>{item.label}</span>
                <span className="shrink-0 text-muted-foreground/30">-</span>
                <span className="truncate text-right flex-1 font-medium" title={item.user}>{item.user}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-muted-foreground border-t pt-2 italic">Nenhum registro recente</div>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full h-8 text-xs text-muted-foreground hover:bg-red-600 hover:text-white transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            if (onViewAll) onViewAll();
            else if (onClick) onClick();
          }}
        >
          Ver Tudo <Eye className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </CardFooter>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Status progress bar                                                */
/* ------------------------------------------------------------------ */
function StatusBar({ label, value, max, color, extra, onClick, hideValues }: { label: string; value: number; max: number; color: string; extra?: string; onClick?: (e?: React.MouseEvent) => void, hideValues?: boolean }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div onClick={onClick} className={`flex items-center gap-3 text-xs w-full px-1 py-0.5 transition-colors ${onClick ? 'hover:bg-muted/30 rounded cursor-pointer' : ''}`}>
      {label && <span className="w-28 text-muted-foreground truncate text-left">{label}</span>}
      <div className="flex-1"><Progress value={pct} className={`h-2 ${color}`} /></div>
      {!hideValues && (
        <>
          <span className="w-8 text-right font-mono font-medium">{value}</span>
          {extra && <span className="w-12 text-right text-[10px] text-muted-foreground">{extra}</span>}
        </>
      )}
    </div>
  );
}

type DashView = 'main' | 'vendor-detail' | 'vendor-print' | 'report-detail' | 'report-print' | 'conversion-detail' | 'conversion-print';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    orcamentos: [] as any[], pedidos: [] as any[], clientes: [] as any[], os: [] as any[],
  });
  const [dataLoaded, setDataLoaded] = useState(false);
  const [metas, setMetas] = useState(store.getMetas());
  const [editingMeta, setEditingMeta] = useState<{ vendedor: string; valor: number } | null>(null);
  const [dashView, setDashView] = useState<DashView>('main');
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [selectedReportVendor, setSelectedReportVendor] = useState<string | null>(null);
  const [masterAiPrompt, setMasterAiPrompt] = useState<string>(() => localStorage.getItem('rp_master_ai_prompt') || '');
  
  // Tracking Modal State
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackingVendor, setTrackingVendor] = useState<string>('');

  const { usuarios: dbUsuarios, loading: usersLoading } = useUsuarios();
  const loggedUserId = localStorage.getItem('rp_logged_user');
  const currentUser = dbUsuarios.find(u => u.id === loggedUserId) || null;
  const isMaster = currentUser?.nivel === 'master' || currentUser?.nivel === 'adm/dono' || currentUser?.nivel === 'SEO' || currentUser?.nivel === 'admin';
  const currentUserName = currentUser?.nome || '';
  const { onlineUserIds } = usePresenceContext();

  /* ---------------------------------------------------------------- */
  /*  Data loading - Direct from Supabase DB only                      */
  /* ---------------------------------------------------------------- */
  const loadingRef = useRef(false);
  const suppressReloadRef = useRef(false);

  const doLoadFromDb = useCallback(async () => {
    if (loadingRef.current || suppressReloadRef.current) return;
    loadingRef.current = true;
    try {
      const [orcRes, pedRes, cliRes, osRes, metRes] = await Promise.all([
        supabase.from('orcamentos').select('data'),
        supabase.from('pedidos').select('data'),
        supabase.from('clientes').select('data'),
        supabase.from('ordens_servico').select('data'),
        supabase.from('metas_vendedores').select('data'),
      ]);

      const orcData = (orcRes.data || []).map((r: any) => r.data);
      const pedData = (pedRes.data || []).map((r: any) => r.data);
      const cliData = (cliRes.data || []).map((r: any) => r.data);
      const osData = (osRes.data || []).map((r: any) => r.data);
      const metData = (metRes.data || []).map((r: any) => r.data);

      // Set direct from DB (DO NOT FALLBACK TO LOCAL STORAGE SEEDS unless strictly empty!)
      const parsedCliData = cliData.length > 0 ? cliData : (store.getClientes().length > 0 ? store.getClientes() : []);
      
      setData({
        orcamentos: orcData,
        pedidos: pedData,
        clientes: parsedCliData,
        os: osData,
      });
      setMetas(metData);
      setDataLoaded(true);
    } catch (err) {
      console.error('[Dashboard] DB load error:', err);
      toast.error('Ocorreu um erro ao carregar os dados reais do sistema.');
      setDataLoaded(true);
    } finally {
      loadingRef.current = false;
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Realtime: ONLY DB subscriptions + periodic (no localStorage)     */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    doLoadFromDb();

    // Realtime subscriptions — fires AFTER data is committed to DB
    const channel = supabase
      .channel('dashboard-rt-v6')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orcamentos' }, () => doLoadFromDb())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => doLoadFromDb())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => doLoadFromDb())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => doLoadFromDb())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'metas_vendedores' }, () => doLoadFromDb())
      .subscribe();

    // Also listen for local store save events (same browser, immediate update)
    const handleLocalSave = () => {
      // For local saves, bypass suppress and load from localStorage directly
      setData({
        orcamentos: store.getOrcamentos(),
        pedidos: store.getPedidos(),
        clientes: store.getClientes(),
        os: store.getOrdensServico(),
      });
      setMetas(store.getMetas());
      setDataLoaded(true);
    };
    window.addEventListener('rp-store-save', handleLocalSave);
    window.addEventListener('rp-data-synced', handleLocalSave);

    // Reload on tab focus
    const handleVis = () => { if (document.visibilityState === 'visible') doLoadFromDb(); };
    document.addEventListener('visibilitychange', handleVis);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('rp-store-save', handleLocalSave);
      window.removeEventListener('rp-data-synced', handleLocalSave);
    };
  }, [doLoadFromDb]);

  /* ---------------------------------------------------------------- */
  /*  Derived counts                                                   */
  /* ---------------------------------------------------------------- */
  const countByStatus = (items: any[], field: string, status: string) => 
    items.filter(i => (i[field] || '').toString().trim().toUpperCase() === status.toUpperCase()).length;

  const getOrcStats = (orcs: any[]) => {
    const peds = data.pedidos;
    const aprovado = orcs.filter(o => peds.some(p => p.orcamentoId === o.id)).length;
    const cancelado = countByStatus(orcs, 'status', 'REPROVADO');
    const rascunho = orcs.filter(o => o.status === 'RASCUNHO' || !o.valorTotal || o.valorTotal === 0 || !o.clienteNome).length;
    const pendente = orcs.length - aprovado - cancelado - rascunho;
    return { total: orcs.length, rascunho, pendente, aprovado, cancelado };
  };

  const getPedStats = (peds: any[]) => {
    const osList = data.os;
    const entregue = countByStatus(peds, 'status', 'ENTREGUE');
    const concluido = entregue; 
    
    const pendente = peds.filter(p => 
      (p.status === 'PENDENTE' || p.status === 'CONFIRMADO') && !osList.some(os => os.pedidoId === p.id)
    ).length;
    
    const confirmado = peds.filter(p => {
      const relOs = osList.filter(os => os.pedidoId === p.id);
      return relOs.length > 0 && relOs.every(os => os.status === 'ABERTA');
    }).length;

    const producao = peds.filter(p => {
      if (p.status === 'CONCLUIDO') return true; // 'Enviado' still counts as production cycle or in-transit
      const relOs = osList.filter(os => os.pedidoId === p.id);
      return relOs.length > 0 && relOs.some(os => os.status === 'EM_ANDAMENTO' || os.status === 'CONCLUIDA');
    }).length;

    return { total: peds.length, pendente, confirmado, producao, concluido, entregue };
  };

  const getOsStats = (osList: any[]) => {
    const peds = data.pedidos;
    const aberta = countByStatus(osList, 'status', 'ABERTA');
    const emAndamento = countByStatus(osList, 'status', 'EM_ANDAMENTO');
    const concluida = countByStatus(osList, 'status', 'CONCLUIDA');
    
    const entregue = osList.filter(os => {
      const ped = peds.find(p => p.id === os.pedidoId);
      return ped && ped.status === 'ENTREGUE';
    }).length;

    return { total: osList.length, aberta, emAndamento, concluida, entregue };
  };

  // Per-user data helpers (fuzzy matching: "karen" matches "Karen Ferreira")
  const nameMatch = (vendedorField: string, userName: string) => {
    const a = (vendedorField || '').trim().toLowerCase();
    const b = (userName || '').trim().toLowerCase();
    if (!a || !b) return false;
    // Exact match, or one contains the other, or first name match
    return a === b || a.includes(b) || b.includes(a) || a.split(' ')[0] === b.split(' ')[0];
  };
  const getUserOrcs = (nome: string) => data.orcamentos.filter((o: any) => nameMatch(o.vendedor, nome));
  const getUserPeds = (nome: string) => data.pedidos.filter((p: any) => {
    const orc = data.orcamentos.find((o: any) => o.id === p.orcamentoId);
    return nameMatch((orc as any)?.vendedor, nome);
  });
  const getUserOS = (nome: string) => data.os.filter((os: any) => {
    const ped = data.pedidos.find((p: any) => p.id === os.pedidoId);
    if (!ped) return false;
    const orc = data.orcamentos.find((o: any) => o.id === (ped as any).orcamentoId);
    return nameMatch((orc as any)?.vendedor, nome);
  });

  // Global stats
  const globalOrc = getOrcStats(isMaster ? data.orcamentos : getUserOrcs(currentUserName));
  const globalPed = getPedStats(isMaster ? data.pedidos : getUserPeds(currentUserName));
  const globalOs = getOsStats(isMaster ? data.os : getUserOS(currentUserName));

  const taxaConversao = globalOrc.total > 0 ? +((globalOrc.aprovado / globalOrc.total) * 100).toFixed(1) : 0;

  // Day averages helper
  const daysSince = (dateStr: string): number => {
    if (!dateStr) return 0;
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr.split('/').reverse().join('-'));
    if (isNaN(d.getTime())) return 0;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  };
  const avgDays = (items: any[], field = 'createdAt') => {
    if (items.length === 0) return '';
    const total = items.reduce((s: number, i: any) => s + daysSince(i[field] || i.createdAt), 0);
    return `~${Math.round(total / items.length)}d`;
  };

  const orcByStatus = (status: string) => (isMaster ? data.orcamentos : getUserOrcs(currentUserName)).filter((o: any) => o.status === status);
  const pedByStatus = (status: string) => (isMaster ? data.pedidos : getUserPeds(currentUserName)).filter((p: any) => p.status === status);
  const osByStatus = (status: string) => (isMaster ? data.os : getUserOS(currentUserName)).filter((o: any) => o.status === status);

  /* ---------------------------------------------------------------- */
  /*  Meta helpers                                                     */
  /* ---------------------------------------------------------------- */
  const saveMeta = async (vendedorNome: string, valor: number) => {
    const existing = metas.find(m => m.vendedor === vendedorNome);
    let updated;
    if (existing) { updated = metas.map(m => m.vendedor === vendedorNome ? { ...m, metaMensal: valor } : m); }
    else { updated = [...metas, { vendedor: vendedorNome, metaMensal: valor }]; }
    
    // Update UI immediately
    setMetas(updated); 
    setEditingMeta(null);
    
    // Suppress realtime reload to prevent reverting
    suppressReloadRef.current = true;
    
    // Write directly to Supabase (skip localStorage middleman)
    const metaData = { vendedor: vendedorNome, metaMensal: valor };
    await supabase
      .from('metas_vendedores')
      .upsert({ vendedor: vendedorNome, data: metaData, updated_at: new Date().toISOString() } as any, { onConflict: 'vendedor' });
    
    // Also update localStorage for consistency
    store.saveMetas(updated);
    
    // Allow reloads again after a delay
    setTimeout(() => { suppressReloadRef.current = false; }, 3000);
    toast.success('Meta salva!');
  };

  const deleteOrcamento = async (id: string) => {
    const updated = data.orcamentos.filter((o: any) => o.id !== id);
    setData(prev => ({ ...prev, orcamentos: updated }));
    suppressReloadRef.current = true;
    await supabase.from('orcamentos').delete().eq('id', id);
    store.saveOrcamentos(updated);
    setTimeout(() => { suppressReloadRef.current = false; }, 3000);
    toast.success('Orçamento excluído!');
  };

  const deletePedido = async (id: string) => {
    const updated = data.pedidos.filter((p: any) => p.id !== id);
    setData(prev => ({ ...prev, pedidos: updated }));
    suppressReloadRef.current = true;
    await supabase.from('pedidos').delete().eq('id', id);
    store.savePedidos(updated);
    setTimeout(() => { suppressReloadRef.current = false; }, 3000);
    toast.success('Pedido excluído!');
  };

  /* ================================================================ */
  /*  VENDOR DETAIL / PRINT VIEW                                       */
  /* ================================================================ */
  if ((dashView === 'vendor-detail' || dashView === 'vendor-print') && selectedVendor) {
    const userOrcs = getUserOrcs(selectedVendor);
    const userPeds = getUserPeds(selectedVendor);
    const userOS = getUserOS(selectedVendor);

    const handleSaveMasterPrompt = (prompt: string) => {
      setMasterAiPrompt(prompt);
      localStorage.setItem('rp_master_ai_prompt', prompt);
    };

    return (
      <VendorReportView
        vendorName={selectedVendor}
        orcamentos={userOrcs}
        pedidos={userPeds}
        ordensServico={userOS}
        metas={metas}
        isMaster={isMaster}
        isPrint={dashView === 'vendor-print'}
        onBack={() => { setDashView('main'); setSelectedVendor(null); }}
        onPrint={() => dashView === 'vendor-detail' ? setDashView('vendor-print') : window.print()}
        masterPrompt={masterAiPrompt || undefined}
        onSaveMasterPrompt={handleSaveMasterPrompt}
      />
    );
  }

  /* ================================================================ */
  /*  REPORT DETAIL                                                    */
  /* ================================================================ */
  if (dashView === 'report-detail' || dashView === 'report-print') {
    const fv = selectedReportVendor;
    const reportOrcs = fv ? getUserOrcs(fv) : (isMaster ? data.orcamentos : getUserOrcs(currentUserName));
    const reportPeds = fv ? getUserPeds(fv) : (isMaster ? data.pedidos : getUserPeds(currentUserName));
    const reportOS = fv ? getUserOS(fv) : (isMaster ? data.os : getUserOS(currentUserName));
    const vendedores = dbUsuarios.filter(u => u.nivel !== 'master' && u.ativo);

    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden">
          <Button variant="outline" onClick={() => { setDashView('main'); setSelectedReportVendor(null); }} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          {dashView === 'report-detail' && <Button variant="outline" onClick={() => setDashView('report-print')} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>}
          {dashView === 'report-print' && <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>}
          {isMaster && (
            <select value={selectedReportVendor || ''} onChange={e => setSelectedReportVendor(e.target.value || null)}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
              <option value="">Todos os Usuários</option>
              {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
            </select>
          )}
        </div>
        <div className="bg-card border rounded-lg p-6 max-w-5xl mx-auto print:border-0 print:shadow-none space-y-6">
          <h2 className="text-xl font-bold">Relatório Comercial {fv ? `- ${fv}` : '- Todos'}</h2>

          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Orçamentos ({reportOrcs.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left p-2">Nº</th><th className="text-left p-2">Cliente</th><th className="text-left p-2">Vendedor</th>
                  <th className="text-left p-2">Data</th><th className="text-right p-2">Valor</th><th className="text-left p-2">Status</th>
                </tr></thead>
                <tbody>
                  {reportOrcs.map((o: any) => (
                    <tr key={o.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-mono">{o.numero}</td><td className="p-2">{o.clienteNome}</td><td className="p-2">{o.vendedor}</td>
                      <td className="p-2">{o.dataOrcamento || o.createdAt}</td>
                      <td className="p-2 text-right font-mono">{fmt(o.valorTotal)}</td>
                      <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${o.status === 'APROVADO' ? 'bg-success/10 text-success' : o.status === 'REPROVADO' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{o.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-secondary" /> Pedidos ({reportPeds.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left p-2">Nº</th><th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">Entrega</th><th className="text-right p-2">Valor</th><th className="text-left p-2">Status</th>
                </tr></thead>
                <tbody>
                  {reportPeds.map((p: any) => (
                    <tr key={p.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-mono">{p.numero}</td><td className="p-2">{p.clienteNome}</td>
                      <td className="p-2">{p.dataEntrega}</td>
                      <td className="p-2 text-right font-mono">{fmt(p.valorTotal)}</td>
                      <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${p.status === 'ENTREGUE' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Factory className="h-4 w-4 text-accent" /> Ordens de Serviço ({reportOS.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left p-2">O.S.</th><th className="text-left p-2">Empresa</th><th className="text-left p-2">Pedido</th>
                  <th className="text-left p-2">Status</th>
                </tr></thead>
                <tbody>
                  {reportOS.map((os: any) => (
                    <tr key={os.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-mono">{os.numero}</td><td className="p-2">{os.empresa}</td><td className="p-2">{os.pedidoNumero}</td>
                      <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${os.status === 'CONCLUIDA' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{os.status?.replace('_', ' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {dashView === 'report-print' && (
          <style>{`@media print { @page { margin: 0.5cm; } body { -webkit-print-color-adjust: exact; } .print\\:hidden { display: none !important; } }`}</style>
        )}
      </div>
    );
  }

  /* ================================================================ */
  /*  CONVERSION DETAIL                                                */
  /* ================================================================ */
  if (dashView === 'conversion-detail' || dashView === 'conversion-print') {
    const vendedores = dbUsuarios.filter(u => u.ativo && u.nivel !== 'master');
    const convData = vendedores.map(v => {
      const orcV = getUserOrcs(v.nome);
      const pedV = getUserPeds(v.nome);
      const totalVendido = pedV.reduce((s: number, p: any) => s + p.valorTotal, 0);
      const conv = orcV.length > 0 ? ((orcV.filter((o: any) => o.status === 'APROVADO').length / orcV.length) * 100) : 0;
      return {
        nome: v.nome, orcTotal: orcV.length,
        aprovados: countByStatus(orcV, 'status', 'APROVADO'),
        reprovados: countByStatus(orcV, 'status', 'REPROVADO'),
        enviados: countByStatus(orcV, 'status', 'ENVIADO'),
        aguardando: countByStatus(orcV, 'status', 'AGUARDANDO'),
        rascunho: countByStatus(orcV, 'status', 'RASCUNHO'),
        conversao: +conv.toFixed(1), totalVendido,
      };
    });
    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden">
          <Button variant="outline" onClick={() => setDashView('main')} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          {dashView === 'conversion-detail' && <Button variant="outline" onClick={() => setDashView('conversion-print')} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>}
          {dashView === 'conversion-print' && <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>}
        </div>
        <div className="bg-card border rounded-lg p-6 max-w-5xl mx-auto print:border-0 print:shadow-none space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Relatório de Taxa de Conversão</h2>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Orçamento → Pedido</p>
              <p className="text-3xl font-bold text-primary">{taxaConversao}%</p>
              <p className="text-xs text-muted-foreground">{globalOrc.aprovado} de {globalOrc.total}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Pedidos Entregues</p>
              <p className="text-3xl font-bold text-primary">{globalPed.total > 0 ? ((globalPed.entregue / globalPed.total) * 100).toFixed(1) : 0}%</p>
              <p className="text-xs text-muted-foreground">{globalPed.entregue} de {globalPed.total}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">O.S. Ativas</p>
              <p className="text-3xl font-bold text-primary">{globalOs.total}</p>
            </div>
          </div>

          <table className="w-full text-xs">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left p-2">Nome</th><th className="text-center p-2">Orçamentos</th>
              <th className="text-center p-2">Aprovados</th><th className="text-center p-2">Reprovados</th>
              <th className="text-center p-2">Enviados</th><th className="text-center p-2">Aguardando</th>
              <th className="text-center p-2">Rascunho</th><th className="text-center p-2">% Conversão</th>
              <th className="text-right p-2">Total Vendido</th>
            </tr></thead>
            <tbody>
              {convData.map((v, i) => (
                <tr key={i} className="border-b hover:bg-muted/30">
                  <td className="p-2 font-medium">{v.nome}</td>
                  <td className="p-2 text-center">{v.orcTotal}</td>
                  <td className="p-2 text-center text-success font-medium">{v.aprovados}</td>
                  <td className="p-2 text-center text-destructive">{v.reprovados}</td>
                  <td className="p-2 text-center">{v.enviados}</td>
                  <td className="p-2 text-center">{v.aguardando}</td>
                  <td className="p-2 text-center">{v.rascunho}</td>
                  <td className="p-2 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v.conversao >= 50 ? 'bg-success/10 text-success' : v.conversao >= 25 ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive'}`}>{v.conversao}%</span></td>
                  <td className="p-2 text-right font-mono">{fmt(v.totalVendido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {dashView === 'conversion-print' && (
          <style>{`@media print { @page { margin: 0.5cm; } body { -webkit-print-color-adjust: exact; } .print\\:hidden { display: none !important; } }`}</style>
        )}
      </div>
    );
  }

  /* ================================================================ */
  /*  USER CARD COMPONENT (used for both Master and Common views)      */
  /* ================================================================ */
  const renderUserCard = (usuario: any, fullWidth = false) => {
    const isOnline = onlineUserIds.has(usuario.id);
    const userPeds = getUserPeds(usuario.nome);
    const meta = metas.find(m => m.vendedor === usuario.nome);
    
    // CALCULO DE META: Apenas pedidos com status 'ENTREGUE'
    const totalVendido = userPeds
      .filter(p => p.status === 'ENTREGUE')
      .reduce((acc, p) => acc + (p.valorTotal || 0), 0);
      
    const metaPct = meta && meta.metaMensal > 0 ? Math.min((totalVendido / meta.metaMensal) * 100, 1000) : 0; // Allowing > 100% display but cap if needed for bar
    const displayPct = Math.min(metaPct, 100);

    return (
      <Card key={usuario.id} className={`hover:shadow-md transition-shadow ${fullWidth ? 'col-span-full max-w-md' : ''}`}>
        <CardContent className="p-5 space-y-4">
          {/* Foto + Nome */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-14 w-14">
                {usuario.foto ? <AvatarImage src={usuario.foto} alt={usuario.nome} /> : null}
                <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                  {usuario.nome?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isOnline ? (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-success border-2 border-card"></span>
                </span>
              ) : (
                <span className="absolute -bottom-0.5 -right-0.5 inline-flex rounded-full h-4 w-4 bg-muted-foreground/40 border-2 border-card"></span>
              )}
            </div>
            <div>
              <p className="font-semibold text-base">{usuario.nome}</p>
              <span className={`text-xs font-medium ${isOnline ? 'text-success' : 'text-muted-foreground'}`}>
                {isOnline ? '● Online' : '● Offline'}
              </span>
            </div>
          </div>

          <CardContent className="space-y-4 pt-4">
            {/* Meta do Mês (Apenas para Vendas) */}
            {usuario.nivel === 'Vendas' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground font-medium">Meta do Mês</span>
                  <div className="flex items-center gap-1.5">
                    {isMaster && editingMeta?.vendedor === usuario.nome ? (
                      <div className="flex items-center gap-1.5">
                        <Input 
                          type="text" 
                          inputMode="numeric"
                          className="h-7 w-28 font-bold text-sm px-2 text-right" 
                          value={formatCurrencyInput(editingMeta.valor)} 
                          onChange={e => {
                            const raw = e.target.value.replace(/\D/g, '');
                            const cents = parseInt(raw || '0', 10);
                            setEditingMeta({ ...editingMeta, valor: cents / 100 });
                          }} 
                          autoFocus 
                        />
                        <button onClick={() => saveMeta(usuario.nome, editingMeta.valor)} className="text-success hover:text-success/80 bg-success/10 p-1 rounded-sm"><Check className="h-3 w-3" /></button>
                        <button onClick={() => setEditingMeta(null)} className="text-muted-foreground hover:text-foreground bg-muted p-1 rounded-sm"><X className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <>
                        <span className="text-lg font-bold text-foreground">
                          {meta && meta.metaMensal > 0 ? fmt(meta.metaMensal) : 'R$ 0,00'}
                        </span>
                        {isMaster && (
                          <button 
                            onClick={() => setEditingMeta({ vendedor: usuario.nome, valor: meta?.metaMensal || 0 })} 
                            className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    )}
                    <span className="text-sm font-bold text-muted-foreground ml-2">
                      {meta && meta.metaMensal > 0 ? ((totalVendido / meta.metaMensal) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                </div>
                <Progress value={displayPct} className="h-2.5 [&>div]:bg-primary bg-muted" />
                <p className="text-xs text-muted-foreground">
                  {fmt(totalVendido)} de {meta && meta.metaMensal > 0 ? fmt(meta.metaMensal) : 'R$ 0,00'}
                </p>
              </div>
            )}
          </CardContent>

            {/* Botões - Ver Relatório, Imprimir e Acompanhar Pedidos */}
            <div className="flex flex-col gap-2 pt-1 border-t mt-4 pt-4">
              <div className="flex gap-2">
                {(isMaster || usuario.id === loggedUserId || ['SEO', 'adm/dono', 'admin'].includes(usuario.nivel)) && 
                 (['Vendas', 'SEO', 'adm/dono', 'master', 'admin'].includes(usuario.nivel)) && (
                  <>
                    <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={() => { setSelectedVendor(usuario.nome); setDashView('vendor-detail'); }}>
                      <Eye className="h-3.5 w-3.5" /> Ver Relatório
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={() => { setSelectedVendor(usuario.nome); setDashView('vendor-print'); }}>
                      <Printer className="h-3.5 w-3.5" /> Imprimir
                    </Button>
                  </>
                )}
              </div>
              
              {/* Acompanhar Pedidos Button (Strictly for Vendas and Management) */}
              {(isMaster || usuario.id === loggedUserId || ['SEO', 'adm/dono', 'admin'].includes(usuario.nivel)) && 
               (['Vendas', 'SEO', 'adm/dono', 'master', 'admin'].includes(usuario.nivel)) && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-xs gap-1.5 border-dashed border-primary/50 text-primary hover:bg-red-600 hover:text-white hover:border-red-600 focus:bg-red-600 focus:text-white transition-colors" 
                    onClick={() => {
                       setTrackingVendor(usuario.nome); 
                       setIsTrackingModalOpen(true);
                    }}
                  >
                    <Package className="h-3.5 w-3.5" /> 
                    {usuario.nivel === 'Vendas' ? 'Acompanhar Pedidos' : 'Monitorar Geral'}
                  </Button>
                )}
            </div>
          </CardContent>
        </Card>
    );
  };

  /* ================================================================ */
  /*  MAIN DASHBOARD VIEW                                              */
  /* ================================================================ */
  return (
    <div>
      {/* TOPO */}
      <div className="mb-2">
        <h1 className="page-header">Início</h1>
        <p className="page-subtitle">Sistema Rollerport</p>
      </div>

      {/* Espaço de 2 linhas */}
      <div className="h-8" />

      {/* 4 Cards globais - contagens persistentes e clicáveis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ORÇAMENTOS */}
        <StatCard 
          icon={FileText} 
          label="Orçamentos" 
          value={(isMaster ? data.orcamentos : getUserOrcs(currentUserName)).length} 
          color="bg-primary/10 text-primary" 
          onViewAll={() => navigate(isMaster ? '/orcamentos' : `/orcamentos?vendedor=${currentUserName}`)}
          items={(isMaster ? data.orcamentos : getUserOrcs(currentUserName))
            .slice(-3).reverse()
            .map((o: any) => ({ id: o.id, label: o.numero, user: o.vendedor || 'Sistema' }))}
        />

        {/* PEDIDOS */}
        <StatCard 
          icon={ShoppingCart} 
          label="Pedidos" 
          value={(isMaster ? data.pedidos : getUserPeds(currentUserName)).length} 
          color="bg-secondary/20 text-secondary" 
          onViewAll={() => navigate(isMaster ? '/pedidos' : `/pedidos?vendedor=${currentUserName}`)}
          items={(isMaster ? data.pedidos : getUserPeds(currentUserName))
            .slice(-3).reverse()
            .map((p: any) => {
              const orc = data.orcamentos.find((o: any) => o.id === p.orcamentoId);
              return { id: p.id, label: p.numero, user: p.vendedor || orc?.vendedor || 'Sistema' };
            })}
        />

        {/* CLIENTES */}
        <StatCard 
          icon={Users} 
          label="Clientes" 
          value={(isMaster ? data.clientes : data.clientes.filter(c => {
            // ACL: For common users, show clients they have budgets/orders with
            const hasOrc = data.orcamentos.some(o => o.clienteId === c.id && nameMatch(o.vendedor, currentUserName));
            const hasPed = data.pedidos.some(p => p.clienteNome === c.nome && getUserPeds(currentUserName).some(up => up.id === p.id));
            return hasOrc || hasPed;
          })).length} 
          color="bg-info/10 text-info" 
          onViewAll={() => navigate('/clientes')}
          items={(isMaster ? data.clientes : data.clientes.filter((c: any) => {
            const hasOrc = data.orcamentos.some((o: any) => o.clienteId === c.id && nameMatch(o.vendedor, currentUserName));
            const hasPed = data.pedidos.some((p: any) => p.clienteNome === c.nome && getUserPeds(currentUserName).some((up: any) => up.id === p.id));
            return hasOrc || hasPed;
          }))
            .slice(-3).reverse()
            .map((c: any) => ({ id: c.id, label: c.nome?.split(' - ')[0] || c.nome || 'Cliente', user: c.vendedor || c.criadoPor || 'Sistema' }))}
        />

        {/* ORDENS DE SERVIÇO */}
        <StatCard 
          icon={Factory} 
          label="Ordens O.S." 
          value={(isMaster ? data.os : getUserOS(currentUserName)).length} 
          color="bg-accent/10 text-accent" 
          onViewAll={() => navigate('/producao')}
          items={(isMaster ? data.os : getUserOS(currentUserName))
            .slice(-3).reverse()
            .map((os: any) => {
              const ped = data.pedidos.find((p: any) => p.id === os.pedidoId);
              const orc = data.orcamentos.find((o: any) => o.id === ped?.orcamentoId);
              return { id: os.id, label: os.numero, user: os.responsavelTecnico || os.emitente || orc?.vendedor || 'Manual' };
            })}
        />
      </div>

      {/* Espaço de 2 linhas */}
      <div className="h-8" />

      {/* 4 Cards de Status - clicáveis */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/orcamentos')}>
          <CardHeader className="pb-2">
            <h2 className="font-semibold flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-primary" /> Status dos Orçamentos</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusBar label="Rascunho" value={globalOrc.rascunho} max={globalOrc.total} color="[&>div]:bg-muted-foreground" extra={avgDays(orcByStatus('RASCUNHO'))} onClick={(e) => { e?.stopPropagation(); navigate('/orcamentos?status=RASCUNHO'); }} />
            <StatusBar label="Pendente" value={globalOrc.pendente} max={globalOrc.total} color="[&>div]:bg-amber-500" extra={avgDays([...orcByStatus('PENDENTE'), ...orcByStatus('ENVIADO'), ...orcByStatus('AGUARDANDO')])} onClick={(e) => { e?.stopPropagation(); navigate('/orcamentos?status=PENDENTE'); }} />
            <StatusBar label="Aprovado" value={globalOrc.aprovado} max={globalOrc.total} color="[&>div]:bg-success" extra={avgDays(orcByStatus('APROVADO'))} onClick={(e) => { e?.stopPropagation(); navigate('/orcamentos?status=APROVADO'); }} />
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/pedidos')}>
          <CardHeader className="pb-2">
            <h2 className="font-semibold flex items-center gap-2 text-sm"><ShoppingCart className="h-4 w-4 text-secondary" /> Status dos Pedidos</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusBar label="Pendente" value={globalPed.pendente} max={globalPed.total} color="[&>div]:bg-muted-foreground" extra={avgDays(pedByStatus('PENDENTE'))} onClick={(e) => { e?.stopPropagation(); navigate('/pedidos?status=PENDENTE'); }} />
            <StatusBar label="Em Produção" value={globalPed.producao} max={globalPed.total} color="[&>div]:bg-secondary" extra={avgDays(pedByStatus('EM_PRODUCAO'))} onClick={(e) => { e?.stopPropagation(); navigate('/pedidos?status=EM_PRODUCAO'); }} />
            <StatusBar label="Confirmado" value={globalPed.confirmado} max={globalPed.total} color="[&>div]:bg-info" extra={avgDays(pedByStatus('CONFIRMADO'))} onClick={(e) => { e?.stopPropagation(); navigate('/pedidos?status=CONFIRMADO'); }} />
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/producao')}>
          <CardHeader className="pb-2">
            <h2 className="font-semibold flex items-center gap-2 text-sm"><Factory className="h-4 w-4 text-accent" /> Status das O.S.</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusBar label="Aberta" value={globalOs.aberta} max={globalOs.total} color="[&>div]:bg-muted-foreground" extra={avgDays(osByStatus('ABERTA'))} onClick={(e) => { e?.stopPropagation(); navigate('/producao?status=ABERTA'); }} />
            <StatusBar label="Em Andamento" value={globalOs.emAndamento} max={globalOs.total} color="[&>div]:bg-secondary" extra={avgDays(osByStatus('EM_ANDAMENTO'))} onClick={(e) => { e?.stopPropagation(); navigate('/producao?status=EM_ANDAMENTO'); }} />
            <StatusBar label="Concluída" value={globalOs.concluida} max={globalOs.total} color="[&>div]:bg-success" extra={avgDays(osByStatus('CONCLUIDA'))} onClick={(e) => { e?.stopPropagation(); navigate('/producao?status=CONCLUIDA'); }} />
          </CardContent>
        </Card>

        {/* CARD PEDIDOS ENTREGUES - mesmo estilo dos cards de status */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/pedidos?status=ENTREGUE')}>
          <CardHeader className="pb-2">
            <h2 className="font-semibold flex items-center gap-2 text-sm"><CheckCircle className="h-4 w-4 text-success" /> Pedidos Entregues</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusBar label="Entregue" value={globalPed.entregue} max={globalPed.total} color="[&>div]:bg-success" extra={avgDays(pedByStatus('ENTREGUE'))} />
            <div className="border-t pt-2 space-y-1">
              {data.pedidos
                .filter((p: any) => p.status === 'ENTREGUE')
                .slice(-3).reverse()
                .map((p: any) => (
                  <p key={p.id} className="text-xs text-muted-foreground font-mono">Pedido {p.numero}</p>
                ))}
              {data.pedidos.filter((p: any) => p.status === 'ENTREGUE').length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhuma entrega registrada</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Espaço de 2 linhas */}
      <div className="h-8" />

      {/* Taxa de Conversão */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDashView('conversion-detail')}>
        <CardHeader className="pb-2">
          <h2 className="font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Taxa de Conversão
            <span className="text-[10px] text-muted-foreground ml-2">(clique para relatório completo)</span>
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <div className="flex items-center justify-center gap-2 mb-2"><CheckCircle className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">Orçamento → Pedido</span></div>
              <p className="text-3xl font-bold text-primary">{taxaConversao}%</p>
              <p className="text-xs text-muted-foreground mt-1">{globalOrc.aprovado} aprovados de {globalOrc.total}</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <div className="flex items-center justify-center gap-2 mb-2"><Truck className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">Pedidos Entregues</span></div>
              <p className="text-3xl font-bold text-primary">{globalPed.total > 0 ? ((globalPed.entregue / globalPed.total) * 100).toFixed(1) : 0}%</p>
              <p className="text-xs text-muted-foreground mt-1">{globalPed.entregue} de {globalPed.total} pedidos</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <div className="flex items-center justify-center gap-2 mb-2"><Factory className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">O.S. Ativas</span></div>
              <p className="text-3xl font-bold text-primary">{globalOs.total}</p>
              <p className="text-xs text-muted-foreground mt-1">Ordens em andamento</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Espaço de 2 linhas */}
      <div className="h-8" />

      {/* Cards dos Usuários */}
      <div>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Equipe
        </h2>
        {usersLoading || !dataLoaded ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3"><div className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-16" /></div></div></CardHeader>
                <CardContent className="space-y-3 pt-0"><div className="grid grid-cols-3 gap-2"><Skeleton className="h-16 rounded-lg" /><Skeleton className="h-16 rounded-lg" /><Skeleton className="h-16 rounded-lg" /></div></CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {/* 1ª Fileira: Gestão e Estratégia (SEO, administrador, adm/dono) */}
            {(dbUsuarios.filter(u => u.ativo && u.nivel !== 'master' && (u.nivel === 'SEO' || u.nivel === 'administrador' || u.nivel === 'adm/dono' || u.nivel === 'admin' || u.nivel === 'Administrador')).length > 0) && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Gestão e Estratégia</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dbUsuarios
                    .filter(u => u.ativo && u.nivel !== 'master' && (u.nivel === 'SEO' || u.nivel === 'administrador' || u.nivel === 'adm/dono' || u.nivel === 'admin' || u.nivel === 'Administrador'))
                    .map(u => renderUserCard(u))}
                </div>
              </div>
            )}

            {/* 2ª Fileira: Equipe de Vendas */}
            {(dbUsuarios.filter(u => u.ativo && u.nivel !== 'master' && u.nivel === 'Vendas').length > 0) && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Equipe de Vendas</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dbUsuarios
                    .filter(u => u.ativo && u.nivel !== 'master' && u.nivel === 'Vendas')
                    .map(u => renderUserCard(u))}
                </div>
              </div>
            )}

            {/* 3ª Fileira: Equipe de Produção (Produção e Estoque) */}
            {(dbUsuarios.filter(u => u.ativo && u.nivel !== 'master' && u.nivel !== 'Vendas' && u.nivel !== 'SEO' && u.nivel !== 'administrador' && u.nivel !== 'adm/dono' && u.nivel !== 'admin' && u.nivel !== 'Administrador').length > 0) && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Equipe de Produção</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dbUsuarios
                    .filter(u => u.ativo && u.nivel !== 'master' && u.nivel !== 'Vendas' && u.nivel !== 'SEO' && u.nivel !== 'administrador' && u.nivel !== 'adm/dono' && u.nivel !== 'admin' && u.nivel !== 'Administrador')
                    .map(u => renderUserCard(u))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <AcompanhamentoPedidosModal
        isOpen={isTrackingModalOpen}
        onOpenChange={setIsTrackingModalOpen}
        vendedor={trackingVendor}
        pedidos={data.pedidos}
        orcamentos={data.orcamentos}
        onMetaUpdate={async (valorSoma) => {
          setMetas((prev) => {
            const updated = prev.map(m => m.vendedor === trackingVendor 
              ? { ...m, valorRealizado: (m.valorRealizado || 0) + valorSoma } 
              : m
            );
            
            const changedMeta = updated.find(m => m.vendedor === trackingVendor);
            if(changedMeta) {
               // Fire and forget to Supabase
               supabase.from('metas_vendedores').upsert({
                 vendedor: trackingVendor,
                 data: changedMeta as any,
                 updated_at: new Date().toISOString()
               }, { onConflict: 'vendedor' }).then(() => store.saveMetas(updated));
            }
            
            return updated;
          });
        }}
      />
    </div>
  );
}
