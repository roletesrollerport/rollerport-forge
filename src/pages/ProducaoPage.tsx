import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import type { OrdemServico, StatusOS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ProducaoPage() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [viewOS, setViewOS] = useState<OrdemServico | null>(null);

  useEffect(() => { setOrdens(store.getOrdensServico()); }, []);

  const updateStatus = (id: string, status: StatusOS) => {
    const updated = ordens.map(o => o.id === id ? { ...o, status } : o);
    store.saveOrdensServico(updated);
    setOrdens(updated);
    toast.success('Status atualizado!');
  };

  const toggleEtapa = (osId: string, itemIdx: number, etapa: string) => {
    const updated = ordens.map(o => {
      if (o.id !== osId) return o;
      const itens = [...o.itens];
      itens[itemIdx] = { ...itens[itemIdx], [etapa]: !itens[itemIdx][etapa as keyof typeof itens[0]] };
      return { ...o, itens };
    });
    store.saveOrdensServico(updated);
    setOrdens(updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Produção</h1>
        <p className="page-subtitle">Ordens de serviço e acompanhamento</p>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">O.S.</th>
              <th className="text-left p-3 font-medium">Empresa</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Pedido</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Emissão</th>
              <th className="text-left p-3 font-medium hidden lg:table-cell">Entrega</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="p-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {ordens.map(os => (
              <tr key={os.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 font-mono font-medium">{os.numero}</td>
                <td className="p-3">{os.empresa}</td>
                <td className="p-3 hidden md:table-cell font-mono">{os.pedidoNumero}</td>
                <td className="p-3 hidden md:table-cell">{os.emissao}</td>
                <td className="p-3 hidden lg:table-cell">{os.entrega}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    os.status === 'CONCLUIDA' ? 'bg-success/10 text-success' :
                    os.status === 'EM_ANDAMENTO' ? 'bg-warning/10 text-warning' :
                    'bg-muted text-muted-foreground'
                  }`}>{os.status.replace('_', ' ')}</span>
                </td>
                <td className="p-3 flex gap-1">
                  <button onClick={() => setViewOS(os)} className="text-primary hover:text-primary/80"><Eye className="h-4 w-4" /></button>
                  {os.status === 'ABERTA' && <button onClick={() => updateStatus(os.id, 'EM_ANDAMENTO')} className="text-warning hover:text-warning/80"><CheckCircle className="h-4 w-4" /></button>}
                  {os.status === 'EM_ANDAMENTO' && <button onClick={() => updateStatus(os.id, 'CONCLUIDA')} className="text-success hover:text-success/80"><CheckCircle className="h-4 w-4" /></button>}
                </td>
              </tr>
            ))}
            {ordens.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma O.S. criada.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!viewOS} onOpenChange={() => setViewOS(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>O.S. {viewOS?.numero}</DialogTitle></DialogHeader>
          {viewOS && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground">Empresa:</span> {viewOS.empresa}</div>
                <div><span className="text-muted-foreground">Pedido:</span> {viewOS.pedidoNumero}</div>
                <div><span className="text-muted-foreground">Emissão:</span> {viewOS.emissao}</div>
                <div><span className="text-muted-foreground">Entrega:</span> {viewOS.entrega}</div>
                <div><span className="text-muted-foreground">Dias:</span> {viewOS.diasPropostos}</div>
                <div><span className="text-muted-foreground">Status:</span> {viewOS.status}</div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left">Item</th>
                      <th className="p-2 text-left">Qtd</th>
                      <th className="p-2 text-left">Tipo</th>
                      <th className="p-2 text-left">ø Tubo</th>
                      <th className="p-2 text-left">Parede</th>
                      <th className="p-2 text-left">Comp. Tubo</th>
                      <th className="p-2 text-left">Comp. Eixo</th>
                      <th className="p-2 text-left">ø Eixo</th>
                      <th className="p-2 text-left">Encaixe</th>
                      <th className="p-2 text-left">Revest.</th>
                      <th className="p-2 text-center">Corte</th>
                      <th className="p-2 text-center">Torno</th>
                      <th className="p-2 text-center">Fresa</th>
                      <th className="p-2 text-center">Solda</th>
                      <th className="p-2 text-center">Pintura</th>
                      <th className="p-2 text-center">Mont.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewOS.itens.map((item, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="p-2">{item.item}</td>
                        <td className="p-2">{item.quantidade}</td>
                        <td className="p-2 font-medium">{item.tipo}</td>
                        <td className="p-2">{item.diametroTubo}</td>
                        <td className="p-2">{item.paredeTubo}</td>
                        <td className="p-2">{item.comprimentoTubo}</td>
                        <td className="p-2">{item.comprimentoEixo}</td>
                        <td className="p-2">{item.diametroEixo}</td>
                        <td className="p-2">{item.tipoEncaixe}</td>
                        <td className="p-2">{item.revestimento || '-'}</td>
                        {['corte', 'torno', 'fresa', 'solda', 'pintura', 'montagem'].map(etapa => (
                          <td key={etapa} className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={item[etapa as keyof typeof item] as boolean}
                              onChange={() => toggleEtapa(viewOS.id, idx, etapa)}
                              className="h-4 w-4 rounded border-primary text-primary accent-primary"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
