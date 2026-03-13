import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Pedido, Orcamento } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Package, Truck, CheckCircle2, ChevronRight, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';

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

  // Filter only active orders for the vendor
  const pedidosAtivos = pedidos.filter((p) => {
    // Check if the related budget belongs to the vendor
    const orc = orcamentos.find((o) => o.id === p.orcamentoId);
    if (!orc || orc.vendedor !== vendedor) return false;
    
    // Filter out delivered or cancelled
    // return p.status !== 'ENTREGUE'; // We want to see them to mark as delivered or revert
    return true; 
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

        <div className="space-y-4 mt-4">
          {pedidosAtivos.length === 0 ? (
             <p className="text-center text-muted-foreground py-8">Nenhum pedido ativo no momento.</p>
          ) : (
            pedidosAtivos.map(pedido => {
              const currentStepIndex = steps.findIndex(s => s.key === pedido.status);
              // Fallback for PENDENTE ou CONFIRMADO
              const displayStepIndex = currentStepIndex === -1 && pedido.status !== 'ENTREGUE' ? 0 : currentStepIndex;

              return (
                <div key={pedido.id} className="border rounded-lg p-4 bg-card shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-lg">Pedido {pedido.numero}</h4>
                      <p className="text-sm text-muted-foreground">{pedido.clienteNome}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-medium text-lg">{formatCurrency(pedido.valorTotal)}</p>
                      <p className="text-xs text-muted-foreground">Previsão: {pedido.dataEntrega}</p>
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
                            group-hover:ring-2 group-hover:ring-primary/50
                          `}>
                            {idx === 0 && <Package className="w-4 h-4" />}
                            {idx === 1 && <Truck className="w-4 h-4" />}
                            {idx === 2 && <Truck className="w-4 h-4" />}
                            {idx === 3 && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                          <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {step.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* WhatsApp Action */}
                  {pedido.status === 'ENTREGUE' && (
                    <div className="pt-2 flex justify-end animate-in fade-in slide-in-from-top-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 focus:ring-green-500"
                        onClick={() => notifyWhatsApp(pedido)}
                      >
                        <MessageCircle className="w-4 h-4" />
                        Avisar Cliente via WhatsApp
                      </Button>
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
