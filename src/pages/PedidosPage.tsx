import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import type { Pedido, StatusPedido } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus, Factory } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);

  const orcamentosAprovados = store.getOrcamentos().filter(o => o.status === 'APROVADO');
  const pedidoOrcIds = new Set(pedidos.map(p => p.orcamentoId));
  const disponveis = orcamentosAprovados.filter(o => !pedidoOrcIds.has(o.id));

  useEffect(() => { setPedidos(store.getPedidos()); }, []);

  const gerarPedido = (orcId: string) => {
    const orc = orcamentosAprovados.find(o => o.id === orcId);
    if (!orc) return;
    const pedido: Pedido = {
      id: store.nextId('ped'),
      numero: store.nextNumero('ped'),
      orcamentoId: orc.id,
      clienteNome: orc.clienteNome,
      dataEntrega: orc.dataEntrega,
      status: 'PENDENTE',
      valorTotal: orc.valorTotal,
      createdAt: new Date().toISOString().split('T')[0],
    };
    const updated = [...pedidos, pedido];
    store.savePedidos(updated);
    setPedidos(updated);
    setShowGenerate(false);
    toast.success(`Pedido ${pedido.numero} gerado!`);
  };

  const updateStatus = (id: string, status: StatusPedido) => {
    const updated = pedidos.map(p => p.id === id ? { ...p, status } : p);
    store.savePedidos(updated);
    setPedidos(updated);
    toast.success('Status atualizado!');
  };

  const gerarOS = (pedido: Pedido) => {
    const orc = store.getOrcamentos().find(o => o.id === pedido.orcamentoId);
    if (!orc) return;
    const os = {
      id: store.nextId('os'),
      numero: store.nextNumero('os'),
      pedidoId: pedido.id,
      empresa: pedido.clienteNome,
      pedidoNumero: pedido.numero,
      emissao: new Date().toISOString().split('T')[0],
      entrega: pedido.dataEntrega,
      entradaProducao: '',
      diasPropostos: 12,
      status: 'ABERTA' as const,
      itens: (orc.itensRolete || []).map((item, i) => ({
        item: i + 1, quantidade: item.quantidade, tipo: item.tipoRolete,
        diametroTubo: item.diametroTubo, paredeTubo: item.paredeTubo,
        comprimentoTubo: item.comprimentoTubo, comprimentoEixo: item.comprimentoEixo,
        diametroEixo: item.diametroEixo, encaixeFresado: item.tipoEncaixe,
        comprimentoFresado: 0, medidaAbaFresado: '', tipoEncaixe: item.tipoEncaixe,
        roscaIE: '', furoEixo: '', revestimento: item.especificacaoRevestimento,
        corte: false, torno: false, fresa: false, solda: false, pintura: false, montagem: false,
      })),
      createdAt: new Date().toISOString().split('T')[0],
    };
    const oss = [...store.getOrdensServico(), os];
    store.saveOrdensServico(oss);
    updateStatus(pedido.id, 'EM_PRODUCAO');
    toast.success(`O.S. ${os.numero} gerada!`);
  };

  const fmt = (v: number) => `R$ ${v.toFixed(2)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-header">Pedidos</h1>
          <p className="page-subtitle">Pedidos gerados a partir de orçamentos aprovados</p>
        </div>
        <Button onClick={() => setShowGenerate(true)} className="gap-2" disabled={disponveis.length === 0}>
          <Plus className="h-4 w-4" /> Gerar Pedido
        </Button>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Nº</th>
              <th className="text-left p-3 font-medium">Cliente</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Entrega</th>
              <th className="text-right p-3 font-medium">Valor</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="p-3 w-28"></th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map(p => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 font-mono font-medium">{p.numero}</td>
                <td className="p-3">{p.clienteNome}</td>
                <td className="p-3 hidden md:table-cell">{p.dataEntrega}</td>
                <td className="p-3 text-right font-mono">{fmt(p.valorTotal)}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    p.status === 'CONCLUIDO' || p.status === 'ENTREGUE' ? 'bg-success/10 text-success' :
                    p.status === 'EM_PRODUCAO' ? 'bg-warning/10 text-warning' :
                    'bg-muted text-muted-foreground'
                  }`}>{p.status.replace('_', ' ')}</span>
                </td>
                <td className="p-3 flex gap-1">
                  {p.status === 'PENDENTE' && <Button size="sm" variant="outline" onClick={() => gerarOS(p)} className="gap-1 text-xs"><Factory className="h-3.5 w-3.5" /> Gerar O.S.</Button>}
                  {p.status === 'EM_PRODUCAO' && <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, 'CONCLUIDO')} className="text-xs">Concluir</Button>}
                  {p.status === 'CONCLUIDO' && <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, 'ENTREGUE')} className="text-xs">Entregar</Button>}
                </td>
              </tr>
            ))}
            {pedidos.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum pedido.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar Pedido</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">Selecione um orçamento aprovado:</p>
          <div className="space-y-2">
            {disponveis.map(o => (
              <button key={o.id} onClick={() => gerarPedido(o.id)} className="w-full flex justify-between items-center p-3 rounded-lg border hover:bg-muted/50 transition-colors text-sm">
                <span className="font-mono font-medium">{o.numero}</span>
                <span>{o.clienteNome}</span>
                <span className="font-mono">{fmt(o.valorTotal)}</span>
              </button>
            ))}
            {disponveis.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum orçamento aprovado disponível.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
