import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  FileText,
  ShoppingCart,
  Users,
  Factory,
  TrendingUp,
  CheckCircle,
  Truck,
  Eye,
  Printer,
  ArrowLeft,
  Trash2,
  X,
  Package,
  Check,
  Edit2,
  Bell,
  LogOut,
  User,
  RefreshCw,
  Calendar as CalendarIcon,
  Clock
} from 'lucide-react';
import VendorReportView from '@/components/VendorReportView';
import { AcompanhamentoPedidosModal } from '@/components/AcompanhamentoPedidosModal';
import { toast } from 'sonner';
import { ptBR } from 'date-fns/locale';
import logo from '@/assets/logo.png';

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
    <Card className="flex flex-col h-full hover:shadow-md transition-all rounded-2xl border border-[#E2E8F0] shadow-sm bg-white">
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
  const [searchParams] = useSearchParams();

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
  const [trackingShowAll, setTrackingShowAll] = useState(false);

  const { usuarios: dbUsuarios, loading: usersLoading } = useUsuarios();
  const loggedUserId = localStorage.getItem('rp_logged_user');
  const currentUser = dbUsuarios.find(u => u.id === loggedUserId) || null;
  const fullAccessRoles = ['master', 'SEO', 'admin', 'Admin', 'Administrador', 'administrador', 'adm/dono'];
  const isFullAccess = currentUser ? fullAccessRoles.includes(currentUser.nivel) : false;
  const isMaster = isFullAccess; // Keeping the name for compatibility with existing code where meaningful
  const currentUserName = currentUser?.nome || '';
  const { onlineUserIds } = usePresenceContext();

  // Notification & UI States
  const [showNotif, setShowNotif] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const autoCloseTimer = useRef<NodeJS.Timeout | null>(null);

  const notificacoes = store.getNotificacoes();
  const naoLidas = notificacoes.filter(n => !n.lida).length + unreadChatCount;

  const handleBellClick = () => setShowNotif(!showNotif);

  const handleNotifClick = (n: any) => {
    const updated = notificacoes.map(notif => notif.id === n.id ? { ...notif, lida: true } : notif);
    store.saveNotificacoes(updated);
    if (n.link) navigate(n.link);
    setShowNotif(false);
  };

  const excluirNotif = (id: string) => {
    const updated = notificacoes.filter(n => n.id !== id);
    store.saveNotificacoes(updated);
  };
  const excluirTodas = () => {
    store.saveNotificacoes([]);
    setShowNotif(false);
  };


  // Poll for unread chat messages (migrated from AppLayout)
  const checkUnreadMessages = useCallback(async () => {
    if (!currentUser?.id) return;
    const readKey = `rp_chat_read_${currentUser.id}`;
    const lastRead = localStorage.getItem(readKey);
    const lastReadTime = lastRead ? new Date(lastRead).getTime() : 0;
    const { data: recentData } = await supabase
      .from('chat_messages' as any)
      .select('id, sender_id, created_at')
      .neq('sender_id', currentUser.id)
      .eq('deleted_for_all', false)
      .gt('created_at', new Date(lastReadTime).toISOString());
    if (recentData) {
      const uniqueSenders = new Set((recentData as any[]).map(m => m.sender_id));
      setUnreadChatCount(uniqueSenders.size);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    checkUnreadMessages();
    const interval = setInterval(checkUnreadMessages, 10000);
    return () => clearInterval(interval);
  }, [checkUnreadMessages]);

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

  // Global stats - strictly filtered by role
  const globalOrc = getOrcStats(isFullAccess ? data.orcamentos : getUserOrcs(currentUserName));
  const globalPed = getPedStats(isFullAccess ? data.pedidos : getUserPeds(currentUserName));
  const globalOs = getOsStats(isFullAccess ? data.os : getUserOS(currentUserName));

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

  const orcByStatus = (status: string) => (isFullAccess ? data.orcamentos : getUserOrcs(currentUserName)).filter((o: any) => o.status === status);
  const pedByStatus = (status: string) => (isFullAccess ? data.pedidos : getUserPeds(currentUserName)).filter((p: any) => p.status === status);
  const osByStatus = (status: string) => (isFullAccess ? data.os : getUserOS(currentUserName)).filter((o: any) => o.status === status);

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
          {isFullAccess && (
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="border rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Orçamento → Pedido</p>
              <p className="text-2xl sm:text-3xl font-bold text-primary">{taxaConversao}%</p>
              <p className="text-xs text-muted-foreground">{globalOrc.aprovado} de {globalOrc.total}</p>
            </div>
            <div className="border rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Pedidos Entregues</p>
              <p className="text-2xl sm:text-3xl font-bold text-primary">{globalPed.total > 0 ? ((globalPed.entregue / globalPed.total) * 100).toFixed(1) : 0}%</p>
              <p className="text-xs text-muted-foreground">{globalPed.entregue} de {globalPed.total}</p>
            </div>
            <div className="border rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">O.S. Ativas</p>
              <p className="text-2xl sm:text-3xl font-bold text-primary">{globalOs.total}</p>
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
  /*  USER CARD COMPONENT                                              */
  /* ================================================================ */
  const renderUserCard = (usuario: any, fullWidth = false) => {
    const isOnline = onlineUserIds.has(usuario.id);
    
    return (
      <div 
        key={usuario.id} 
        className="flex items-center justify-between p-3 rounded-2xl hover:bg-[#F8FAFC] transition-all group cursor-pointer"
        onClick={() => window.dispatchEvent(new CustomEvent('rp-open-chat', { detail: { userId: usuario.id } }))}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10 border border-[#E2E8F0] shadow-sm">
              {usuario.foto ? <AvatarImage src={usuario.foto} alt={usuario.nome} /> : null}
              <AvatarFallback className="text-xs font-bold bg-[#223c61] text-white">
                {usuario.nome?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className={`absolute -bottom-0.5 -right-0.5 inline-flex rounded-full h-3 w-3 border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`}></span>
          </div>
          <div>
            <p className="font-bold text-sm text-[#223c61] leading-tight">{usuario.nome}</p>
            <p className="text-[10px] text-[#64748B] font-medium uppercase tracking-wider">{usuario.nivel}</p>
          </div>
        </div>
        
        <div className="flex flex-col items-end">
          <Badge variant="outline" className={`text-[9px] px-1.5 h-4 border-none uppercase ${isOnline ? 'text-green-600' : 'text-gray-400'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
        </div>
      </div>
    );
  };

  /* ================================================================ */
  /*  MAIN DASHBOARD VIEW                                              */
  /* ================================================================ */
  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA: CONTEÚDO PRINCIPAL (9 COLUNAS) */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* 3 CARDS GLOBAIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {/* COMERCIAL */}
            <StatCard 
              icon={TrendingUp} 
              label="Comercial" 
              value={(isMaster ? data.orcamentos : getUserOrcs(currentUserName)).length} 
              color="bg-[#223c61]/10 text-[#223c61]" 
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
              color="bg-[#223c61]/10 text-[#223c61]" 
              onViewAll={() => navigate(isMaster ? '/pedidos' : `/pedidos?vendedor=${currentUserName}`)}
              items={(isMaster ? data.pedidos : getUserPeds(currentUserName))
                .slice(-3).reverse()
                .map((p: any) => {
                  const orc = data.orcamentos.find((o: any) => o.id === p.orcamentoId);
                  return { id: p.id, label: p.numero, user: p.vendedor || orc?.vendedor || 'Sistema' };
                })}
            />

            {/* FÁBRICA */}
            <StatCard 
              icon={Factory} 
              label="Fábrica" 
              value={(isMaster ? data.os : getUserOS(currentUserName)).length} 
              color="bg-[#223c61]/10 text-[#223c61]" 
              onViewAll={() => navigate('/producao')}
              items={(isFullAccess ? data.os : getUserOS(currentUserName))
                .slice(-3).reverse()
                .map((os: any) => {
                  const ped = data.pedidos.find((p: any) => p.id === os.pedidoId);
                  const orc = data.orcamentos.find((o: any) => o.id === ped?.orcamentoId);
                  return { id: os.id, label: os.numero, user: os.responsavelTecnico || os.emitente || orc?.vendedor || 'Manual' };
                })}
            />
          </div>

          {/* MONITOR DE PRODUÇÃO (TABELA LIMPA) */}
          <Card className="rounded-2xl border border-[#E2E8F0] shadow-sm bg-white overflow-hidden">
            <CardHeader className="pb-2 border-b border-[#F1F5F9]">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[#223c61] flex items-center gap-2">
                  <Factory className="h-4 w-4" /> Monitor de Produção
                </h2>
                <Button variant="ghost" size="sm" className="text-xs text-[#64748B]" onClick={() => navigate('/producao')}>
                  Ver tudo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC]/50 text-[#64748B] uppercase tracking-wider text-[10px]">
                      <th className="px-6 py-4 font-bold">O.S.</th>
                      <th className="px-6 py-4 font-bold">Cliente</th>
                      <th className="px-6 py-4 font-bold">Vendedor / Usuário</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 font-bold text-right">Previsão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {(isFullAccess ? data.os : getUserOS(currentUserName))
                      .slice(-6).reverse()
                      .map((os: any) => (
                        <tr 
                          key={os.id} 
                          className="hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                          onClick={() => navigate(`/producao/${os.id}`)}
                        >
                          <td className="px-6 py-4 font-bold text-[#223c61] font-mono">{os.numero}</td>
                          <td className="px-6 py-4 text-[#1E293B]">
                            <div className="font-semibold">{os.empresa}</div>
                            <div className="text-[10px] text-[#64748B]">Ped. {os.pedidoNumero}</div>
                          </td>
                          <td className="px-6 py-4 text-[#1E293B] font-medium">
                            {(() => {
                              const ped = data.pedidos.find((p: any) => p.id === os.pedidoId);
                              const orc = data.orcamentos.find((o: any) => o.id === ped?.orcamentoId);
                              return os.responsavelTecnico || os.emitente || orc?.vendedor || 'Sistema';
                            })()}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border
                              ${os.status === 'CONCLUIDA' ? 'bg-green-50 text-green-600 border-green-100' : 
                                os.status === 'EM_ANDAMENTO' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                                'bg-gray-50 text-gray-500 border-gray-100'}`}
                            >
                              {os.status?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-[#64748B]">
                            {os.entrega || '—'}
                          </td>
                        </tr>
                      ))}
                    {(isFullAccess ? data.os : getUserOS(currentUserName)).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground italic">
                          Nenhuma ordem de serviço ativa no momento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* INDICADORES ADICIONAIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="rounded-2xl border border-[#E2E8F0] shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/orcamentos')}>
              <CardHeader className="pb-2">
                <h2 className="font-bold text-sm text-[#223c61] flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Status dos Orçamentos
                </h2>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatusBar label="Rascunho" value={globalOrc.rascunho} max={globalOrc.total} color="[&>div]:bg-gray-300" extra={avgDays(orcByStatus('RASCUNHO'))} />
                <StatusBar label="Pendente" value={globalOrc.pendente} max={globalOrc.total} color="[&>div]:bg-amber-400" extra={avgDays([...orcByStatus('PENDENTE'), ...orcByStatus('ENVIADO')])} />
                <StatusBar label="Aprovado" value={globalOrc.aprovado} max={globalOrc.total} color="[&>div]:bg-[#223c61]" extra={avgDays(orcByStatus('APROVADO'))} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-[#E2E8F0] shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDashView('conversion-detail')}>
              <CardHeader className="pb-2">
                <h2 className="font-bold text-sm text-[#223c61] flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Taxa de Conversão
                </h2>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-4 mb-2">
                  <span className="text-3xl font-bold text-[#223c61]">{taxaConversao}%</span>
                  <span className="text-xs text-[#64748B] mb-1">{globalOrc.aprovado} aprovados de {globalOrc.total}</span>
                </div>
                <Progress value={taxaConversao} className="h-2 [&>div]:bg-[#223c61]" />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* COLUNA DIREITA: EQUIPE / PRESENÇA (3 COLUNAS) */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="rounded-2xl border border-[#E2E8F0] shadow-sm bg-white h-full min-h-[600px] flex flex-col">
            <CardHeader className="pb-4 border-b border-[#F1F5F9] shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[#223c61] flex items-center gap-2">
                  <Users className="h-4 w-4" /> Equipe
                </h2>
                <Badge className="bg-[#223c61] text-white border-none px-2 py-0 h-5 rounded-full text-[10px]">
                  {onlineUserIds.size} On
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-2 flex-1 overflow-y-auto">
              <div className="space-y-1">
                {usersLoading || !dataLoaded ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-2 w-12" />
                      </div>
                    </div>
                  ))
                ) : (
                  dbUsuarios
                    .filter(u => u.ativo)
                    .sort((a, b) => {
                      const aOn = onlineUserIds.has(a.id) ? 1 : 0;
                      const bOn = onlineUserIds.has(b.id) ? 1 : 0;
                      return bOn - aOn;
                    })
                    .map(u => renderUserCard(u))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AcompanhamentoPedidosModal
        isOpen={isTrackingModalOpen}
        onOpenChange={setIsTrackingModalOpen}
        vendedor={trackingVendor}
        pedidos={data.pedidos}
        orcamentos={data.orcamentos}
        ordensServico={data.os}
        clientes={data.clientes}
        showAll={trackingShowAll}
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
