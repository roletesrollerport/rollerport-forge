import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Pedido, Orcamento, OrdemServico, Cliente } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Package, Truck, CheckCircle2, MessageCircle, Clock, Eye, Printer, Factory } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';
import { Input } from '@/components/ui/input';
import { Search, History, ListFilter } from 'lucide-react';
import { store } from '@/lib/store';

interface AcompanhamentoPedidosModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  vendedor: string;
  pedidos: Pedido[];
  orcamentos: Orcamento[];
  ordensServico?: OrdemServico[];
  clientes?: Cliente[];
  onMetaUpdate: (valorSoma: number) => void;
  showAll?: boolean;
}

const statusProgress: Record<string, number> = {
  'PENDENTE': 20, 'CONFIRMADO': 40, 'EM_PRODUCAO': 60, 'CONCLUIDO': 80, 'ENTREGUE': 100,
};

function StatusProgressBar({ status }: { status: string }) {
  const pct = statusProgress[status] || 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <Progress value={pct} className="h-2 flex-1" />
      <span className={`text-xs font-medium whitespace-nowrap ${status === 'ENTREGUE' || status === 'CONCLUIDO' ? 'text-emerald-600' : status === 'EM_PRODUCAO' ? 'text-amber-600' : 'text-muted-foreground'}`}>
        {status.replace('_', ' ')}
      </span>
    </div>
  );
}

const daysSince = (dateStr: string): number => {
  if (!dateStr) return 0;
  const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr.split('/').reverse().join('-'));
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
};

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

function nameMatch(vendedorField: string, userName: string): boolean {
  const a = (vendedorField || '').trim().toLowerCase();
  const b = (userName || '').trim().toLowerCase();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a) || a.split(' ')[0] === b.split(' ')[0];
}

export function AcompanhamentoPedidosModal({
  isOpen,
  onOpenChange,
  vendedor,
  pedidos,
  orcamentos,
  ordensServico: osProp,
  clientes: clientesProp,
  onMetaUpdate,
  showAll = false,
}: AcompanhamentoPedidosModalProps) {
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFullHistory, setShowFullHistory] = useState(false);

  const ordensServico = useMemo(() => osProp && osProp.length > 0 ? osProp : store.getOrdensServico(), [osProp]);
  const clientes = useMemo(() => clientesProp && clientesProp.length > 0 ? clientesProp : store.getClientes(), [clientesProp]);

  const allRelevantPedidos = useMemo(() => {
    if (showAll) return pedidos;
    return pedidos.filter((p) => {
      const orc = orcamentos.find((o) => o.id === p.orcamentoId);
      return orc && nameMatch(orc.vendedor, vendedor);
    });
  }, [pedidos, orcamentos, vendedor, showAll]);

  const matchesSearch = (p: Pedido) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const orc = orcamentos.find(o => o.id === p.orcamentoId);
    const os = ordensServico.find((o: any) => o.pedidoId === p.id);
    const cliente = clientes.find((c: any) => c.nome === p.clienteNome || c.id === p.cliente_id);
    const compradorMatch = cliente?.compradores?.some((comp: any) =>
      comp.nome?.toLowerCase().includes(term) || comp.telefone?.toLowerCase().includes(term) || comp.email?.toLowerCase().includes(term)
    ) || false;
    return p.numero?.toLowerCase().includes(term) ||
      p.clienteNome?.toLowerCase().includes(term) ||
      (orc?.numero || '').toLowerCase().includes(term) ||
      ((os as any)?.numero || '').toLowerCase().includes(term) ||
      ((cliente as any)?.cnpj || '').toLowerCase().includes(term) ||
      ((cliente as any)?.telefone || '').toLowerCase().includes(term) ||
      ((cliente as any)?.email || '').toLowerCase().includes(term) ||
      compradorMatch;
  };

  const activePedidos = useMemo(() =>
    allRelevantPedidos
      .filter(p => p.status !== 'ENTREGUE' && matchesSearch(p))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allRelevantPedidos, searchTerm]
  );

  const deliveredPedidos = useMemo(() =>
    allRelevantPedidos
      .filter(p => p.status === 'ENTREGUE' && matchesSearch(p))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allRelevantPedidos, searchTerm]
  );

  const displayedHistory = showFullHistory ? deliveredPedidos : deliveredPedidos.slice(0, 3);

  const handleStatusChange = async (pedido: Pedido, newStatus: string) => {
    if (updatingId) return;
    setUpdatingId(pedido.id);
    try {
      const isRevertingFromEntregue = pedido.status === 'ENTREGUE' && newStatus !== 'ENTREGUE';
      const isMarkingAsEntregue = pedido.status !== 'ENTREGUE' && newStatus === 'ENTREGUE';
      let saveStatus = newStatus;
      if (isRevertingFromEntregue && newStatus !== 'EM_PRODUCAO' && newStatus !== 'CONCLUIDO') {
        saveStatus = 'CONFIRMADO';
      }
      const { error: pedError } = await supabase
        .from('pedidos')
        .update({ data: { ...pedido, status: saveStatus, updatedAt: new Date().toISOString() }, updated_at: new Date().toISOString() })
        .eq('id', pedido.id);
      if (pedError) throw pedError;
      const idx = pedidos.findIndex(p => p.id === pedido.id);
      if (idx !== -1) {
        pedidos[idx].status = saveStatus as any;
        pedidos[idx].updatedAt = new Date().toISOString();
        store.savePedidos(pedidos);
      }
      if (isMarkingAsEntregue) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#F97316', '#FFFFFF', '#000000'] });
        toast({ title: "Parabéns! 🎉", description: `Venda de ${formatCurrency(pedido.valorTotal)} computada na meta!`, className: "bg-success text-white border-success" });
        onMetaUpdate(pedido.valorTotal);
        try { await (supabase.from as any)('logs_entrega').insert({ pedido_id: pedido.id, vendedor, acao: 'ENTREGUE', valor: pedido.valorTotal }); } catch {}
      } else if (isRevertingFromEntregue) {
        onMetaUpdate(-pedido.valorTotal);
        try { await (supabase.from as any)('logs_entrega').insert({ pedido_id: pedido.id, vendedor, acao: 'REVERTIDO', valor: -pedido.valorTotal }); } catch {}
        toast({ title: "Status Revertido", description: `O pedido ${pedido.numero} voltou para ${saveStatus.replace('_', ' ')}` });
      } else {
        toast({ title: "Status Atualizado", description: `O pedido ${pedido.numero} agora está ${saveStatus.replace('_', ' ')}` });
      }
      window.dispatchEvent(new CustomEvent('rp-data-synced'));
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({ title: "Erro", description: "Não foi possível atualizar o status do pedido.", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const notifyWhatsApp = (pedido: Pedido) => {
    const text = `Olá, os roletes da Rollerport referente ao pedido ${pedido.numero} acabaram de ser entregues! Qualquer dúvida, estou à disposição.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const getEnrichedData = (pedido: Pedido) => {
    const orc = orcamentos.find(o => o.id === pedido.orcamentoId);
    const os = ordensServico.find((o: any) => o.pedidoId === pedido.id);
    return { orc, os };
  };

  const renderPedidoRow = (p: Pedido) => {
    const { orc, os } = getEnrichedData(p);
    const days = daysSince(p.createdAt);
    const lastStatusChange = p.statusHistory?.length ? p.statusHistory[p.statusHistory.length - 1] : null;
    const daysInStatus = lastStatusChange ? daysSince(lastStatusChange.date) : days;
    const isActive = p.status !== 'ENTREGUE';

    return (
      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
        <td className="p-3 font-mono font-medium text-xs">{p.numero}</td>
        <td className="p-3 font-mono text-xs text-muted-foreground hidden md:table-cell">{orc?.numero || p.orcamentoNumero || '—'}</td>
        <td className="p-3 font-mono text-xs text-blue-600 hidden md:table-cell">{(os as any)?.numero || '—'}</td>
        <td className="p-3 text-xs">{p.clienteNome}</td>
        <td className="p-3 hidden md:table-cell text-xs">{p.createdAt}</td>
        <td className="p-3"><StatusProgressBar status={p.status} /></td>
        <td className="p-3 hidden md:table-cell">
          <div className="flex flex-col text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {days}d</span>
            <span className="text-[10px]">No status: {daysInStatus}d</span>
          </div>
        </td>
        <td className="p-3 text-right font-mono text-xs font-semibold">{fmt(p.valorTotal)}</td>
        <td className="p-3">
          <div className="flex gap-1 justify-end flex-wrap">
            {isActive && p.status === 'EM_PRODUCAO' && (
              <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" disabled={updatingId === p.id}
                onClick={() => handleStatusChange(p, 'CONCLUIDO')}>Concluir</Button>
            )}
            {isActive && p.status === 'CONCLUIDO' && (
              <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" disabled={updatingId === p.id}
                onClick={() => handleStatusChange(p, 'ENTREGUE')}>Entregar</Button>
            )}
            {isActive && (
              <Button size="sm" className="text-[10px] h-6 px-2 bg-orange-600 hover:bg-orange-700 text-white gap-1" disabled={updatingId === p.id}
                onClick={() => handleStatusChange(p, 'ENTREGUE')}>
                <CheckCircle2 className="h-3 w-3" /> Entregue
              </Button>
            )}
            {!isActive && (
              <Button variant="outline" size="sm" className="h-6 w-6 p-0 rounded-full border-green-200 text-green-600 hover:bg-green-50"
                onClick={() => notifyWhatsApp(p)}>
                <MessageCircle className="w-3 h-3" />
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Acompanhamento de Pedidos — {vendedor}
          </DialogTitle>
          <DialogDescription>
            {allRelevantPedidos.length} pedido(s) • {activePedidos.length} ativo(s) • {deliveredPedidos.length} entregue(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2 pb-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por Pedido, Orçamento, O.S., Cliente, CNPJ, Comprador, Telefone, Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          {/* ACTIVE - Table format like PedidosPage */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
              <ListFilter className="h-4 w-4" />
              Pedidos Ativos
              <Badge variant="outline" className="ml-2 font-mono">{activePedidos.length}</Badge>
            </div>

            {activePedidos.length === 0 ? (
              <div className="text-center py-6 bg-muted/20 rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">
                  {allRelevantPedidos.length === 0 ? 'Nenhum pedido encontrado para este vendedor.' : 'Nenhum pedido ativo encontrado.'}
                </p>
              </div>
            ) : (
              <div className="bg-card rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-xs">Nº Pedido</th>
                      <th className="text-left p-3 font-medium text-xs hidden md:table-cell">Nº Orçamento</th>
                      <th className="text-left p-3 font-medium text-xs hidden md:table-cell">Nº O.S.</th>
                      <th className="text-left p-3 font-medium text-xs">Empresa</th>
                      <th className="text-left p-3 font-medium text-xs hidden md:table-cell">Data</th>
                      <th className="text-left p-3 font-medium text-xs min-w-[140px]">Status</th>
                      <th className="text-left p-3 font-medium text-xs hidden md:table-cell">Dias</th>
                      <th className="text-right p-3 font-medium text-xs">Valor</th>
                      <th className="p-3 font-medium text-xs text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePedidos.map(p => renderPedidoRow(p))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="h-px bg-muted" />

          {/* HISTORY - Same table format */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-bold text-muted-foreground uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4" /> Histórico de Entregas
                <Badge variant="outline" className="ml-1 font-mono">{deliveredPedidos.length}</Badge>
              </div>
              {deliveredPedidos.length > 3 && (
                <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 hover:bg-primary/10 text-primary"
                  onClick={() => setShowFullHistory(!showFullHistory)}>
                  {showFullHistory ? 'Ver Menos' : `Ver Tudo (${deliveredPedidos.length})`}
                </Button>
              )}
            </div>

            {displayedHistory.length === 0 ? (
              <div className="text-center py-4 bg-muted/10 rounded-lg">
                <p className="text-xs text-muted-foreground italic">Nenhuma entrega registrada ainda.</p>
              </div>
            ) : (
              <div className="bg-card rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-xs">Nº Pedido</th>
                      <th className="text-left p-3 font-medium text-xs hidden md:table-cell">Nº Orçamento</th>
                      <th className="text-left p-3 font-medium text-xs hidden md:table-cell">Nº O.S.</th>
                      <th className="text-left p-3 font-medium text-xs">Empresa</th>
                      <th className="text-left p-3 font-medium text-xs hidden md:table-cell">Data</th>
                      <th className="text-left p-3 font-medium text-xs min-w-[140px]">Status</th>
                      <th className="text-left p-3 font-medium text-xs hidden md:table-cell">Dias</th>
                      <th className="text-right p-3 font-medium text-xs">Valor</th>
                      <th className="p-3 font-medium text-xs text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedHistory.map(p => renderPedidoRow(p))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
