import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pedido, Orcamento } from '@/lib/types';
import { store } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { Package, Truck, CheckCircle2, ChevronRight, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';
import { Input } from '@/components/ui/input';
import { Search, History, ListFilter } from 'lucide-react';

interface AcompanhamentoPedidosModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  vendedor: string;
  pedidos: Pedido[];
  orcamentos: Orcamento[];
  onMetaUpdate: (valorSoma: number) => void;
}

export function AcompanhamentoPedidosModal({
  isOpen,
  onOpenChange,
  vendedor,
  pedidos,
  orcamentos,
  onMetaUpdate,
}: AcompanhamentoPedidosModalProps) {
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFullHistory, setShowFullHistory] = useState(false);

  // Helper to check if a pedido matches the search term (numero, cliente, CNPJ, comprador, telefone, email)
  const matchesSearch = (p: Pedido) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const orc = orcamentos.find(o => o.id === p.orcamentoId);
    const os = store.getOrdensServico().find(o => o.pedidoId === p.id);
    
    // Find client data for CNPJ, buyer, phone, email
    const clientes = store.getClientes();
    const cliente = clientes.find(c => c.nome === p.clienteNome || c.id === p.cliente_id);
    
    const compradorMatch = cliente?.compradores?.some(comp => 
      comp.nome?.toLowerCase().includes(term) || 
      comp.telefone?.toLowerCase().includes(term) || 
      comp.email?.toLowerCase().includes(term)
    ) || false;
    
    return p.numero.toLowerCase().includes(term) || 
           p.clienteNome.toLowerCase().includes(term) ||
           (orc?.numero || '').toLowerCase().includes(term) ||
           (os?.numero || '').toLowerCase().includes(term) ||
           (cliente?.cnpj || '').toLowerCase().includes(term) ||
           (cliente?.telefone || '').toLowerCase().includes(term) ||
           (cliente?.email || '').toLowerCase().includes(term) ||
           compradorMatch;
  };

  const allRelevantPedidos = pedidos.filter((p) => {
    const orc = orcamentos.find((o) => o.id === p.orcamentoId);
    return orc && orc.vendedor === vendedor;
  });

  const activePedidos = allRelevantPedidos
    .filter(p => p.status !== 'ENTREGUE' && matchesSearch(p))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const deliveredPedidos = allRelevantPedidos
    .filter(p => p.status === 'ENTREGUE' && matchesSearch(p))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

  const displayedHistory = showFullHistory ? deliveredPedidos : deliveredPedidos.slice(0, 3);

  const handleStatusChange = async (pedido: Pedido, newStatus: string) => {
    if (updatingId) return;
    setUpdatingId(pedido.id);

    try {
      const isRevertingFromEntregue = pedido.status === 'ENTREGUE' && newStatus !== 'ENTREGUE';
      const isMarkingAsEntregue = pedido.status !== 'ENTREGUE' && newStatus === 'ENTREGUE';
      
      // Ajuste pedido para retornar para 'Confirmado' se estiver voltando de Entregue para um passo anterior e não estiver explicitamente selecionando algo.
      // O Stepper atual só tem 4 posições.
      let saveStatus = newStatus;
      if (isRevertingFromEntregue && newStatus !== 'EM_PRODUCAO' && newStatus !== 'CONCLUIDO') {
        saveStatus = 'CONFIRMADO';
      }

      // Update Order Status on DB
      const { error: pedError } = await supabase
        .from('pedidos')
        .update({
          data: { ...pedido, status: saveStatus },
          updated_at: new Date().toISOString(),
        })
        .eq('id', pedido.id);

      if (pedError) throw pedError;

      // Update Local Pedidos array temporarily to give instant visual feedback
      const idx = pedidos.findIndex(p => p.id === pedido.id);
      if(idx !== -1) {
         pedidos[idx].status = saveStatus as any;
         // Persist to local store so DashboardPage (which listens to 'rp-data-synced') picks it up
         store.savePedidos(pedidos);
      }

      // Handle Meta Logic & Logging
      if (isMarkingAsEntregue) {
        // Confetti & Toast
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

        // Add to Meta
        onMetaUpdate(pedido.valorTotal);

        // Log
        await supabase.from('logs_entrega').insert({
          pedido_id: pedido.id,
          vendedor: vendedor,
          acao: 'ENTREGUE',
          valor: pedido.valorTotal
        });

      } else if (isRevertingFromEntregue) {
        // Subtract from Meta
        onMetaUpdate(-pedido.valorTotal);

        // Log
        await supabase.from('logs_entrega').insert({
          pedido_id: pedido.id,
          vendedor: vendedor,
          acao: 'REVERTIDO',
          valor: -pedido.valorTotal
        });
        
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

      // Dispatch event to force Dashboard to reload visually
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
    { key: 'CONCLUIDO', label: 'Enviado' }, // Assuming CONCLUIDO acts as ENVIADO before ENTREGUE
    { key: 'ENTREGUE', label: 'Entregue' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Acompanhamento de Pedidos - {vendedor}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4 pb-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por Pedido, Orçamento ou O.S..." 
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
                 <p className="text-sm text-muted-foreground">Nenhum pedido ativo encontrado.</p>
               </div>
            ) : (
              activePedidos.map(pedido => {
                const currentStepIndex = steps.findIndex(s => s.key === pedido.status);
                const displayStepIndex = currentStepIndex === -1 ? 0 : currentStepIndex;
                const orc = orcamentos.find(o => o.id === pedido.orcamentoId);
                const os = store.getOrdensServico().find(o => o.pedidoId === pedido.id);

                return (
                  <div key={pedido.id} className="border rounded-lg p-4 bg-card shadow-sm space-y-4 border-l-4 border-l-primary">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-lg">Pedido {pedido.numero}</h4>
                          {orc && <Badge variant="outline" className="text-[10px] h-5">Orc. {orc.numero}</Badge>}
                          {os && <Badge variant="secondary" className="text-[10px] h-5 bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">O.S. {os.numero}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{pedido.clienteNome}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-medium text-lg text-primary">{formatCurrency(pedido.valorTotal)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Previsão: {pedido.dataEntrega}</p>
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

                    <div className="pt-2">
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
                  </div>
                );
              })
            )}
          </div>

          <div className="h-px bg-muted" />

          {/* HISTORY SECTION */}
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
                   {showFullHistory ? 'Ver Menos' : 'Ver Tudo'}
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
                  const orc = orcamentos.find(o => o.id === pedido.orcamentoId);
                  return (
                    <div key={pedido.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 group hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs">Pedido {pedido.numero}</span>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[150px]">{pedido.clienteNome}</span>
                        </div>
                        <div className="flex gap-2 mt-0.5">
                           {orc && <span className="text-[10px] text-muted-foreground">Orc: {orc.numero}</span>}
                           <span className="text-[10px] text-success font-medium">Entregue via WhatsApp</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-mono font-bold text-muted-foreground">{formatCurrency(pedido.valorTotal)}</p>
                        </div>
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
