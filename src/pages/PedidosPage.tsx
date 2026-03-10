import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '@/lib/store';
import type { Pedido, StatusPedido, Orcamento, ItemOrcamento, ItemProdutoOrcamento } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Factory, Eye, Edit, Trash2, Search, ShoppingCart, XCircle, Printer, ArrowLeft, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import logo from '@/assets/logo.png';

const daysSince = (dateStr: string): number => {
  if (!dateStr) return 0;
  const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr.split('/').reverse().join('-'));
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
};

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

function PedidoEditView({ pedido, orcamentos, pedidos, setOrcamentos, setPedidos, setCurrentPedido, setView }: {
  pedido: Pedido; orcamentos: Orcamento[]; pedidos: Pedido[];
  setOrcamentos: (o: Orcamento[]) => void; setPedidos: (p: Pedido[]) => void;
  setCurrentPedido: (p: Pedido) => void; setView: (v: 'list' | 'view' | 'print') => void;
}) {
  const orc = orcamentos.find(o => o.id === pedido.orcamentoId);
  const [editOrc, setEditOrc] = useState<Orcamento | null>(orc ? { ...orc, itensRolete: [...(orc.itensRolete || [])], itensProduto: [...(orc.itensProduto || [])] } : null);

  const saveOrcChanges = () => {
    if (!editOrc) return;
    const itensR = editOrc.itensRolete.map(ir => ({ ...ir, valorTotal: ir.valorPorPeca * ir.quantidade }));
    const itensP = editOrc.itensProduto.map(ip => ({ ...ip, valorTotal: ip.valorUnitario * ip.quantidade }));
    const valorTotal = itensR.reduce((s, i) => s + i.valorTotal, 0) + itensP.reduce((s, i) => s + i.valorTotal, 0);
    const updatedOrc = { ...editOrc, itensRolete: itensR, itensProduto: itensP, valorTotal };
    const updatedOrcs = orcamentos.map(o => o.id === updatedOrc.id ? updatedOrc : o);
    store.saveOrcamentos(updatedOrcs); setOrcamentos(updatedOrcs);
    const updatedPedido = { ...pedido, valorTotal };
    const updatedPedidos = pedidos.map(p => p.id === updatedPedido.id ? updatedPedido : p);
    store.savePedidos(updatedPedidos); setPedidos(updatedPedidos); setCurrentPedido(updatedPedido);
    toast.success('Pedido atualizado!');
  };

  const updateRoleteItem = (idx: number, field: string, value: any) => {
    if (!editOrc) return;
    const items = [...editOrc.itensRolete]; items[idx] = { ...items[idx], [field]: value };
    setEditOrc({ ...editOrc, itensRolete: items });
  };
  const updateProdutoItem = (idx: number, field: string, value: any) => {
    if (!editOrc) return;
    const items = [...editOrc.itensProduto]; items[idx] = { ...items[idx], [field]: value };
    setEditOrc({ ...editOrc, itensProduto: items });
  };
  const deleteRoleteItem = (idx: number) => { if (!editOrc) return; setEditOrc({ ...editOrc, itensRolete: editOrc.itensRolete.filter((_, i) => i !== idx) }); };
  const deleteProdutoItem = (idx: number) => { if (!editOrc) return; setEditOrc({ ...editOrc, itensProduto: editOrc.itensProduto.filter((_, i) => i !== idx) }); };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setView('list')} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        <Button variant="outline" onClick={() => setView('print')} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
        <Button onClick={saveOrcChanges} className="gap-2">Salvar Alterações</Button>
      </div>
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-bold mb-4">Pedido {pedido.numero} — Edição Completa</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-6">
          <div><span className="text-muted-foreground">Empresa:</span> <strong>{pedido.clienteNome}</strong></div>
          <div><span className="text-muted-foreground">Orçamento:</span> <strong>{pedido.orcamentoNumero || '-'}</strong></div>
          <div><span className="text-muted-foreground">Data:</span> <strong>{pedido.createdAt}</strong></div>
          <div><span className="text-muted-foreground">Entrega:</span> <strong>{pedido.dataEntrega}</strong></div>
        </div>
        {editOrc && (
          <>
            {editOrc.itensRolete.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-sm mb-2">Itens Rolete</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="p-2 text-left">Item</th><th className="p-2">Tipo</th><th className="p-2">Qtd</th>
                      <th className="p-2">ø Tubo</th><th className="p-2">Parede</th><th className="p-2">Comp. Tubo</th>
                      <th className="p-2">ø Eixo</th><th className="p-2">Comp. Eixo</th><th className="p-2">Encaixe</th>
                      <th className="p-2">Fresa</th><th className="p-2">Revestimento</th>
                      <th className="p-2">Valor Un.</th><th className="p-2">Ações</th>
                    </tr></thead>
                    <tbody>
                      {editOrc.itensRolete.map((item, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-1">{i + 1}</td>
                          <td className="p-1"><select value={item.tipoRolete} onChange={e => updateRoleteItem(i, 'tipoRolete', e.target.value)}
                            className="h-7 text-xs rounded border bg-background px-1">
                            {['RC','RR','RG','RI','RRA'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select></td>
                          <td className="p-1"><Input type="number" className="h-7 w-14 text-xs" value={item.quantidade} onChange={e => updateRoleteItem(i, 'quantidade', +e.target.value)} /></td>
                          <td className="p-1"><Input type="number" className="h-7 w-16 text-xs" value={item.diametroTubo} onChange={e => updateRoleteItem(i, 'diametroTubo', +e.target.value)} /></td>
                          <td className="p-1"><Input type="number" className="h-7 w-14 text-xs" value={item.paredeTubo} onChange={e => updateRoleteItem(i, 'paredeTubo', +e.target.value)} /></td>
                          <td className="p-1"><Input type="number" className="h-7 w-16 text-xs" value={item.comprimentoTubo} onChange={e => updateRoleteItem(i, 'comprimentoTubo', +e.target.value)} /></td>
                          <td className="p-1"><Input type="number" className="h-7 w-14 text-xs" value={item.diametroEixo} onChange={e => updateRoleteItem(i, 'diametroEixo', +e.target.value)} /></td>
                          <td className="p-1"><Input type="number" className="h-7 w-16 text-xs" value={item.comprimentoEixo} onChange={e => updateRoleteItem(i, 'comprimentoEixo', +e.target.value)} /></td>
                          <td className="p-1"><Input className="h-7 w-20 text-xs" value={item.tipoEncaixe} onChange={e => updateRoleteItem(i, 'tipoEncaixe', e.target.value)} /></td>
                          <td className="p-1"><Input className="h-7 w-20 text-xs" value={item.medidaFresado} onChange={e => updateRoleteItem(i, 'medidaFresado', e.target.value)} /></td>
                          <td className="p-1"><Input className="h-7 w-24 text-xs" value={item.especificacaoRevestimento} onChange={e => updateRoleteItem(i, 'especificacaoRevestimento', e.target.value)} /></td>
                          <td className="p-1"><Input type="number" className="h-7 w-20 text-xs" value={item.valorPorPeca} onChange={e => updateRoleteItem(i, 'valorPorPeca', +e.target.value)} /></td>
                          <td className="p-1"><button onClick={() => deleteRoleteItem(i)} className="p-1 rounded hover:bg-muted text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {editOrc.itensProduto.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-sm mb-2">Itens Produto</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="p-2 text-left">Item</th><th className="p-2 text-left">Produto</th>
                      <th className="p-2">Qtd</th><th className="p-2">Valor Un.</th><th className="p-2">Ações</th>
                    </tr></thead>
                    <tbody>
                      {editOrc.itensProduto.map((item, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-1">{(editOrc.itensRolete?.length || 0) + i + 1}</td>
                          <td className="p-1 font-medium">{item.produtoNome}</td>
                          <td className="p-1"><Input type="number" className="h-7 w-14 text-xs" value={item.quantidade} onChange={e => updateProdutoItem(i, 'quantidade', +e.target.value)} /></td>
                          <td className="p-1"><Input type="number" className="h-7 w-20 text-xs" value={item.valorUnitario} onChange={e => updateProdutoItem(i, 'valorUnitario', +e.target.value)} /></td>
                          <td className="p-1"><button onClick={() => deleteProdutoItem(i)} className="p-1 rounded hover:bg-muted text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
const statusProgress: Record<string, number> = {
  'PENDENTE': 20, 'CONFIRMADO': 40, 'EM_PRODUCAO': 60, 'CONCLUIDO': 80, 'ENTREGUE': 100,
};

function StatusProgressBar({ status }: { status: string }) {
  const pct = statusProgress[status] || 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <Progress value={pct} className="h-2 flex-1" />
      <span className={`text-xs font-medium whitespace-nowrap ${status === 'ENTREGUE' || status === 'CONCLUIDO' ? 'text-success' : status === 'EM_PRODUCAO' ? 'text-secondary' : 'text-muted-foreground'}`}>{status.replace('_', ' ')}</span>
    </div>
  );
}

type View = 'list' | 'view' | 'print';

export default function PedidosPage() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('list');
  const [currentPedido, setCurrentPedido] = useState<Pedido | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Pedido | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');

  // Modals de Confirmação
  const [confirmDeleteOrc, setConfirmDeleteOrc] = useState<string | null>(null);
  const [confirmDeletePedido, setConfirmDeletePedido] = useState<string | null>(null);

  const clientes = store.getClientes();
  const produtos = store.getProdutos();

  useEffect(() => {
    const load = () => { setPedidos(store.getPedidos()); setOrcamentos(store.getOrcamentos()); };
    load();
    window.addEventListener('rp-data-synced', load);
    return () => window.removeEventListener('rp-data-synced', load);
  }, []);

  // Comprehensive search helper
  const matchesSearch = (text: string, s: string) => text?.toLowerCase().includes(s.toLowerCase());
  const clienteMatchesSearch = (clienteNome: string, s: string) => {
    const cli = clientes.find(c => c.nome === clienteNome);
    if (!cli) return matchesSearch(clienteNome, s);
    const compradorMatch = (cli.compradores || []).some(comp =>
      matchesSearch(comp.nome, s) || comp.telefone?.includes(s) || matchesSearch(comp.email, s)
    );
    return matchesSearch(cli.nome, s) || cli.cnpj?.includes(s) || matchesSearch(cli.email, s) ||
      cli.telefone?.includes(s) || matchesSearch(cli.endereco, s) || compradorMatch;
  };

  const gerarPedido = (orc: Orcamento) => {
    if (pedidos.find(p => p.orcamentoId === orc.id)) { toast.error('Este orçamento já tem um pedido!'); return; }
    const pedido: Pedido = {
      id: store.nextId('ped'), numero: store.nextNumero('ped'), orcamentoId: orc.id,
      orcamentoNumero: orc.numero, clienteNome: orc.clienteNome,
      dataEntrega: orc.previsaoEntrega || orc.dataEntrega, status: 'PENDENTE',
      valorTotal: orc.valorTotal, createdAt: new Date().toISOString().split('T')[0],
      statusHistory: [{ status: 'PENDENTE', date: new Date().toISOString() }],
    };
    const updatedPedidos = [...pedidos, pedido]; store.savePedidos(updatedPedidos); setPedidos(updatedPedidos);
    const updatedOrcs = orcamentos.map(o => o.id === orc.id ? { ...o, status: 'APROVADO' as const, dataAprovacao: new Date().toISOString() } : o);
    store.saveOrcamentos(updatedOrcs); setOrcamentos(updatedOrcs);
    const notifs = store.getNotificacoes();
    notifs.push({ id: store.nextId('notif'), tipo: 'pedido', titulo: `Novo Pedido ${pedido.numero}`, mensagem: `Pedido gerado para ${orc.clienteNome} - ${fmt(orc.valorTotal)}`, lida: false, createdAt: new Date().toISOString() });
    store.saveNotificacoes(notifs); toast.success(`Pedido ${pedido.numero} gerado!`);
  };

  const updateStatus = (id: string, status: StatusPedido) => {
    const updated = pedidos.map(p => {
      if (p.id !== id) return p;
      const history = [...(p.statusHistory || []), { status, date: new Date().toISOString() }];
      return { ...p, status, statusHistory: history };
    });
    store.savePedidos(updated); setPedidos(updated); toast.success('Status atualizado!');
  };

  const cancelarPedido = (pedido: Pedido) => {
    setCancelTarget(pedido);
    setCancelMotivo('');
    setCancelDialogOpen(true);
  };

  const confirmCancelarPedido = () => {
    if (!cancelTarget) return;
    if (!cancelMotivo.trim()) { toast.error('Informe o motivo do cancelamento!'); return; }
    const updatedPedidos = pedidos.filter(p => p.id !== cancelTarget.id); store.savePedidos(updatedPedidos); setPedidos(updatedPedidos);
    const updatedOrcs = orcamentos.map(o => o.id === cancelTarget.orcamentoId ? { ...o, status: 'RASCUNHO' as const } : o);
    store.saveOrcamentos(updatedOrcs); setOrcamentos(updatedOrcs);
    setCancelDialogOpen(false);
    toast.success('Pedido cancelado. Orçamento voltou para edição.'); navigate('/orcamentos');
  };

  const deletePedido = (id: string) => {
    const updated = pedidos.filter(p => p.id !== id); store.savePedidos(updated); setPedidos(updated); toast.success('Pedido excluído!');
    setConfirmDeletePedido(null);
  };

  const gerarOS = (pedido: Pedido) => {
    const orc = orcamentos.find(o => o.id === pedido.orcamentoId);
    if (!orc) return;
    const os = {
      id: store.nextId('os'), numero: store.nextNumero('os'), pedidoId: pedido.id,
      empresa: pedido.clienteNome, pedidoNumero: pedido.numero,
      emissao: new Date().toISOString().split('T')[0], entrega: pedido.dataEntrega,
      entradaProducao: '', diasPropostos: 12, status: 'ABERTA' as const,
      itens: (orc.itensRolete || []).map((item, i) => ({
        item: i + 1, quantidade: item.quantidade, tipo: item.tipoRolete,
        diametroTubo: item.diametroTubo, paredeTubo: item.paredeTubo,
        comprimentoTubo: item.comprimentoTubo, comprimentoEixo: item.comprimentoEixo,
        diametroEixo: item.diametroEixo, encaixeFresado: item.medidaFresado || '',
        comprimentoFresado: 0, medidaAbaFresado: '', tipoEncaixe: item.tipoEncaixe,
        roscaIE: '', furoEixo: '', revestimento: item.especificacaoRevestimento,
        corte: false, torno: false, fresa: false, solda: false, pintura: false, montagem: false,
      })),
      createdAt: new Date().toISOString().split('T')[0],
    };
    store.saveOrdensServico([...store.getOrdensServico(), os]);
    updateStatus(pedido.id, 'EM_PRODUCAO');
    const notifs = store.getNotificacoes();
    notifs.push({ id: store.nextId('notif'), tipo: 'producao', titulo: `O.S. ${os.numero} Gerada`, mensagem: `Ordem de serviço criada para ${pedido.clienteNome}`, lida: false, createdAt: new Date().toISOString() });
    store.saveNotificacoes(notifs); toast.success(`O.S. ${os.numero} gerada!`);
  };

  const orcSemPedido = orcamentos.filter(o => !pedidos.find(p => p.orcamentoId === o.id));

  const filteredOrcs = orcSemPedido.filter(o =>
    o.numero.includes(search) || clienteMatchesSearch(o.clienteNome, search)
  );
  const filteredPedidos = pedidos.filter(p =>
    p.numero.includes(search) || (p.orcamentoNumero || '').includes(search) || clienteMatchesSearch(p.clienteNome, search)
  );

  // ========== PRINT VIEW ==========
  if (view === 'print' && currentPedido) {
    const orc = orcamentos.find(o => o.id === currentPedido.orcamentoId);
    const cli = clientes.find(c => c.nome === currentPedido.clienteNome);
    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden">
          <Button variant="outline" onClick={() => setView('list')} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
        </div>
        <div className="bg-card border rounded-lg p-6 max-w-5xl mx-auto print:border-0 print:shadow-none print:max-w-none">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-start gap-4">
              <img src={logo} alt="Rollerport" className="h-20 w-20 object-contain" />
              <div>
                <h2 className="text-xl font-bold">ROLLERPORT</h2>
                <p className="text-xs text-muted-foreground">Roletes para Correia Transportadora</p>
                <p className="text-xs text-muted-foreground">Rua João Marcos Pimenta Rocha, 16 – Franco da Rocha/SP</p>
                <p className="text-xs text-muted-foreground">CEP: 07832-460 • Tel: (11) 4441-3572</p>
              </div>
            </div>
            {cli && (
              <div className="text-right text-sm">
                <p className="font-semibold">{cli.nome}</p>
                <p className="text-xs text-muted-foreground">CNPJ: {cli.cnpj}</p>
                <p className="text-xs text-muted-foreground">{cli.endereco}</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm mb-6 border rounded p-4">
            <div><span className="font-semibold">Pedido Nº:</span> {currentPedido.numero}</div>
            <div><span className="font-semibold">Orçamento Nº:</span> {currentPedido.orcamentoNumero || '-'}</div>
            <div><span className="font-semibold">Data:</span> {currentPedido.createdAt}</div>
            <div><span className="font-semibold">Entrega:</span> {currentPedido.dataEntrega}</div>
            <div><span className="font-semibold">Status:</span> {currentPedido.status.replace('_', ' ')}</div>
            <div><span className="font-semibold">Valor Total:</span> {fmt(currentPedido.valorTotal)}</div>
          </div>
          {orc && (
            <table className="w-full text-sm border-collapse mb-6">
              <thead><tr className="border-b-2">
                <th className="text-left p-2 font-semibold">Item</th>
                <th className="text-left p-2 font-semibold">Descrição</th>
                <th className="text-center p-2 font-semibold">Qtd</th>
                <th className="text-right p-2 font-semibold">Valor Unit.</th>
                <th className="text-right p-2 font-semibold">Total</th>
              </tr></thead>
              <tbody>
                {(orc.itensRolete || []).map((item, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">Rolete {item.tipoRolete} ø{item.diametroTubo}x{item.paredeTubo} Tubo:{item.comprimentoTubo}mm Eixo:{item.comprimentoEixo}mm</td>
                    <td className="p-2 text-center">{item.quantidade}</td>
                    <td className="p-2 text-right">{fmt(item.valorPorPeca)}</td>
                    <td className="p-2 text-right">{fmt(item.valorTotal)}</td>
                  </tr>
                ))}
                {(orc.itensProduto || []).map((item, i) => (
                  <tr key={`p-${i}`} className="border-b">
                    <td className="p-2">{(orc.itensRolete?.length || 0) + i + 1}</td>
                    <td className="p-2">{item.produtoNome}</td>
                    <td className="p-2 text-center">{item.quantidade}</td>
                    <td className="p-2 text-right">{fmt(item.valorUnitario)}</td>
                    <td className="p-2 text-right">{fmt(item.valorTotal)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 font-bold">
                  <td colSpan={4} className="p-2 text-right">TOTAL</td>
                  <td className="p-2 text-right">{fmt(currentPedido.valorTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
        <style>{`@media print { @page { size: landscape; margin: 1cm; } body { -webkit-print-color-adjust: exact; } .print\\:hidden { display: none !important; } }`}</style>
      </div>
    );
  }

  // ========== VIEW (editable) ==========
  if (view === 'view' && currentPedido) {
    return <PedidoEditView pedido={currentPedido} orcamentos={orcamentos} pedidos={pedidos}
      setOrcamentos={setOrcamentos} setPedidos={setPedidos} setCurrentPedido={setCurrentPedido}
      setView={setView} />;
  }

  // ========== LIST ==========
  return (
    <div className="space-y-6">
      <div><h1 className="page-header">Pedidos</h1><p className="page-subtitle">Gerencie pedidos e orçamentos pendentes</p></div>

      <div className="border rounded-lg p-4 bg-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nº pedido, nº orçamento, empresa, comprador, CNPJ, telefone, email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {filteredOrcs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Orçamentos (pendentes de pedido)</h2>
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Nº</th><th className="text-left p-3 font-medium">Cliente</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Data</th><th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Dias</th>
                <th className="text-right p-3 font-medium">Valor</th><th className="p-3 w-40">Ações</th>
              </tr></thead>
              <tbody>
                {filteredOrcs.map(o => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-mono font-medium">{o.numero}</td>
                    <td className="p-3">{o.clienteNome}</td>
                    <td className="p-3 hidden md:table-cell">{o.dataOrcamento || o.createdAt}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground uppercase">{o.status}</span></td>
                    <td className="p-3 hidden md:table-cell">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{daysSince(o.createdAt)}d</span>
                    </td>
                    <td className="p-3 text-right font-mono">{fmt(o.valorTotal)}</td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => navigate('/orcamentos')} className="p-1.5 rounded hover:bg-muted" title="Ver"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => gerarPedido(o)} className="p-1.5 rounded hover:bg-muted text-primary" title="Gerar Pedido"><ShoppingCart className="h-4 w-4" /></button>
                        <button onClick={() => setConfirmDeleteOrc(o.id)} className="p-1.5 rounded hover:bg-muted text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Pedidos</h2>
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Nº Pedido</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Nº Orçamento</th>
              <th className="text-left p-3 font-medium">Empresa</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Data</th>
              <th className="text-left p-3 font-medium min-w-[180px]">Status</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Dias</th>
              <th className="text-right p-3 font-medium">Valor</th>
              <th className="p-3 w-52">Ações</th>
            </tr></thead>
            <tbody>
              {filteredPedidos.map(p => {
                const days = daysSince(p.createdAt);
                const lastStatusChange = p.statusHistory?.length ? p.statusHistory[p.statusHistory.length - 1] : null;
                const daysInStatus = lastStatusChange ? daysSince(lastStatusChange.date) : days;
                return (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono font-medium">{p.numero}</td>
                  <td className="p-3 hidden md:table-cell font-mono text-xs text-muted-foreground">{p.orcamentoNumero || '-'}</td>
                  <td className="p-3">{p.clienteNome}</td>
                  <td className="p-3 hidden md:table-cell">{p.createdAt}</td>
                  <td className="p-3"><StatusProgressBar status={p.status} /></td>
                  <td className="p-3 hidden md:table-cell">
                    <div className="flex flex-col text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Total: {days}d</span>
                      <span className="text-[10px]">No status: {daysInStatus}d</span>
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono">{fmt(p.valorTotal)}</td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { setCurrentPedido(p); setView('view'); }} className="p-1.5 rounded hover:bg-muted" title="Ver"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => { setCurrentPedido(p); setView('view'); }} className="p-1.5 rounded hover:bg-muted" title="Editar"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => { setCurrentPedido(p); setView('print'); }} className="p-1.5 rounded hover:bg-muted" title="Imprimir"><Printer className="h-4 w-4" /></button>
                      {p.status === 'PENDENTE' && <button onClick={() => gerarOS(p)} className="p-1.5 rounded hover:bg-muted text-primary" title="Gerar O.S."><Factory className="h-4 w-4" /></button>}
                      {p.status === 'EM_PRODUCAO' && <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, 'CONCLUIDO')} className="text-xs h-7">Concluir</Button>}
                      {p.status === 'CONCLUIDO' && <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, 'ENTREGUE')} className="text-xs h-7">Entregar</Button>}
                      <button onClick={() => cancelarPedido(p)} className="p-1.5 rounded hover:bg-muted text-warning" title="Cancelar"><XCircle className="h-4 w-4" /></button>
                      <button onClick={() => setConfirmDeletePedido(p.id)} className="p-1.5 rounded hover:bg-muted text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {filteredPedidos.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum pedido.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog de cancelamento */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar Pedido {cancelTarget?.numero}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Informe o motivo do cancelamento antes de prosseguir:</p>
            <Textarea 
              value={cancelMotivo} 
              onChange={e => setCancelMotivo(e.target.value)} 
              placeholder="Motivo do cancelamento..." 
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Voltar</Button>
              <Button variant="destructive" onClick={confirmCancelarPedido}>Confirmar Cancelamento</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmações */}
      <ConfirmDialog
        open={!!confirmDeleteOrc}
        onOpenChange={(open) => !open && setConfirmDeleteOrc(null)}
        title="Excluir Orçamento"
        description="Tem certeza que deseja excluir este orçamento?"
        onConfirm={() => {
          if (!confirmDeleteOrc) return;
          const updated = orcamentos.filter(x => x.id !== confirmDeleteOrc);
          store.saveOrcamentos(updated); setOrcamentos(updated);
          toast.success('Orçamento excluído!');
          setConfirmDeleteOrc(null);
        }}
      />
      
      <ConfirmDialog
        open={!!confirmDeletePedido}
        onOpenChange={(open) => !open && setConfirmDeletePedido(null)}
        title="Excluir Pedido"
        description="Tem certeza que deseja excluir permanentemente este pedido?"
        onConfirm={() => confirmDeletePedido && deletePedido(confirmDeletePedido)}
      />
    </div>
  );
}
