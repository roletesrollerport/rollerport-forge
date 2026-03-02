import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '@/lib/store';
import type { Pedido, StatusPedido, Orcamento } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Factory, Eye, Edit, Trash2, Search, ShoppingCart, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

const statusProgress: Record<string, number> = {
  'PENDENTE': 20,
  'CONFIRMADO': 40,
  'EM_PRODUCAO': 60,
  'CONCLUIDO': 80,
  'ENTREGUE': 100,
};

function StatusProgressBar({ status }: { status: string }) {
  const pct = statusProgress[status] || 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <Progress value={pct} className="h-2 flex-1" />
      <span className={`text-xs font-medium whitespace-nowrap ${
        status === 'ENTREGUE' || status === 'CONCLUIDO' ? 'text-success' :
        status === 'EM_PRODUCAO' ? 'text-secondary' :
        'text-muted-foreground'
      }`}>{status.replace('_', ' ')}</span>
    </div>
  );
}

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
    if (pedidos.find(p => p.orcamentoId === orc.id)) {
      toast.error('Este orçamento já tem um pedido gerado!');
      return;
    }
    const pedido: Pedido = {
      id: store.nextId('ped'),
      numero: store.nextNumero('ped'),
      orcamentoId: orc.id,
      orcamentoNumero: orc.numero,
      clienteNome: orc.clienteNome,
      dataEntrega: orc.previsaoEntrega || orc.dataEntrega,
      status: 'PENDENTE',
      valorTotal: orc.valorTotal,
      createdAt: new Date().toISOString().split('T')[0],
    };
    const updatedPedidos = [...pedidos, pedido];
    store.savePedidos(updatedPedidos);
    setPedidos(updatedPedidos);
    const updatedOrcs = orcamentos.map(o => o.id === orc.id ? { ...o, status: 'APROVADO' as const } : o);
    store.saveOrcamentos(updatedOrcs);
    setOrcamentos(updatedOrcs);
    // Notification
    const notifs = store.getNotificacoes();
    notifs.push({ id: store.nextId('notif'), tipo: 'pedido', titulo: `Novo Pedido ${pedido.numero}`, mensagem: `Pedido gerado para ${orc.clienteNome} - ${fmt(orc.valorTotal)}`, lida: false, createdAt: new Date().toISOString() });
    store.saveNotificacoes(notifs);
    toast.success(`Pedido ${pedido.numero} gerado!`);
  };

  const updateStatus = (id: string, status: StatusPedido) => {
    const updated = pedidos.map(p => p.id === id ? { ...p, status } : p);
    store.savePedidos(updated);
    setPedidos(updated);
    toast.success('Status atualizado!');
  };

  const cancelarPedido = (pedido: Pedido) => {
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
    // Notification
    const notifs = store.getNotificacoes();
    notifs.push({ id: store.nextId('notif'), tipo: 'producao', titulo: `O.S. ${os.numero} Gerada`, mensagem: `Ordem de serviço criada para ${pedido.clienteNome}`, lida: false, createdAt: new Date().toISOString() });
    store.saveNotificacoes(notifs);
    toast.success(`O.S. ${os.numero} gerada!`);
  };

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

      {/* Orçamentos pendentes */}
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
                  <th className="p-3 w-40">Ações</th>
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
                <th className="text-left p-3 font-medium">Nº Pedido</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Nº Orçamento</th>
                <th className="text-left p-3 font-medium">Empresa</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Data</th>
                <th className="text-left p-3 font-medium min-w-[180px]">Status</th>
                <th className="text-right p-3 font-medium">Valor</th>
                <th className="p-3 w-48">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredPedidos.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono font-medium">{p.numero}</td>
                  <td className="p-3 hidden md:table-cell font-mono text-xs text-muted-foreground">{p.orcamentoNumero || '-'}</td>
                  <td className="p-3">{p.clienteNome}</td>
                  <td className="p-3 hidden md:table-cell">{p.createdAt}</td>
                  <td className="p-3">
                    <StatusProgressBar status={p.status} />
                  </td>
                  <td className="p-3 text-right font-mono">{fmt(p.valorTotal)}</td>
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
                      <button onClick={() => cancelarPedido(p)} className="p-1.5 rounded hover:bg-muted text-warning" title="Cancelar"><XCircle className="h-4 w-4" /></button>
                      <button onClick={() => deletePedido(p.id)} className="p-1.5 rounded hover:bg-muted text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPedidos.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum pedido.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
