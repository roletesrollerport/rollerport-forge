import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pedido, Orcamento, OrdemServico, Cliente } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Package, Truck, CheckCircle2, MessageCircle, Search, History, ListFilter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';
import { Input } from '@/components/ui/input';
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

function nameMatch(vendedorField: string, userName: string): boolean {
  const a = (vendedorField || '').trim().toLowerCase();
  const b = (userName || '').trim().toLowerCase();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a) || a.split(' ')[0] === b.split(' ')[0];
}

const STEPS = [
  { key: 'CONFIRMADO', label: 'Orçamento', icon: Package },
  { key: 'EM_PRODUCAO', label: 'Produção', icon: Truck },
  { key: 'CONCLUIDO', label: 'Enviado', icon: Truck },
  { key: 'ENTREGUE', label: 'Entregue', icon: CheckCircle2 },
];

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
  const [selectedPedidoId, setSelectedPedidoId] = useState<string | null>(null);

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

  // Auto-select first active pedido when modal opens or when list changes
  useEffect(() => {
    if (isOpen) {
      if (activePedidos.length > 0) {
        setSelectedPedidoId(prev => {
          // Keep selection if still valid
          if (prev && [...activePedidos, ...deliveredPedidos].find(p => p.id === prev)) return prev;
          return activePedidos[0].id;
        });
      } else if (deliveredPedidos.length > 0) {
        setSelectedPedidoId(prev => {
          if (prev && deliveredPedidos.find(p => p.id === prev)) return prev;
          return deliveredPedidos[0].id;
        });
      } else {
        setSelectedPedidoId(null);
      }
    } else {
      setSelectedPedidoId(null);
      setSearchTerm('');
      setShowFullHistory(false);
    }
  }, [isOpen, activePedidos, deliveredPedidos]);

  const selectedPedido = useMemo(() =>
    allRelevantPedidos.find(p => p.id === selectedPedidoId) || null,
    [allRelevantPedidos, selectedPedidoId]
  );

  const getEnrichedData = (pedido: Pedido) => {
    const orc = orcamentos.find(o => o.id === pedido.orcamentoId);
    const os = ordensServico.find((o: any) => o.pedidoId === pedido.id);
    return { orc, os };
  };

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

  const selectedEnriched = selectedPedido ? getEnrichedData(selectedPedido) : null;
  const currentStepIndex = selectedPedido ? STEPS.findIndex(s => s.key === selectedPedido.status) : -1;
  const displayStepIndex = currentStepIndex === -1 ? 0 : currentStepIndex;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base">Acompanhamento de Pedidos — {vendedor}</DialogTitle>
          <DialogDescription className="text-xs">
            {allRelevantPedidos.length} pedido(s) • {activePedidos.length} ativo(s) • {deliveredPedidos.length} entregue(s)
          </DialogDescription>
        </DialogHeader>

        {/* ===== FIXED TIMELINE SECTION ===== */}
        <div className="shrink-0 border rounded-lg bg-card p-4 space-y-3 shadow-sm">
          {selectedPedido && selectedEnriched ? (
            <>
              {/* Info row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block">Orçamento</span>
                  <span className="font-bold">{selectedEnriched.orc?.numero || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Pedido</span>
                  <span className="font-bold">{selectedPedido.numero}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">O.S.</span>
                  <span className="font-bold">{(selectedEnriched.os as any)?.numero || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Cliente</span>
                  <span className="font-bold truncate block max-w-[140px]">{selectedPedido.clienteNome}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Valor</span>
                  <span className="font-mono font-bold text-primary">{formatCurrency(selectedPedido.valorTotal)}</span>
                </div>
              </div>

              {/* Status badge + previsão */}
              <div className="flex items-center justify-between">
                <Badge className={`text-[10px] h-5 ${STATUS_COLORS[selectedPedido.status] || 'bg-muted text-muted-foreground'}`}>
                  {STATUS_LABELS[selectedPedido.status] || selectedPedido.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground">Previsão: {selectedPedido.dataEntrega}</span>
              </div>

              {/* Timeline stepper */}
              <div className="flex items-center justify-between relative pt-2 pb-1">
                <div className="absolute left-[10%] top-1/2 -translate-y-1/2 w-[80%] h-1 bg-muted rounded-full z-0" />
                <div
                  className="absolute left-[10%] top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full transition-all duration-500 z-0"
                  style={{ width: `${Math.max(0, displayStepIndex / (STEPS.length - 1)) * 80}%` }}
                />
                {STEPS.map((step, idx) => {
                  const isActive = displayStepIndex >= idx;
                  const isCurrent = displayStepIndex === idx;
                  const Icon = step.icon;
                  return (
                    <button
                      key={step.key}
                      disabled={updatingId === selectedPedido.id}
                      onClick={() => handleStatusChange(selectedPedido, step.key)}
                      className={`relative z-10 flex flex-col items-center gap-2 group outline-none ${updatingId === selectedPedido.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm border-2
                        ${isActive ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-muted-foreground/30 text-muted-foreground'}
                        ${isCurrent ? 'ring-4 ring-primary/20 scale-110' : ''}
                      `}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`text-[10px] whitespace-nowrap font-semibold ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Confirm delivery button */}
              {selectedPedido.status !== 'ENTREGUE' && (
                <Button
                  variant="default"
                  size="sm"
                  className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white shadow-sm h-10"
                  disabled={updatingId === selectedPedido.id}
                  onClick={() => handleStatusChange(selectedPedido, 'ENTREGUE')}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar Entrega ao Cliente — Ped. {selectedPedido.numero}
                </Button>
              )}
              {selectedPedido.status === 'ENTREGUE' && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 border-green-200 text-green-700 hover:bg-green-50 h-10"
                    onClick={() => notifyWhatsApp(selectedPedido)}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Notificar via WhatsApp
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Nenhum pedido selecionado. Selecione um pedido abaixo.
            </div>
          )}
        </div>

        {/* ===== SCROLLABLE LIST ===== */}
        <div className="flex-1 overflow-y-auto space-y-4 mt-2 pb-2">
          {/* Search */}
          <div className="relative sticky top-0 z-10 bg-background pb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por Pedido, Cliente, CNPJ, Telefone, Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          {/* ACTIVE */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <ListFilter className="h-3.5 w-3.5" />
              Pedidos Ativos
              <Badge variant="outline" className="ml-1 font-mono text-[10px]">{activePedidos.length}</Badge>
            </div>
            {activePedidos.length === 0 ? (
              <div className="text-center py-4 bg-muted/20 rounded-lg border border-dashed">
                <p className="text-xs text-muted-foreground">Nenhum pedido ativo encontrado.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {activePedidos.map(pedido => {
                  const { orc, os } = getEnrichedData(pedido);
                  const isSelected = selectedPedidoId === pedido.id;
                  return (
                    <button
                      key={pedido.id}
                      onClick={() => setSelectedPedidoId(pedido.id)}
                      className={`w-full text-left flex items-center justify-between p-3 rounded-lg border transition-all
                        ${isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                          : 'border-border bg-card hover:bg-muted/40 hover:border-muted-foreground/30'}
                      `}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs">Ped. {pedido.numero}</span>
                          {orc && <span className="text-[10px] text-muted-foreground">Orc. {orc.numero}</span>}
                          {os && <span className="text-[10px] text-blue-600">O.S. {(os as any).numero}</span>}
                          <Badge className={`text-[9px] h-4 px-1.5 ${STATUS_COLORS[pedido.status] || 'bg-muted text-muted-foreground'}`}>
                            {STATUS_LABELS[pedido.status] || pedido.status}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground truncate max-w-[250px]">{pedido.clienteNome}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-xs font-mono font-bold text-primary">{formatCurrency(pedido.valorTotal)}</p>
                        <p className="text-[9px] text-muted-foreground">{pedido.dataEntrega}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="h-px bg-muted" />

          {/* HISTORY */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <div className="flex items-center gap-2"><History className="h-3.5 w-3.5" /> Histórico de Entregas</div>
              {deliveredPedidos.length > 3 && (
                <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 hover:bg-primary/10 text-primary"
                  onClick={() => setShowFullHistory(!showFullHistory)}>
                  {showFullHistory ? 'Ver Menos' : `Ver Tudo (${deliveredPedidos.length})`}
                </Button>
              )}
            </div>
            {displayedHistory.length === 0 ? (
              <div className="text-center py-3 bg-muted/10 rounded-lg">
                <p className="text-[11px] text-muted-foreground italic">Nenhuma entrega registrada ainda.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {displayedHistory.map(pedido => {
                  const { orc, os } = getEnrichedData(pedido);
                  const isSelected = selectedPedidoId === pedido.id;
                  return (
                    <button
                      key={pedido.id}
                      onClick={() => setSelectedPedidoId(pedido.id)}
                      className={`w-full text-left flex items-center justify-between p-3 rounded-lg border transition-all
                        ${isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-200 shadow-sm'
                          : 'border-border bg-muted/30 hover:bg-muted/50'}
                      `}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs">Ped. {pedido.numero}</span>
                          {orc && <span className="text-[10px] text-muted-foreground">Orc. {orc.numero}</span>}
                          {os && <span className="text-[10px] text-blue-600">O.S. {(os as any).numero}</span>}
                          <Badge className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700">Entregue</Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{pedido.clienteNome}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <p className="text-xs font-mono font-bold text-muted-foreground">{formatCurrency(pedido.valorTotal)}</p>
                        <span
                          onClick={(e) => { e.stopPropagation(); notifyWhatsApp(pedido); }}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-green-200 text-green-600 hover:bg-green-50 cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </button>
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
