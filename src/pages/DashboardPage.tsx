import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import { FileText, ShoppingCart, Users, Factory, DollarSign, TrendingUp, Package, AlertTriangle } from 'lucide-react';

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
  });

  useEffect(() => {
    const orc = store.getOrcamentos();
    const ped = store.getPedidos();
    const cli = store.getClientes();
    const os = store.getOrdensServico();
    setData({
      orcamentos: orc.length,
      pedidos: ped.length,
      clientes: cli.length,
      os: os.length,
      orcRecentes: orc.slice(-5).reverse(),
      pedRecentes: ped.slice(-5).reverse(),
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Dashboard</h1>
        <p className="page-subtitle">Visão geral do sistema ROLLERPORT</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Orçamentos" value={data.orcamentos} color="bg-primary/10 text-primary" />
        <StatCard icon={ShoppingCart} label="Pedidos" value={data.pedidos} color="bg-secondary/20 text-secondary" />
        <StatCard icon={Users} label="Clientes" value={data.clientes} color="bg-info/10 text-info" />
        <StatCard icon={Factory} label="Ordens de Serviço" value={data.os} color="bg-accent/10 text-accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimos Orçamentos */}
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

        {/* Últimos Pedidos */}
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
