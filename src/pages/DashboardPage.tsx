import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { useUsuarios } from '@/hooks/useUsuarios';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  FileText, ShoppingCart, Users, Factory, TrendingUp, CheckCircle, Truck,
  Eye, Printer, Download, Target, Save, Edit, ArrowLeft, Trash2, X,
  User, Circle, Phone, Mail, ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

function StatCard({ icon: Icon, label, value, color, onClick }: { icon: any; label: string; value: string | number; color: string; onClick?: () => void }) {
  return (
    <div
      className={`stat-card flex items-center gap-4 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all' : ''}`}
      onClick={onClick}
    >
      <div className={`flex items-center justify-center h-12 w-12 rounded-lg ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function StatusBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-28 text-muted-foreground truncate">{label}</span>
      <div className="flex-1"><Progress value={pct} className={`h-2 ${color}`} /></div>
      <span className="w-8 text-right font-mono font-medium">{value}</span>
    </div>
  );
}

type DashView = 'main' | 'vendor-detail' | 'vendor-print' | 'report-detail' | 'report-print' | 'conversion-detail' | 'conversion-print';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    orcamentos: [] as any[], pedidos: [] as any[], clientes: [] as any[], os: [] as any[],
    taxaOrcPedido: 0, pedidosEntregues: 0, totalPedidos: 0,
    orcRascunho: 0, orcEnviado: 0, orcAguardando: 0, orcAprovado: 0, orcReprovado: 0,
    pedPendente: 0, pedConfirmado: 0, pedProducao: 0, pedConcluido: 0, pedEntregue: 0,
  });
  const [metas, setMetas] = useState(store.getMetas());
  const [editingMeta, setEditingMeta] = useState<{ vendedor: string; valor: number } | null>(null);
  const [dashView, setDashView] = useState<DashView>('main');
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [selectedReportVendor, setSelectedReportVendor] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  // Fetch real users from database
  const { usuarios: dbUsuarios } = useUsuarios();

  // Current logged-in user
  const currentUser = (() => {
    const loggedIn = localStorage.getItem('rp_logged_user');
    if (loggedIn) {
      return dbUsuarios.find(u => u.id === loggedIn) || null;
    }
    return dbUsuarios.find(u => u.nivel === 'master') || null;
  })();
  const isMaster = currentUser?.nivel === 'master';
  const currentUserName = currentUser?.nome || '';

  // Check which users have active sessions
  useEffect(() => {
    const checkOnline = async () => {
      const now = new Date().toISOString();
      const { data: sessions } = await supabase
        .from('sessions')
        .select('user_id')
        .gt('expires_at', now);
      if (sessions) {
        setOnlineUserIds(new Set(sessions.map((s: any) => s.user_id)));
      }
    };
    checkOnline();
    const interval = setInterval(checkOnline, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const orc = store.getOrcamentos();
    const ped = store.getPedidos();
    const cli = store.getClientes();
    const os = store.getOrdensServico();
    const aprovados = orc.filter(o => o.status === 'APROVADO').length;
    const taxaOrcPedido = orc.length > 0 ? ((aprovados / orc.length) * 100) : 0;
    const pedidosEntregues = ped.filter(p => p.status === 'ENTREGUE').length;
    setData({
      orcamentos: orc, pedidos: ped, clientes: cli, os,
      taxaOrcPedido: +taxaOrcPedido.toFixed(1), pedidosEntregues, totalPedidos: ped.length,
      orcRascunho: orc.filter(o => o.status === 'RASCUNHO').length,
      orcEnviado: orc.filter(o => o.status === 'ENVIADO').length,
      orcAguardando: orc.filter(o => o.status === 'AGUARDANDO').length,
      orcAprovado: aprovados,
      orcReprovado: orc.filter(o => o.status === 'REPROVADO').length,
      pedPendente: ped.filter(p => p.status === 'PENDENTE').length,
      pedConfirmado: ped.filter(p => p.status === 'CONFIRMADO').length,
      pedProducao: ped.filter(p => p.status === 'EM_PRODUCAO').length,
      pedConcluido: ped.filter(p => p.status === 'CONCLUIDO').length,
      pedEntregue: pedidosEntregues,
    });
  }, []);

  const totalOrc = data.orcamentos.length;
  const totalPed = data.pedidos.length;
  const vendedores = dbUsuarios.filter(u => u.nivel === 'vendedor' || u.nivel === 'master' || u.nivel === 'admin');

  // Filter data per user when not master
  const userOrcamentos = isMaster ? data.orcamentos : data.orcamentos.filter((o: any) => o.vendedor === currentUserName);
  const userPedidos = isMaster ? data.pedidos : data.pedidos.filter((p: any) => {
    const orc = data.orcamentos.find((o: any) => o.id === p.orcamentoId);
    return (orc as any)?.vendedor === currentUserName;
  });

  const vendedorStats = (filterVendor?: string) => {
    const list = filterVendor ? vendedores.filter(v => v.nome === filterVendor) : vendedores;
    return list.map(v => {
      const orcVendedor = data.orcamentos.filter((o: any) => o.vendedor === v.nome);
      const pedVendedor = data.pedidos.filter((p: any) => {
        const orc = data.orcamentos.find((o: any) => o.id === p.orcamentoId);
        return (orc as any)?.vendedor === v.nome;
      });
      const totalVendido = pedVendedor.reduce((s: number, p: any) => s + p.valorTotal, 0);
      const meta = metas.find(m => m.vendedor === v.nome);
      const naoFecharam = orcVendedor.filter((o: any) => o.status === 'REPROVADO' || o.status === 'RASCUNHO').length;
      const conversao = orcVendedor.length > 0 ? ((orcVendedor.filter((o: any) => o.status === 'APROVADO').length / orcVendedor.length) * 100) : 0;
      const generoLabel = v.genero === 'F' ? 'Vendedora' : 'Vendedor';
      return {
        id: v.id, nome: v.nome, generoLabel, clientesCadastrados: data.clientes.length,
        orcFeitos: orcVendedor.length,
        conversaoPedido: orcVendedor.filter((o: any) => o.status === 'APROVADO').length,
        naoFecharam, totalVendido, percentualConversao: +conversao.toFixed(1),
        metaMensal: meta?.metaMensal || 0,
      };
    });
  };

  const allVendorStats = vendedorStats();

  const saveMeta = (vendedorNome: string, valor: number) => {
    const existing = metas.find(m => m.vendedor === vendedorNome);
    let updated;
    if (existing) { updated = metas.map(m => m.vendedor === vendedorNome ? { ...m, metaMensal: valor } : m); }
    else { updated = [...metas, { vendedor: vendedorNome, metaMensal: valor }]; }
    store.saveMetas(updated); setMetas(updated); setEditingMeta(null); toast.success('Meta salva!');
  };

  const deleteOrcamento = (id: string) => {
    const updated = data.orcamentos.filter((o: any) => o.id !== id);
    store.saveOrcamentos(updated);
    setData(prev => ({ ...prev, orcamentos: updated }));
    toast.success('Orçamento excluído!');
  };

  const deletePedido = (id: string) => {
    const updated = data.pedidos.filter((p: any) => p.id !== id);
    store.savePedidos(updated);
    setData(prev => ({ ...prev, pedidos: updated }));
    toast.success('Pedido excluído!');
  };

  // ========== VENDOR DETAIL/PRINT VIEW ==========
  if ((dashView === 'vendor-detail' || dashView === 'vendor-print') && selectedVendor) {
    const vs = allVendorStats.find(v => v.nome === selectedVendor);
    if (!vs) return null;
    const metaPct = vs.metaMensal > 0 ? Math.min((vs.totalVendido / vs.metaMensal) * 100, 100) : 0;
    const vendorOrcs = data.orcamentos.filter((o: any) => o.vendedor === selectedVendor);
    const vendorPeds = data.pedidos.filter((p: any) => {
      const orc = data.orcamentos.find((o: any) => o.id === p.orcamentoId);
      return (orc as any)?.vendedor === selectedVendor;
    });
    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden">
          <Button variant="outline" onClick={() => { setDashView('main'); setSelectedVendor(null); }} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          {dashView === 'vendor-detail' && (
            <Button variant="outline" onClick={() => setDashView('vendor-print')} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
          )}
          {dashView === 'vendor-print' && (
            <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
          )}
        </div>
        <div className="bg-card border rounded-lg p-6 max-w-4xl mx-auto print:border-0 print:shadow-none">
          <h2 className="text-xl font-bold mb-6">{vs.generoLabel}: {vs.nome}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div className="border rounded p-3"><span className="text-muted-foreground">Clientes Cadastrados:</span> <strong>{vs.clientesCadastrados}</strong></div>
            <div className="border rounded p-3"><span className="text-muted-foreground">Orçamentos Feitos:</span> <strong>{vs.orcFeitos}</strong></div>
            <div className="border rounded p-3"><span className="text-muted-foreground">Convertidos em Pedido:</span> <strong className="text-success">{vs.conversaoPedido}</strong></div>
            <div className="border rounded p-3"><span className="text-muted-foreground">Não Fecharam:</span> <strong className="text-destructive">{vs.naoFecharam}</strong></div>
            <div className="border rounded p-3"><span className="text-muted-foreground">Total Vendido:</span> <strong>{fmt(vs.totalVendido)}</strong></div>
            <div className="border rounded p-3"><span className="text-muted-foreground">% Conversão:</span> <strong>{vs.percentualConversao}%</strong></div>
            <div className="border rounded p-3"><span className="text-muted-foreground">Meta Mensal:</span> <strong>{vs.metaMensal > 0 ? fmt(vs.metaMensal) : 'Não definida'}</strong></div>
            <div className="border rounded p-3">
              <span className="text-muted-foreground">Progresso:</span>
              {vs.metaMensal > 0 ? (
                <div className="flex items-center gap-2 mt-1"><Progress value={metaPct} className="h-3 flex-1" /><strong>{metaPct.toFixed(0)}%</strong></div>
              ) : <strong> -</strong>}
            </div>
          </div>

          <h3 className="font-semibold text-sm mt-4 mb-2">Orçamentos</h3>
          <table className="w-full text-xs border-collapse mb-4">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left p-2">Nº</th><th className="text-left p-2">Cliente</th><th className="text-left p-2">Data</th>
              <th className="text-right p-2">Valor</th><th className="text-left p-2">Status</th>
              {isMaster && <th className="p-2 w-20 print:hidden">Ações</th>}
            </tr></thead>
            <tbody>
              {vendorOrcs.map((o: any) => (
                <tr key={o.id} className="border-b hover:bg-muted/30">
                  <td className="p-2 font-mono">{o.numero}</td><td className="p-2">{o.clienteNome}</td>
                  <td className="p-2">{o.dataOrcamento || o.createdAt}</td>
                  <td className="p-2 text-right font-mono">{fmt(o.valorTotal)}</td>
                  <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${o.status === 'APROVADO' ? 'bg-success/10 text-success' : o.status === 'REPROVADO' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{o.status}</span></td>
                  {isMaster && (
                    <td className="p-2 print:hidden">
                      <div className="flex gap-1">
                        <button onClick={() => navigate('/orcamentos')} className="p-1 hover:bg-muted rounded" title="Ver/Editar"><Eye className="h-3 w-3" /></button>
                        <button onClick={() => deleteOrcamento(o.id)} className="p-1 hover:bg-muted rounded text-destructive" title="Excluir"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {vendorOrcs.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum orçamento.</td></tr>}
            </tbody>
          </table>

          <h3 className="font-semibold text-sm mt-4 mb-2">Pedidos</h3>
          <table className="w-full text-xs border-collapse">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left p-2">Nº</th><th className="text-left p-2">Cliente</th>
              <th className="text-right p-2">Valor</th><th className="text-left p-2">Status</th>
              {isMaster && <th className="p-2 w-20 print:hidden">Ações</th>}
            </tr></thead>
            <tbody>
              {vendorPeds.map((p: any) => (
                <tr key={p.id} className="border-b hover:bg-muted/30">
                  <td className="p-2 font-mono">{p.numero}</td><td className="p-2">{p.clienteNome}</td>
                  <td className="p-2 text-right font-mono">{fmt(p.valorTotal)}</td>
                  <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${p.status === 'ENTREGUE' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{p.status}</span></td>
                  {isMaster && (
                    <td className="p-2 print:hidden">
                      <div className="flex gap-1">
                        <button onClick={() => navigate('/pedidos')} className="p-1 hover:bg-muted rounded" title="Ver/Editar"><Eye className="h-3 w-3" /></button>
                        <button onClick={() => deletePedido(p.id)} className="p-1 hover:bg-muted rounded text-destructive" title="Excluir"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {vendorPeds.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhum pedido.</td></tr>}
            </tbody>
          </table>
        </div>
        {dashView === 'vendor-print' && (
          <style>{`@media print { @page { margin: 1cm; } body { -webkit-print-color-adjust: exact; } .print\\:hidden { display: none !important; } }`}</style>
        )}
      </div>
    );
  }

  // ========== REPORT DETAIL (per vendor or all) ==========
  if ((dashView === 'report-detail' || dashView === 'report-print')) {
    const filterVendor = selectedReportVendor;
    const reportOrcs = filterVendor ? data.orcamentos.filter((o: any) => o.vendedor === filterVendor) : (isMaster ? data.orcamentos : userOrcamentos);
    const reportPeds = filterVendor ? data.pedidos.filter((p: any) => {
      const orc = data.orcamentos.find((o: any) => o.id === p.orcamentoId);
      return (orc as any)?.vendedor === filterVendor;
    }) : (isMaster ? data.pedidos : userPedidos);
    const reportOS = isMaster ? data.os : data.os.filter((os: any) => {
      const ped = data.pedidos.find((p: any) => p.id === os.pedidoId);
      if (!ped) return false;
      const orc = data.orcamentos.find((o: any) => o.id === (ped as any).orcamentoId);
      return (orc as any)?.vendedor === currentUserName;
    });

    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden">
          <Button variant="outline" onClick={() => { setDashView('main'); setSelectedReportVendor(null); }} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          {dashView === 'report-detail' && (
            <Button variant="outline" onClick={() => setDashView('report-print')} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
          )}
          {dashView === 'report-print' && (
            <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
          )}
          {isMaster && (
            <select value={selectedReportVendor || ''} onChange={e => setSelectedReportVendor(e.target.value || null)}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
              <option value="">Todos os Usuários</option>
              {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
            </select>
          )}
        </div>
        <div className="bg-card border rounded-lg p-6 max-w-5xl mx-auto print:border-0 print:shadow-none space-y-6">
          <h2 className="text-xl font-bold">Relatório Comercial {filterVendor ? `- ${filterVendor}` : '- Todos'}</h2>

          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Orçamentos ({reportOrcs.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left p-2">Nº</th><th className="text-left p-2">Cliente</th><th className="text-left p-2">Vendedor</th>
                  <th className="text-left p-2">Data</th><th className="text-right p-2">Valor</th><th className="text-left p-2">Status</th>
                  <th className="p-2 w-24 print:hidden">Ações</th>
                </tr></thead>
                <tbody>
                  {reportOrcs.map((o: any) => (
                    <tr key={o.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-mono">{o.numero}</td><td className="p-2">{o.clienteNome}</td><td className="p-2">{o.vendedor}</td>
                      <td className="p-2">{o.dataOrcamento || o.createdAt}</td>
                      <td className="p-2 text-right font-mono">{fmt(o.valorTotal)}</td>
                      <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${o.status === 'APROVADO' ? 'bg-success/10 text-success' : o.status === 'REPROVADO' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{o.status}</span></td>
                      <td className="p-2 print:hidden">
                        <div className="flex gap-1">
                          <button onClick={() => navigate('/orcamentos')} className="p-1 hover:bg-muted rounded" title="Ver"><Eye className="h-3 w-3" /></button>
                          <button onClick={() => navigate('/orcamentos')} className="p-1 hover:bg-muted rounded" title="Editar"><Edit className="h-3 w-3" /></button>
                          {isMaster && <button onClick={() => deleteOrcamento(o.id)} className="p-1 hover:bg-muted rounded text-destructive" title="Excluir"><Trash2 className="h-3 w-3" /></button>}
                        </div>
                      </td>
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
                  <th className="p-2 w-24 print:hidden">Ações</th>
                </tr></thead>
                <tbody>
                  {reportPeds.map((p: any) => (
                    <tr key={p.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-mono">{p.numero}</td><td className="p-2">{p.clienteNome}</td>
                      <td className="p-2">{p.dataEntrega}</td>
                      <td className="p-2 text-right font-mono">{fmt(p.valorTotal)}</td>
                      <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${p.status === 'ENTREGUE' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{p.status}</span></td>
                      <td className="p-2 print:hidden">
                        <div className="flex gap-1">
                          <button onClick={() => navigate('/pedidos')} className="p-1 hover:bg-muted rounded" title="Ver"><Eye className="h-3 w-3" /></button>
                          <button onClick={() => navigate('/pedidos')} className="p-1 hover:bg-muted rounded" title="Editar"><Edit className="h-3 w-3" /></button>
                          {isMaster && <button onClick={() => deletePedido(p.id)} className="p-1 hover:bg-muted rounded text-destructive" title="Excluir"><Trash2 className="h-3 w-3" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(isMaster || reportOS.length > 0) && (
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Factory className="h-4 w-4 text-accent" /> Ordens de Serviço ({reportOS.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="text-left p-2">O.S.</th><th className="text-left p-2">Empresa</th><th className="text-left p-2">Pedido</th>
                    <th className="text-left p-2">Status</th>
                    <th className="p-2 w-20 print:hidden">Ações</th>
                  </tr></thead>
                  <tbody>
                    {reportOS.map((os: any) => (
                      <tr key={os.id} className="border-b hover:bg-muted/30">
                        <td className="p-2 font-mono">{os.numero}</td><td className="p-2">{os.empresa}</td><td className="p-2">{os.pedidoNumero}</td>
                        <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${os.status === 'CONCLUIDA' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{os.status?.replace('_', ' ')}</span></td>
                        <td className="p-2 print:hidden">
                          <button onClick={() => navigate('/producao')} className="p-1 hover:bg-muted rounded" title="Ver"><Eye className="h-3 w-3" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Users className="h-4 w-4 text-destructive" /> Tentativas de Interação (Não Fecharam)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left p-2">Nº</th><th className="text-left p-2">Cliente</th><th className="text-left p-2">Vendedor</th>
                  <th className="text-right p-2">Valor</th><th className="text-left p-2">Status</th>
                </tr></thead>
                <tbody>
                  {reportOrcs.filter((o: any) => o.status === 'REPROVADO' || o.status === 'ENVIADO' || o.status === 'AGUARDANDO').map((o: any) => (
                    <tr key={o.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-mono">{o.numero}</td><td className="p-2">{o.clienteNome}</td><td className="p-2">{o.vendedor}</td>
                      <td className="p-2 text-right font-mono">{fmt(o.valorTotal)}</td>
                      <td className="p-2"><span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive/10 text-destructive">{o.status}</span></td>
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

  // ========== CONVERSION DETAIL ==========
  if (dashView === 'conversion-detail' || dashView === 'conversion-print') {
    const convData = allVendorStats.map(v => {
      const orcV = data.orcamentos.filter((o: any) => o.vendedor === v.nome);
      return {
        ...v,
        orcAprovados: orcV.filter((o: any) => o.status === 'APROVADO').length,
        orcReprovados: orcV.filter((o: any) => o.status === 'REPROVADO').length,
        orcEnviados: orcV.filter((o: any) => o.status === 'ENVIADO').length,
        orcAguardando: orcV.filter((o: any) => o.status === 'AGUARDANDO').length,
        orcRascunho: orcV.filter((o: any) => o.status === 'RASCUNHO').length,
      };
    });
    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden">
          <Button variant="outline" onClick={() => setDashView('main')} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          {dashView === 'conversion-detail' && (
            <Button variant="outline" onClick={() => setDashView('conversion-print')} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
          )}
          {dashView === 'conversion-print' && (
            <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
          )}
        </div>
        <div className="bg-card border rounded-lg p-6 max-w-5xl mx-auto print:border-0 print:shadow-none space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Relatório de Taxa de Conversão</h2>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Orçamento → Pedido</p>
              <p className="text-3xl font-bold text-primary">{data.taxaOrcPedido}%</p>
              <p className="text-xs text-muted-foreground">{data.orcAprovado} de {totalOrc}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Pedidos Entregues</p>
              <p className="text-3xl font-bold text-primary">{totalPed > 0 ? ((data.pedidosEntregues / totalPed) * 100).toFixed(1) : 0}%</p>
              <p className="text-xs text-muted-foreground">{data.pedidosEntregues} de {totalPed}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">O.S. Ativas</p>
              <p className="text-3xl font-bold text-primary">{data.os.length}</p>
            </div>
          </div>

          <h3 className="font-semibold text-sm">Conversão por {vendedores.some(v => v.genero === 'F') ? 'Vendedor(a)' : 'Vendedor'}</h3>
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
                  <td className="p-2 text-center">{v.orcFeitos}</td>
                  <td className="p-2 text-center text-success font-medium">{v.orcAprovados}</td>
                  <td className="p-2 text-center text-destructive">{v.orcReprovados}</td>
                  <td className="p-2 text-center">{v.orcEnviados}</td>
                  <td className="p-2 text-center">{v.orcAguardando}</td>
                  <td className="p-2 text-center">{v.orcRascunho}</td>
                  <td className="p-2 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v.percentualConversao >= 50 ? 'bg-success/10 text-success' : v.percentualConversao >= 25 ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive'}`}>{v.percentualConversao}%</span></td>
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

  // ========== MAIN DASHBOARD ==========

  // Build enhanced user card component
  const renderUserCard = (usuario: any) => {
    const isVendedor = usuario.nivel === 'vendedor' || usuario.nivel === 'master' || usuario.nivel === 'admin';
    const isOnline = onlineUserIds.has(usuario.id);
    const vs = isVendedor ? allVendorStats.find(v => v.nome === usuario.nome) : null;
    const metaPct = vs && vs.metaMensal > 0 ? Math.min((vs.totalVendido / vs.metaMensal) * 100, 100) : 0;

    // Per-user stats
    const userOrcs = data.orcamentos.filter((o: any) => o.vendedor === usuario.nome);
    const userPeds = data.pedidos.filter((p: any) => {
      const orc = data.orcamentos.find((o: any) => o.id === p.orcamentoId);
      return (orc as any)?.vendedor === usuario.nome;
    });
    const userOS = data.os.filter((os: any) => {
      const ped = data.pedidos.find((p: any) => p.id === os.pedidoId);
      if (!ped) return false;
      const orc = data.orcamentos.find((o: any) => o.id === (ped as any).orcamentoId);
      return (orc as any)?.vendedor === usuario.nome;
    });

    // Status breakdown
    const statusRascunho = userOrcs.filter((o: any) => o.status === 'RASCUNHO').length;
    const statusAprovado = userOrcs.filter((o: any) => o.status === 'APROVADO').length;
    const statusEmProducao = userPeds.filter((p: any) => p.status === 'EM_PRODUCAO').length;

    return (
      <Card key={usuario.id} className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-12 w-12">
                {usuario.foto ? <AvatarImage src={usuario.foto} alt={usuario.nome} /> : null}
                <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                  {usuario.nome?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Circle className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 ${isOnline ? 'text-success fill-success' : 'text-muted-foreground fill-muted'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate">{usuario.nome}</p>
                <Badge variant={usuario.ativo ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                  {usuario.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <span className={`text-[10px] ${isOnline ? 'text-success' : 'text-muted-foreground'}`}>{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          {/* Individual Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/40 p-2">
              <FileText className="h-3.5 w-3.5 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold">{userOrcs.length}</p>
              <p className="text-[10px] text-muted-foreground">Orçamentos</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <ShoppingCart className="h-3.5 w-3.5 mx-auto mb-1 text-secondary" />
              <p className="text-lg font-bold">{userPeds.length}</p>
              <p className="text-[10px] text-muted-foreground">Pedidos</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <ClipboardList className="h-3.5 w-3.5 mx-auto mb-1 text-accent-foreground" />
              <p className="text-lg font-bold">{userOS.length}</p>
              <p className="text-[10px] text-muted-foreground">O.S.</p>
            </div>
          </div>

          {/* Meta do Mês */}
          {vs && (
            <div className="text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground font-medium">Meta do Mês</span>
                {isMaster && editingMeta?.vendedor === usuario.nome ? (
                  <div className="flex items-center gap-1">
                    <Input type="number" step="0.01" className="h-5 w-20 text-[10px] px-1" value={editingMeta.valor || ''} onChange={e => setEditingMeta({ ...editingMeta, valor: +e.target.value })} autoFocus />
                    <button onClick={() => saveMeta(usuario.nome, editingMeta.valor)} className="text-success hover:text-success/80"><Save className="h-3 w-3" /></button>
                    <button onClick={() => setEditingMeta(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <strong>{vs.metaMensal > 0 ? fmt(vs.metaMensal) : 'Não definida'}</strong>
                    {isMaster && <button onClick={() => setEditingMeta({ vendedor: usuario.nome, valor: vs.metaMensal })} className="text-muted-foreground hover:text-primary"><Edit className="h-3 w-3" /></button>}
                  </div>
                )}
              </div>
              {vs.metaMensal > 0 && (
                <div className="flex items-center gap-2">
                  <Progress value={metaPct} className="h-2 flex-1" />
                  <span className="text-[10px] font-mono font-medium">{metaPct.toFixed(0)}%</span>
                </div>
              )}
              {vs.metaMensal > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">{fmt(vs.totalVendido)} de {fmt(vs.metaMensal)}</p>
              )}
            </div>
          )}

          {/* Status Summary */}
          <div className="flex items-center gap-2 flex-wrap text-[10px]">
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              Rascunho: {statusRascunho}
            </span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-success/10 text-success font-medium">
              Aprovado: {statusAprovado}
            </span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/10 text-secondary font-medium">
              Em Produção: {statusEmProducao}
            </span>
          </div>
        </CardContent>

        <CardFooter className="flex gap-2 pt-0">
          <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={() => { setSelectedVendor(usuario.nome); setDashView('vendor-detail'); }}>
            <Eye className="h-3 w-3" /> Ver Relatório
          </Button>
          <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={() => { setSelectedVendor(usuario.nome); setDashView('vendor-print'); }}>
            <Printer className="h-3 w-3" /> Imprimir
          </Button>
        </CardFooter>
      </Card>
    );
  };

  // For vendedor: show only their own card
  const myVendorStats = allVendorStats.find(v => v.nome === currentUserName);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Início</h1>
        <p className="page-subtitle">Visão geral do sistema ROLLERPORT{!isMaster ? ` – ${currentUserName}` : ''}</p>
      </div>

      {/* Clickable stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Orçamentos" value={isMaster ? totalOrc : userOrcamentos.length} color="bg-primary/10 text-primary" onClick={() => navigate('/orcamentos')} />
        <StatCard icon={ShoppingCart} label="Pedidos" value={isMaster ? totalPed : userPedidos.length} color="bg-secondary/20 text-secondary" onClick={() => navigate('/pedidos')} />
        <StatCard icon={Users} label="Clientes" value={data.clientes.length} color="bg-info/10 text-info" onClick={() => navigate('/clientes')} />
        <StatCard icon={Factory} label="Ordens de Serviço" value={data.os.length} color="bg-accent/10 text-accent" onClick={() => navigate('/producao')} />
      </div>

      {/* Status bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Status dos Orçamentos</h2>
          <div className="space-y-3">
            <StatusBar label="Rascunho" value={data.orcRascunho} max={totalOrc} color="[&>div]:bg-muted-foreground" />
            <StatusBar label="Enviado" value={data.orcEnviado} max={totalOrc} color="[&>div]:bg-info" />
            <StatusBar label="Aguardando" value={data.orcAguardando} max={totalOrc} color="[&>div]:bg-secondary" />
            <StatusBar label="Aprovado" value={data.orcAprovado} max={totalOrc} color="[&>div]:bg-success" />
            <StatusBar label="Cancelado" value={data.orcReprovado} max={totalOrc} color="[&>div]:bg-destructive" />
          </div>
        </div>
        <div className="bg-card rounded-lg border p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-secondary" /> Status dos Pedidos</h2>
          <div className="space-y-3">
            <StatusBar label="Confirmado" value={data.pedConfirmado} max={totalPed} color="[&>div]:bg-info" />
            <StatusBar label="Em Produção" value={data.pedProducao} max={totalPed} color="[&>div]:bg-secondary" />
            <StatusBar label="Pendente" value={data.pedPendente} max={totalPed} color="[&>div]:bg-muted-foreground" />
            <StatusBar label="Entregue" value={data.pedEntregue} max={totalPed} color="[&>div]:bg-success" />
          </div>
        </div>
      </div>

      {/* Taxa de Conversão */}
      <div className="bg-card rounded-lg border p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDashView('conversion-detail')}>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Taxa de Conversão
          <span className="text-[10px] text-muted-foreground ml-2">(clique para relatório completo)</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="text-center p-4 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center gap-2 mb-2"><CheckCircle className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">Orçamento → Pedido</span></div>
            <p className="text-3xl font-bold text-primary">{data.taxaOrcPedido}%</p>
            <p className="text-xs text-muted-foreground mt-1">{totalOrc > 0 ? `${data.orcAprovado} aprovados de ${totalOrc}` : 'Nenhum orçamento'}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center gap-2 mb-2"><Truck className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">Pedidos Entregues</span></div>
            <p className="text-3xl font-bold text-primary">{totalPed > 0 ? ((data.pedidosEntregues / totalPed) * 100).toFixed(1) : 0}%</p>
            <p className="text-xs text-muted-foreground mt-1">{data.pedidosEntregues} de {totalPed} pedidos</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center gap-2 mb-2"><Factory className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">O.S. Ativas</span></div>
            <p className="text-3xl font-bold text-primary">{data.os.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Ordens em andamento</p>
          </div>
        </div>
      </div>

      {/* User Cards Grid - replaces Relatórios Comerciais */}
      {isMaster ? (
        <div>
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Usuários do Sistema</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {dbUsuarios.filter(u => u.ativo).map(u => renderUserCard(u))}
          </div>
        </div>
      ) : myVendorStats ? (
        <div>
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Minha Performance</h2>
          <div className="max-w-md">
            {currentUser && renderUserCard(currentUser)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
