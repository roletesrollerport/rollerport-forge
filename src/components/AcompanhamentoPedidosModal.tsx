import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pedido, Orcamento, OrdemServico, Cliente } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Package, Truck, CheckCircle2, MessageCircle } from 'lucide-react';
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
  showAll?: boolean; // For admin "Monitorar Geral"
}

const STATUS_LABELS: Record<string, string> = {
  PENDENTE: 'Pendente',
  CONFIRMADO: 'Confirmado',
  EM_PRODUCAO: 'Em Produção',
  CONCLUIDO: 'Enviado',
  ENTREGUE: 'Entregue',
};

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: 'bg-muted text-muted-foreground',
  CONFIRMADO: 'bg-blue-100 text-blue-700',
  EM_PRODUCAO: 'bg-amber-100 text-amber-700',
  CONCLUIDO: 'bg-violet-100 text-violet-700',
  ENTREGUE: 'bg-emerald-100 text-emerald-700',
};

// Fuzzy name match (same logic as DashboardPage)
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
}: AcompanhamentoPedidosModalProps) {
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFullHistory, setShowFullHistory] = useState(false);

  // Use props if available, fallback to store
  const ordensServico = useMemo(() => osProp && osProp.length > 0 ? osProp : store.getOrdensServico(), [osProp]);
  const clientes = useMemo(() => clientesProp && clientesProp.length > 0 ? clientesProp : store.getClientes(), [clientesProp]);

  // All pedidos for this vendedor using fuzzy matching (loaded immediately)
  const allRelevantPedidos = useMemo(() => {
    return pedidos.filter((p) => {
      const orc = orcamentos.find((o) => o.id === p.orcamentoId);
      return orc && nameMatch(orc.vendedor, vendedor);
    });
  }, [pedidos, orcamentos, vendedor]);

  // Local instant search filter
  const matchesSearch = (p: Pedido) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const orc = orcamentos.find(o => o.id === p.orcamentoId);
    const os = ordensServico.find((o: any) => o.pedidoId === p.id);
    const cliente = clientes.find((c: any) => c.nome === p.clienteNome || c.id === p.cliente_id);

    const compradorMatch = cliente?.compradores?.some((comp: any) =>
      comp.nome?.toLowerCase().includes(term) ||
      comp.telefone?.toLowerCase().includes(term) ||
      comp.email?.toLowerCase().includes(term)
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
        .update({
          data: { ...pedido, status: saveStatus, updatedAt: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        })
        .eq('id', pedido.id);

      if (pedError) throw pedError;

      // Update local data for instant visual feedback
      const idx = pedidos.findIndex(p => p.id === pedido.id);
      if (idx !== -1) {
        pedidos[idx].status = saveStatus as any;
        pedidos[idx].updatedAt = new Date().toISOString();
        store.savePedidos(pedidos);
      }

      if (isMarkingAsEntregue) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#F97316', '#FFFFFF', '#000000'],
        });

        toast({
          title: "Parabéns! 🎉",
          description: `Venda de ${formatCurrency(pedido.valorTotal)} computada na meta!`,
          className: "bg-success text-white border-success",
        });

        onMetaUpdate(pedido.valorTotal);

        try { await (supabase.from as any)('logs_entrega').insert({
          pedido_id: pedido.id, vendedor, acao: 'ENTREGUE', valor: pedido.valorTotal
        }); } catch {}

      } else if (isRevertingFromEntregue) {
        onMetaUpdate(-pedido.valorTotal);

        try { await (supabase.from as any)('logs_entrega').insert({
          pedido_id: pedido.id, vendedor, acao: 'REVERTIDO', valor: -pedido.valorTotal
        }); } catch {}

        toast({
          title: "Status Revertido",
          description: `O pedido ${pedido.numero} voltou para ${saveStatus.replace('_', ' ')}`,
        });
      } else {
        toast({
          title: "Status Atualizado",
          description: `O pedido ${pedido.numero} agora está ${saveStatus.replace('_', ' ')}`,
        });
      }

      window.dispatchEvent(new CustomEvent('rp-data-synced'));

    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do pedido.",
        variant: "destructive"
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const notifyWhatsApp = (pedido: Pedido) => {
    const text = `Olá, os roletes da Rollerport referente ao pedido ${pedido.numero} acabaram de ser entregues! Qualquer dúvida, estou à disposição.`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const steps = [
    { key: 'CONFIRMADO', label: 'Orçamento' },
    { key: 'EM_PRODUCAO', label: 'Produção' },
    { key: 'CONCLUIDO', label: 'Enviado' },
    { key: 'ENTREGUE', label: 'Entregue' }
  ];

  const getEnrichedData = (pedido: Pedido) => {
    const orc = orcamentos.find(o => o.id === pedido.orcamentoId);
    const os = ordensServico.find((o: any) => o.pedidoId === pedido.id);
    return { orc, os };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Acompanhamento de Pedidos - {vendedor}</DialogTitle>
          <DialogDescription>
            {allRelevantPedidos.length} pedido(s) vinculado(s) • {activePedidos.length} ativo(s) • {deliveredPedidos.length} entregue(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-2 pb-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por Pedido, Cliente, CNPJ, Comprador, Telefone, Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-11"
            />
          </div>

          {/* ACTIVE PEDIDOS */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
              <ListFilter className="h-4 w-4" />
              Acompanhamento Ativo
              <Badge variant="outline" className="ml-2 font-mono">{activePedidos.length}</Badge>
            </div>

            {activePedidos.length === 0 ? (
              <div className="text-center py-6 bg-muted/20 rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">
                  {allRelevantPedidos.length === 0 
                    ? 'Nenhum pedido encontrado para este vendedor.' 
                    : 'Nenhum pedido ativo encontrado.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activePedidos.map(pedido => {
                  const { orc, os } = getEnrichedData(pedido);
                  const currentStepIndex = steps.findIndex(s => s.key === pedido.status);
                  const displayStepIndex = currentStepIndex === -1 ? 0 : currentStepIndex;

                  return (
                    <div key={pedido.id} className="border rounded-lg p-4 bg-card shadow-sm space-y-3 border-l-4 border-l-primary">
                      {/* Info tabular */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground block">Orçamento</span>
                          <span className="font-semibold">{orc?.numero || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Pedido</span>
                          <span className="font-semibold">{pedido.numero}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">O.S.</span>
                          <span className="font-semibold">{(os as any)?.numero || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Status</span>
                          <Badge className={`text-[10px] h-5 ${STATUS_COLORS[pedido.status] || 'bg-muted text-muted-foreground'}`}>
                            {STATUS_LABELS[pedido.status] || pedido.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <p className="text-sm font-medium">{pedido.clienteNome}</p>
                        <div className="text-right">
                          <p className="font-mono font-semibold text-primary">{formatCurrency(pedido.valorTotal)}</p>
                          <p className="text-[10px] text-muted-foreground">Previsão: {pedido.dataEntrega}</p>
                        </div>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center justify-between relative pt-2">
                        <div className="absolute left-[10%] top-1/2 -translate-y-1/2 w-[80%] h-1 bg-muted rounded-full z-0" />
                        <div
                          className="absolute left-[10%] top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full transition-all duration-300 z-0"
                          style={{ width: `${Math.max(0, (displayStepIndex) / (steps.length - 1)) * 80}%` }}
                        />
                        {steps.map((step, idx) => {
                          const isActive = displayStepIndex >= idx;
                          const isCurrent = displayStepIndex === idx;
                          return (
                            <button
                              key={step.key}
                              disabled={updatingId === pedido.id}
                              onClick={() => handleStatusChange(pedido, step.key)}
                              className={`relative z-10 flex flex-col items-center gap-2 group outline-none ${updatingId === pedido.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 shadow-sm border-2 
                                ${isActive ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-muted-foreground/30 text-muted-foreground'}
                                ${isCurrent ? 'ring-4 ring-primary/20' : ''}
                              `}>
                                {idx === 0 && <Package className="w-4 h-4" />}
                                {idx === 1 && <Truck className="w-4 h-4" />}
                                {idx === 2 && <Truck className="w-4 h-4" />}
                                {idx === 3 && <CheckCircle2 className="w-4 h-4" />}
                              </div>
                              <span className={`text-[10px] whitespace-nowrap font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {step.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <Button
                        variant="default"
                        size="sm"
                        className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white shadow-sm h-10"
                        disabled={updatingId === pedido.id}
                        onClick={() => handleStatusChange(pedido, 'ENTREGUE')}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Confirmar Entrega ao Cliente
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="h-px bg-muted" />

          {/* HISTORY */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm font-bold text-muted-foreground uppercase tracking-wider">
              <div className="flex items-center gap-2"><History className="h-4 w-4" /> Histórico de Entregas</div>
              {deliveredPedidos.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[10px] h-6 px-2 hover:bg-primary/10 text-primary"
                  onClick={() => setShowFullHistory(!showFullHistory)}
                >
                  {showFullHistory ? 'Ver Menos' : `Ver Tudo (${deliveredPedidos.length})`}
                </Button>
              )}
            </div>

            {displayedHistory.length === 0 ? (
              <div className="text-center py-4 bg-muted/10 rounded-lg">
                <p className="text-xs text-muted-foreground italic">Nenhuma entrega registrada ainda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedHistory.map(pedido => {
                  const { orc, os } = getEnrichedData(pedido);
                  return (
                    <div key={pedido.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 group hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs">Ped. {pedido.numero}</span>
                          {orc && <span className="text-[10px] text-muted-foreground">Orc. {orc.numero}</span>}
                          {os && <span className="text-[10px] text-blue-600">O.S. {(os as any).numero}</span>}
                        </div>
                        <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{pedido.clienteNome}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-xs font-mono font-bold text-muted-foreground">{formatCurrency(pedido.valorTotal)}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-full border-green-200 text-green-600 hover:bg-green-50"
                          onClick={() => notifyWhatsApp(pedido)}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
