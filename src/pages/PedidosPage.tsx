import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '@/lib/store';
import type { Pedido, StatusPedido, Orcamento } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Factory, Eye, Edit, Trash2, Search, ArrowLeft, ShoppingCart, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

export default function PedidosPage() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setPedidos(store.getPedidos());
    setOrcamentos(store.getOrcamentos());
  }, []);

  const gerarPedido = (orc: Orcamento) => {
    // Check if already has a pedido
    if (pedidos.find(p => p.orcamentoId === orc.id)) {
      toast.error('Este orçamento já tem um pedido gerado!');
      return;
    }
    const pedido: Pedido = {
      id: store.nextId('ped'),
      numero: store.nextNumero('ped'),
      orcamentoId: orc.id,
      clienteNome: orc.clienteNome,
      dataEntrega: orc.previsaoEntrega || orc.dataEntrega,
      status: 'PENDENTE',
      valorTotal: orc.valorTotal,
      createdAt: new Date().toISOString().split('T')[0],
    };
    const updatedPedidos = [...pedidos, pedido];
    store.savePedidos(updatedPedidos);
    setPedidos(updatedPedidos);
    // Mark orc as APROVADO
    const updatedOrcs = orcamentos.map(o => o.id === orc.id ? { ...o, status: 'APROVADO' as const } : o);
    store.saveOrcamentos(updatedOrcs);
    setOrcamentos(updatedOrcs);
    toast.success(`Pedido ${pedido.numero} gerado!`);
  };

  const updateStatus = (id: string, status: StatusPedido) => {
    const updated = pedidos.map(p => p.id === id ? { ...p, status } : p);
    store.savePedidos(updated);
    setPedidos(updated);
    toast.success('Status atualizado!');
  };

  const cancelarPedido = (pedido: Pedido) => {
    // Remove pedido and set orc back to RASCUNHO
    const updatedPedidos = pedidos.filter(p => p.id !== pedido.id);
    store.savePedidos(updatedPedidos);
    setPedidos(updatedPedidos);
    const updatedOrcs = orcamentos.map(o => o.id === pedido.orcamentoId ? { ...o, status: 'RASCUNHO' as const } : o);
    store.saveOrcamentos(updatedOrcs);
    setOrcamentos(updatedOrcs);
    toast.success('Pedido cancelado. Orçamento voltou para edição.');
    navigate('/orcamentos');
  };

  const deletePedido = (id: string) => {
    const updated = pedidos.filter(p => p.id !== id);
    store.savePedidos(updated);
    setPedidos(updated);
    toast.success('Pedido excluído!');
  };

  const gerarOS = (pedido: Pedido) => {
    const orc = orcamentos.find(o => o.id === pedido.orcamentoId);
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

  // All orçamentos that don't have pedidos yet
  const orcSemPedido = orcamentos.filter(o => !pedidos.find(p => p.orcamentoId === o.id));

  const filteredOrcs = orcSemPedido.filter(o =>
    o.clienteNome.toLowerCase().includes(search.toLowerCase()) ||
    o.numero.includes(search)
  );

  const filteredPedidos = pedidos.filter(p =>
    p.clienteNome.toLowerCase().includes(search.toLowerCase()) ||
    p.numero.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-header">Pedidos</h1>
          <p className="page-subtitle">Gerencie pedidos e orçamentos pendentes</p>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente ou número..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* Orçamentos pendentes (sem pedido) */}
      {filteredOrcs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Orçamentos (pendentes de pedido)</h2>
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Nº</th>
                  <th className="text-left p-3 font-medium">Cliente</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Data</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Valor</th>
                  <th className="p-3 w-40"></th>
                </tr>
              </thead>
              <tbody>
                {filteredOrcs.map(o => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-mono font-medium">{o.numero}</td>
                    <td className="p-3">{o.clienteNome}</td>
                    <td className="p-3 hidden md:table-cell">{o.dataOrcamento || o.createdAt}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground uppercase">{o.status}</span>
                    </td>
                    <td className="p-3 text-right font-mono">{fmt(o.valorTotal)}</td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => navigate('/orcamentos')} className="p-1.5 rounded hover:bg-muted" title="Ver"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => navigate('/orcamentos')} className="p-1.5 rounded hover:bg-muted" title="Editar"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => gerarPedido(o)} className="p-1.5 rounded hover:bg-muted text-primary" title="Gerar Pedido"><ShoppingCart className="h-4 w-4" /></button>
                        <button onClick={() => {
                          const updated = orcamentos.filter(x => x.id !== o.id);
                          store.saveOrcamentos(updated);
                          setOrcamentos(updated);
                          toast.success('Orçamento excluído!');
                        }} className="p-1.5 rounded hover:bg-muted text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pedidos */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Pedidos</h2>
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Nº</th>
                <th className="text-left p-3 font-medium">Cliente</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Entrega</th>
                <th className="text-right p-3 font-medium">Valor</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="p-3 w-48"></th>
              </tr>
            </thead>
            <tbody>
              {filteredPedidos.map(p => (
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
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => navigate('/orcamentos')} className="p-1.5 rounded hover:bg-muted" title="Ver"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => navigate('/orcamentos')} className="p-1.5 rounded hover:bg-muted" title="Editar"><Edit className="h-4 w-4" /></button>
                      {p.status === 'PENDENTE' && (
                        <button onClick={() => gerarOS(p)} className="p-1.5 rounded hover:bg-muted text-primary" title="Gerar O.S."><Factory className="h-4 w-4" /></button>
                      )}
                      {p.status === 'EM_PRODUCAO' && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, 'CONCLUIDO')} className="text-xs h-7">Concluir</Button>
                      )}
                      {p.status === 'CONCLUIDO' && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, 'ENTREGUE')} className="text-xs h-7">Entregar</Button>
                      )}
                      <button onClick={() => cancelarPedido(p)} className="p-1.5 rounded hover:bg-muted text-warning" title="Cancelar Pedido"><XCircle className="h-4 w-4" /></button>
                      <button onClick={() => deletePedido(p.id)} className="p-1.5 rounded hover:bg-muted text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPedidos.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum pedido.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
