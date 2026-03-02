import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  FileText, ShoppingCart, Users, Factory, TrendingUp, CheckCircle, Truck,
  Eye, Printer, Download, Target, Save
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="stat-card flex items-center gap-4">
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
      <div className="flex-1">
        <Progress value={pct} className={`h-2 ${color}`} />
      </div>
      <span className="w-8 text-right font-mono font-medium">{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState({
    orcamentos: [] as any[], pedidos: [] as any[], clientes: [] as any[], os: [] as any[],
    taxaOrcPedido: 0, pedidosEntregues: 0, totalPedidos: 0,
    orcRascunho: 0, orcEnviado: 0, orcAguardando: 0, orcAprovado: 0, orcReprovado: 0,
    pedPendente: 0, pedConfirmado: 0, pedProducao: 0, pedConcluido: 0, pedEntregue: 0,
  });
  const [metas, setMetas] = useState(store.getMetas());
  const [editingMeta, setEditingMeta] = useState<{ vendedor: string; valor: number } | null>(null);

  // Check if current user is master (simplified - in production use auth)
  const currentUser = store.getUsuarios().find(u => u.nivel === 'master');
  const isMaster = !!currentUser;

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
      taxaOrcPedido: +taxaOrcPedido.toFixed(1),
      pedidosEntregues, totalPedidos: ped.length,
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

  const usuarios = store.getUsuarios();
  const vendedores = usuarios.filter(u => u.nivel === 'vendedor' || u.nivel === 'master');

  const vendedorStats = vendedores.map(v => {
    const orcVendedor = data.orcamentos.filter((o: any) => o.vendedor === v.nome);
    const pedVendedor = data.pedidos.filter((p: any) => {
      const orc = data.orcamentos.find((o: any) => o.id === p.orcamentoId);
      return (orc as any)?.vendedor === v.nome;
    });
    const totalVendido = pedVendedor.reduce((s: number, p: any) => s + p.valorTotal, 0);
    const meta = metas.find(m => m.vendedor === v.nome);
    const naoFecharam = orcVendedor.filter((o: any) => o.status === 'REPROVADO' || o.status === 'RASCUNHO').length;
    const conversao = orcVendedor.length > 0 ? ((orcVendedor.filter((o: any) => o.status === 'APROVADO').length / orcVendedor.length) * 100) : 0;

    return {
      nome: v.nome,
      clientesCadastrados: data.clientes.length,
      orcFeitos: orcVendedor.length,
      conversaoPedido: orcVendedor.filter((o: any) => o.status === 'APROVADO').length,
      naoFecharam,
      totalVendido,
      percentualConversao: +conversao.toFixed(1),
      metaMensal: meta?.metaMensal || 0,
    };
  });

  const saveMeta = (vendedorNome: string, valor: number) => {
    const existing = metas.find(m => m.vendedor === vendedorNome);
    let updated;
    if (existing) {
      updated = metas.map(m => m.vendedor === vendedorNome ? { ...m, metaMensal: valor } : m);
    } else {
      updated = [...metas, { vendedor: vendedorNome, metaMensal: valor }];
    }
    store.saveMetas(updated);
    setMetas(updated);
    setEditingMeta(null);
    toast.success('Meta salva!');
  };

  const clientesNaoFecharam = data.orcamentos
    .filter((o: any) => o.status === 'REPROVADO' || o.status === 'ENVIADO' || o.status === 'AGUARDANDO')
    .map((o: any) => ({ numero: o.numero, cliente: o.clienteNome, data: o.dataOrcamento, valor: o.valorTotal, status: o.status }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Início</h1>
        <p className="page-subtitle">Visão geral do sistema ROLLERPORT</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Orçamentos" value={totalOrc} color="bg-primary/10 text-primary" />
        <StatCard icon={ShoppingCart} label="Pedidos" value={totalPed} color="bg-secondary/20 text-secondary" />
        <StatCard icon={Users} label="Clientes" value={data.clientes.length} color="bg-info/10 text-info" />
        <StatCard icon={Factory} label="Ordens de Serviço" value={data.os.length} color="bg-accent/10 text-accent" />
      </div>

      {/* Barras de Progresso */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Status dos Orçamentos
          </h2>
          <div className="space-y-3">
            <StatusBar label="Rascunho" value={data.orcRascunho} max={totalOrc} color="[&>div]:bg-muted-foreground" />
            <StatusBar label="Enviado" value={data.orcEnviado} max={totalOrc} color="[&>div]:bg-info" />
            <StatusBar label="Aguardando" value={data.orcAguardando} max={totalOrc} color="[&>div]:bg-secondary" />
            <StatusBar label="Aprovado" value={data.orcAprovado} max={totalOrc} color="[&>div]:bg-success" />
            <StatusBar label="Cancelado" value={data.orcReprovado} max={totalOrc} color="[&>div]:bg-destructive" />
          </div>
        </div>

        <div className="bg-card rounded-lg border p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-secondary" /> Status dos Pedidos
          </h2>
          <div className="space-y-3">
            <StatusBar label="Confirmado" value={data.pedConfirmado} max={totalPed} color="[&>div]:bg-info" />
            <StatusBar label="Em Produção" value={data.pedProducao} max={totalPed} color="[&>div]:bg-secondary" />
            <StatusBar label="Pendente" value={data.pedPendente} max={totalPed} color="[&>div]:bg-muted-foreground" />
            <StatusBar label="Entregue" value={data.pedEntregue} max={totalPed} color="[&>div]:bg-success" />
          </div>
        </div>
      </div>

      {/* Taxa de Conversão */}
      <div className="bg-card rounded-lg border p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Taxa de Conversão
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="text-center p-4 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Orçamento → Pedido</span>
            </div>
            <p className="text-3xl font-bold text-primary">{data.taxaOrcPedido}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalOrc > 0 ? `${data.orcAprovado} aprovados de ${totalOrc}` : 'Nenhum orçamento'}
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Truck className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Pedidos Entregues</span>
            </div>
            <p className="text-3xl font-bold text-primary">
              {totalPed > 0 ? ((data.pedidosEntregues / totalPed) * 100).toFixed(1) : 0}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.pedidosEntregues} de {totalPed} pedidos
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Factory className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">O.S. Ativas</span>
            </div>
            <p className="text-3xl font-bold text-primary">{data.os.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Ordens em andamento</p>
          </div>
        </div>
      </div>

      {/* Relatórios Comerciais - GRID */}
      <div className="bg-card rounded-lg border p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Relatórios Comerciais
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Nº</th>
                <th className="text-left p-3 font-medium">Cliente</th>
                <th className="text-left p-3 font-medium">Data</th>
                <th className="text-right p-3 font-medium">Valor</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Tipo</th>
                <th className="p-3 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.orcamentos.slice(-10).reverse().map((o: any) => (
                <tr key={`o-${o.id}`} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{o.numero}</td>
                  <td className="p-3">{o.clienteNome}</td>
                  <td className="p-3 text-muted-foreground">{o.dataOrcamento || o.createdAt}</td>
                  <td className="p-3 text-right font-mono">{fmt(o.valorTotal)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      o.status === 'APROVADO' ? 'bg-success/10 text-success' :
                      o.status === 'ENVIADO' ? 'bg-info/10 text-info' :
                      o.status === 'REPROVADO' ? 'bg-destructive/10 text-destructive' :
                      o.status === 'AGUARDANDO' ? 'bg-secondary/10 text-secondary' :
                      'bg-muted text-muted-foreground'
                    }`}>{o.status}</span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">Orçamento</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button className="p-1 rounded hover:bg-muted" title="Ver"><Eye className="h-3.5 w-3.5" /></button>
                      <button className="p-1 rounded hover:bg-muted" title="Imprimir"><Printer className="h-3.5 w-3.5" /></button>
                      <button className="p-1 rounded hover:bg-muted" title="PDF"><Download className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.pedidos.slice(-5).reverse().map((p: any) => (
                <tr key={`p-${p.id}`} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{p.numero}</td>
                  <td className="p-3">{p.clienteNome}</td>
                  <td className="p-3 text-muted-foreground">{p.createdAt}</td>
                  <td className="p-3 text-right font-mono">{fmt(p.valorTotal)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      p.status === 'ENTREGUE' || p.status === 'CONCLUIDO' ? 'bg-success/10 text-success' :
                      p.status === 'EM_PRODUCAO' ? 'bg-secondary/10 text-secondary' :
                      'bg-muted text-muted-foreground'
                    }`}>{p.status.replace('_', ' ')}</span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">Pedido</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button className="p-1 rounded hover:bg-muted" title="Ver"><Eye className="h-3.5 w-3.5" /></button>
                      <button className="p-1 rounded hover:bg-muted" title="Imprimir"><Printer className="h-3.5 w-3.5" /></button>
                      <button className="p-1 rounded hover:bg-muted" title="PDF"><Download className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {totalOrc === 0 && totalPed === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum registro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clientes que não fecharam */}
      {clientesNaoFecharam.length > 0 && (
        <div className="bg-card rounded-lg border p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-destructive" /> Clientes que Não Fecharam
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Nº Orçamento</th>
                  <th className="text-left p-3 font-medium">Cliente</th>
                  <th className="text-left p-3 font-medium">Data</th>
                  <th className="text-right p-3 font-medium">Valor</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {clientesNaoFecharam.map((c, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{c.numero}</td>
                    <td className="p-3">{c.cliente}</td>
                    <td className="p-3 text-muted-foreground">{c.data}</td>
                    <td className="p-3 text-right font-mono">{fmt(c.valor)}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Evolução do Vendedor - GRID with Meta editing */}
      <div className="bg-card rounded-lg border p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> Evolução do Vendedor
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Vendedor</th>
                <th className="text-center p-3 font-medium">Clientes</th>
                <th className="text-center p-3 font-medium">Orçamentos</th>
                <th className="text-center p-3 font-medium">Conversão</th>
                <th className="text-center p-3 font-medium">Não Fecharam</th>
                <th className="text-right p-3 font-medium">Total Vendido</th>
                <th className="text-center p-3 font-medium">% Conversão</th>
                <th className="text-right p-3 font-medium">Meta Mensal</th>
                <th className="text-center p-3 font-medium">Progresso</th>
              </tr>
            </thead>
            <tbody>
              {vendedorStats.map((v, i) => {
                const metaPct = v.metaMensal > 0 ? Math.min((v.totalVendido / v.metaMensal) * 100, 100) : 0;
                return (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{v.nome}</td>
                    <td className="p-3 text-center">{v.clientesCadastrados}</td>
                    <td className="p-3 text-center">{v.orcFeitos}</td>
                    <td className="p-3 text-center font-medium text-success">{v.conversaoPedido}</td>
                    <td className="p-3 text-center text-destructive">{v.naoFecharam}</td>
                    <td className="p-3 text-right font-mono">{fmt(v.totalVendido)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        v.percentualConversao >= 50 ? 'bg-success/10 text-success' :
                        v.percentualConversao >= 25 ? 'bg-secondary/10 text-secondary' :
                        'bg-destructive/10 text-destructive'
                      }`}>{v.percentualConversao}%</span>
                    </td>
                    <td className="p-3 text-right">
                      {editingMeta?.vendedor === v.nome ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-7 w-24 text-xs"
                            value={editingMeta.valor || ''}
                            onChange={e => setEditingMeta({ ...editingMeta, valor: +e.target.value })}
                            autoFocus
                          />
                          <button onClick={() => saveMeta(v.nome, editingMeta.valor)} className="text-success hover:text-success/80">
                            <Save className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`font-mono ${isMaster ? 'cursor-pointer hover:text-primary underline decoration-dashed' : ''}`}
                          onClick={() => isMaster && setEditingMeta({ vendedor: v.nome, valor: v.metaMensal })}
                          title={isMaster ? 'Clique para editar meta' : 'Somente Master pode editar'}
                        >
                          {v.metaMensal > 0 ? fmt(v.metaMensal) : '-'}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {v.metaMensal > 0 && (
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <Progress value={metaPct} className="h-2 flex-1" />
                          <span className="text-xs font-mono">{metaPct.toFixed(0)}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {vendedorStats.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhum vendedor cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {isMaster && <p className="text-[10px] text-muted-foreground mt-2">💡 Clique no valor da meta para editar (somente Master)</p>}
      </div>
    </div>
  );
}
