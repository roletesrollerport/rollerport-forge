import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import { FileText, ShoppingCart, Users, Factory, TrendingUp, CheckCircle, Truck } from 'lucide-react';

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

export default function DashboardPage() {
  const [data, setData] = useState({
    orcamentos: 0, pedidos: 0, clientes: 0, os: 0,
    orcRecentes: [] as any[], pedRecentes: [] as any[],
    taxaOrcPedido: 0,
    pedidosEntregues: 0,
    totalPedidos: 0,
  });

  useEffect(() => {
    const orc = store.getOrcamentos();
    const ped = store.getPedidos();
    const cli = store.getClientes();
    const os = store.getOrdensServico();

    const aprovados = orc.filter(o => o.status === 'APROVADO').length;
    const taxaOrcPedido = orc.length > 0 ? ((aprovados / orc.length) * 100) : 0;
    const pedidosEntregues = ped.filter(p => p.status === 'ENTREGUE').length;

    setData({
      orcamentos: orc.length,
      pedidos: ped.length,
      clientes: cli.length,
      os: os.length,
      orcRecentes: orc.slice(-5).reverse(),
      pedRecentes: ped.slice(-5).reverse(),
      taxaOrcPedido: +taxaOrcPedido.toFixed(1),
      pedidosEntregues,
      totalPedidos: ped.length,
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Início</h1>
        <p className="page-subtitle">Visão geral do sistema ROLLERPORT</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Orçamentos" value={data.orcamentos} color="bg-primary/10 text-primary" />
        <StatCard icon={ShoppingCart} label="Pedidos" value={data.pedidos} color="bg-secondary/20 text-secondary" />
        <StatCard icon={Users} label="Clientes" value={data.clientes} color="bg-info/10 text-info" />
        <StatCard icon={Factory} label="Ordens de Serviço" value={data.os} color="bg-accent/10 text-accent" />
      </div>

      {/* Taxa de Conversão Automática */}
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
              {data.orcamentos > 0
                ? `${Math.round(data.orcamentos * data.taxaOrcPedido / 100)} aprovados de ${data.orcamentos} orçamentos`
                : 'Nenhum orçamento'}
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Truck className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Pedidos Entregues</span>
            </div>
            <p className="text-3xl font-bold text-primary">
              {data.totalPedidos > 0 ? ((data.pedidosEntregues / data.totalPedidos) * 100).toFixed(1) : 0}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.pedidosEntregues} de {data.totalPedidos} pedidos entregues
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Factory className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">O.S. Ativas</span>
            </div>
            <p className="text-3xl font-bold text-primary">{data.os}</p>
            <p className="text-xs text-muted-foreground mt-1">Ordens de serviço em andamento</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Últimos Orçamentos
          </h2>
          {data.orcRecentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum orçamento criado ainda.</p>
          ) : (
            <div className="space-y-2">
              {data.orcRecentes.map((o: any) => (
                <div key={o.id} className="flex justify-between items-center py-2 px-3 rounded bg-muted/50 text-sm">
                  <span className="font-mono font-medium">{o.numero}</span>
                  <span className="text-muted-foreground">{o.clienteNome}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    o.status === 'APROVADO' ? 'bg-success/10 text-success' :
                    o.status === 'ENVIADO' ? 'bg-info/10 text-info' :
                    o.status === 'REPROVADO' ? 'bg-destructive/10 text-destructive' :
                    'bg-muted text-muted-foreground'
                  }`}>{o.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-lg border p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-secondary" /> Últimos Pedidos
          </h2>
          {data.pedRecentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido criado ainda.</p>
          ) : (
            <div className="space-y-2">
              {data.pedRecentes.map((p: any) => (
                <div key={p.id} className="flex justify-between items-center py-2 px-3 rounded bg-muted/50 text-sm">
                  <span className="font-mono font-medium">{p.numero}</span>
                  <span className="text-muted-foreground">{p.clienteNome}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    p.status === 'CONCLUIDO' ? 'bg-success/10 text-success' :
                    p.status === 'EM_PRODUCAO' ? 'bg-warning/10 text-warning' :
                    p.status === 'ENTREGUE' ? 'bg-primary/10 text-primary' :
                    'bg-muted text-muted-foreground'
                  }`}>{p.status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
