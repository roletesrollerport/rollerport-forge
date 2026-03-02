import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '@/lib/store';
import type { OrdemServico, StatusOS, ItemOS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Eye, Edit, Trash2, Printer, CheckCircle, XCircle, ArrowLeft, Search } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';

type View = 'list' | 'view' | 'edit' | 'print';

const statusProgress: Record<string, number> = { 'ABERTA': 33, 'EM_ANDAMENTO': 66, 'CONCLUIDA': 100 };

export default function ProducaoPage() {
  const navigate = useNavigate();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [view, setView] = useState<View>('list');
  const [current, setCurrent] = useState<OrdemServico | null>(null);
  const [editItems, setEditItems] = useState<ItemOS[]>([]);
  const [search, setSearch] = useState('');

  const clientes = store.getClientes();
  const orcamentos = store.getOrcamentos();

  useEffect(() => { setOrdens(store.getOrdensServico()); }, []);

  const saveOrdens = (updated: OrdemServico[]) => { store.saveOrdensServico(updated); setOrdens(updated); };

  const updateStatus = (id: string, status: StatusOS) => {
    saveOrdens(ordens.map(o => o.id === id ? { ...o, status } : o)); toast.success('Status atualizado!');
  };

  const cancelarOS = (os: OrdemServico) => {
    saveOrdens(ordens.filter(o => o.id !== os.id));
    const pedidos = store.getPedidos();
    store.savePedidos(pedidos.map(p => p.id === os.pedidoId ? { ...p, status: 'PENDENTE' as const } : p));
    toast.success('O.S. cancelada. Pedido voltou para pendente.'); navigate('/pedidos');
  };

  const deleteOS = (id: string) => { saveOrdens(ordens.filter(o => o.id !== id)); toast.success('O.S. excluída!'); };

  const openView = (os: OrdemServico) => { setCurrent(os); setView('view'); };
  const openEdit = (os: OrdemServico) => { setCurrent(os); setEditItems([...os.itens]); setView('edit'); };
  const openPrint = (os: OrdemServico) => { setCurrent(os); setView('print'); };

  const saveEdit = () => {
    if (!current) return;
    saveOrdens(ordens.map(o => o.id === current.id ? { ...o, itens: editItems } : o));
    setCurrent({ ...current, itens: editItems }); setView('list'); toast.success('O.S. atualizada!');
  };

  const toggleEtapa = (idx: number, etapa: string) => {
    const items = [...editItems]; items[idx] = { ...items[idx], [etapa]: !(items[idx] as any)[etapa] }; setEditItems(items);
  };
  const updateItemField = (idx: number, field: string, value: any) => {
    const items = [...editItems]; items[idx] = { ...items[idx], [field]: value }; setEditItems(items);
  };

  // Comprehensive search
  const clienteMatchesSearch = (empresa: string, s: string) => {
    const cli = clientes.find(c => c.nome === empresa);
    if (!cli) return empresa?.toLowerCase().includes(s.toLowerCase());
    const compradorMatch = (cli.compradores || []).some(comp =>
      comp.nome?.toLowerCase().includes(s.toLowerCase()) || comp.telefone?.includes(s) || comp.email?.toLowerCase().includes(s.toLowerCase())
    );
    return cli.nome?.toLowerCase().includes(s.toLowerCase()) || cli.cnpj?.includes(s) || cli.email?.toLowerCase().includes(s.toLowerCase()) ||
      cli.telefone?.includes(s) || cli.endereco?.toLowerCase().includes(s.toLowerCase()) || compradorMatch;
  };

  const filteredOrdens = ordens.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    // Search by OS number, pedido number
    if (o.numero.includes(search) || o.pedidoNumero.includes(search)) return true;
    // Search by orcamento number
    const pedido = store.getPedidos().find(p => p.id === o.pedidoId);
    if (pedido?.orcamentoNumero?.includes(search)) return true;
    return clienteMatchesSearch(o.empresa, search);
  });

  const etapas = ['corte', 'torno', 'fresa', 'solda', 'pintura', 'montagem'];

  const OSTable = ({ items, editable }: { items: ItemOS[], editable?: boolean }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead><tr className="border-b-2 bg-muted/50">
          <th className="p-2 text-left font-semibold">ITEM</th>
          <th className="p-2 text-left font-semibold">QTD</th>
          <th className="p-2 text-left font-semibold">TIPO</th>
          <th className="p-2 text-left font-semibold">ø TUBO</th>
          <th className="p-2 text-left font-semibold">PAREDE</th>
          <th className="p-2 text-left font-semibold">COMP. TUBO</th>
          <th className="p-2 text-left font-semibold">COMP. EIXO</th>
          <th className="p-2 text-left font-semibold">ø EIXO</th>
          <th className="p-2 text-left font-semibold">ENCAIXE FRESADO</th>
          <th className="p-2 text-left font-semibold">COMP. FRESADO</th>
          <th className="p-2 text-left font-semibold">MEDIDA ABA FRESADO</th>
          <th className="p-2 text-left font-semibold">TIPO ENCAIXE</th>
          <th className="p-2 text-left font-semibold">ROSCA I/E</th>
          <th className="p-2 text-left font-semibold">FURO EIXO</th>
          <th className="p-2 text-left font-semibold">REVESTIMENTO</th>
          <th className="p-2 text-center font-semibold">CORTE</th>
          <th className="p-2 text-center font-semibold">TORNO</th>
          <th className="p-2 text-center font-semibold">FRESA</th>
          <th className="p-2 text-center font-semibold">SOLDA</th>
          <th className="p-2 text-center font-semibold">PINTURA</th>
          <th className="p-2 text-center font-semibold">MONT.</th>
        </tr></thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-b last:border-0">
              <td className="p-2">{item.item}</td>
              <td className="p-2">{editable ? <Input type="number" className="h-7 w-14 text-xs" value={item.quantidade} onChange={e => updateItemField(idx, 'quantidade', +e.target.value)} /> : item.quantidade}</td>
              <td className="p-2 font-medium">{item.tipo}</td>
              <td className="p-2">{item.diametroTubo}</td>
              <td className="p-2">{item.paredeTubo}</td>
              <td className="p-2">{item.comprimentoTubo}</td>
              <td className="p-2">{item.comprimentoEixo}</td>
              <td className="p-2">{item.diametroEixo}</td>
              <td className="p-2">{editable ? <Input className="h-7 w-16 text-xs" value={item.encaixeFresado} onChange={e => updateItemField(idx, 'encaixeFresado', e.target.value)} /> : item.encaixeFresado}</td>
              <td className="p-2">{editable ? <Input type="number" className="h-7 w-14 text-xs" value={item.comprimentoFresado} onChange={e => updateItemField(idx, 'comprimentoFresado', +e.target.value)} /> : item.comprimentoFresado}</td>
              <td className="p-2">{editable ? <Input className="h-7 w-16 text-xs" value={item.medidaAbaFresado} onChange={e => updateItemField(idx, 'medidaAbaFresado', e.target.value)} /> : item.medidaAbaFresado}</td>
              <td className="p-2">{item.tipoEncaixe}</td>
              <td className="p-2">{editable ? <Input className="h-7 w-14 text-xs" value={item.roscaIE} onChange={e => updateItemField(idx, 'roscaIE', e.target.value)} /> : item.roscaIE}</td>
              <td className="p-2">{editable ? <Input className="h-7 w-16 text-xs" value={item.furoEixo} onChange={e => updateItemField(idx, 'furoEixo', e.target.value)} /> : item.furoEixo}</td>
              <td className="p-2">{item.revestimento || '-'}</td>
              {etapas.map(etapa => (
                <td key={etapa} className="p-2 text-center">
                  <input type="checkbox" checked={(item as any)[etapa] as boolean}
                    onChange={() => editable ? toggleEtapa(idx, etapa) : null} readOnly={!editable}
                    className="h-4 w-4 rounded border-primary text-primary accent-primary" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const MateriaisSection = () => (
    <div className="mt-6 border-t-2 pt-4">
      <h3 className="font-bold text-sm mb-3">MATERIAIS UTILIZADOS</h3>
      <div className="grid grid-cols-3 gap-3 text-xs">
        {['TUBO', 'EIXO', 'CANECA', 'ROLAMENTO', 'ANÉIS DE BORRACHA', 'LABIRINTO / RETENTOR', 'ANEL ELÁSTICO', 'REVESTIMENTO - SPIRAFLEX / BORRACHA VULCANIZADA', 'BUCHA DE NYLON', 'TINTA', 'FLANGES / ENGRENAGENS', 'ENCAIXE FAÇO / PORCAS / PARAFUSOS / ARRUELAS'].map(mat => (
          <div key={mat} className="border rounded p-2 min-h-[40px]"><span className="font-semibold text-[10px]">{mat}</span></div>
        ))}
      </div>
    </div>
  );

  // ========== PRINT VIEW ==========
  if (view === 'print' && current) {
    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden">
          <Button variant="outline" onClick={() => setView('list')} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
        </div>
        <div className="bg-card border rounded-lg p-6 max-w-6xl mx-auto print:border-0 print:shadow-none print:max-w-none print:p-2">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-start gap-3">
              <img src={logo} alt="Rollerport" className="h-16 w-16 object-contain" />
              <div>
                <h2 className="text-lg font-bold">ROLLERPORT</h2>
                <p className="text-[10px] text-muted-foreground">Roletes para Correia Transportadora</p>
              </div>
            </div>
            <h2 className="text-lg font-bold">ORDEM DE PRODUÇÃO</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs mb-4 border rounded p-3">
            <div><span className="font-semibold">NÚMERO O.S.:</span> {current.numero}</div>
            <div><span className="font-semibold">EMISSÃO:</span> {current.emissao}</div>
            <div><span className="font-semibold">EMPRESA:</span> {current.empresa}</div>
            <div><span className="font-semibold">ENTREGA:</span> {current.entrega}</div>
            <div><span className="font-semibold">PEDIDO:</span> {current.pedidoNumero}</div>
            <div><span className="font-semibold">ENTRADA NA PRODUÇÃO:</span> {current.entradaProducao || '_______________'}</div>
            <div><span className="font-semibold">DIAS PROPOSTOS:</span> {current.diasPropostos}</div>
          </div>
          <OSTable items={current.itens} />
          <MateriaisSection />
        </div>
        <style>{`@media print { @page { size: landscape; margin: 0.3cm; } body { -webkit-print-color-adjust: exact; font-size: 9px; } .print\\:hidden { display: none !important; } }`}</style>
      </div>
    );
  }

  // ========== VIEW ==========
  if (view === 'view' && current) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView('list')} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          <Button variant="outline" onClick={() => openPrint(current)} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
        </div>
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-bold mb-4">O.S. {current.numero}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-6">
            <div><span className="text-muted-foreground">Empresa:</span> <strong>{current.empresa}</strong></div>
            <div><span className="text-muted-foreground">Pedido:</span> <strong>{current.pedidoNumero}</strong></div>
            <div><span className="text-muted-foreground">Emissão:</span> <strong>{current.emissao}</strong></div>
            <div><span className="text-muted-foreground">Entrega:</span> <strong>{current.entrega}</strong></div>
            <div><span className="text-muted-foreground">Dias Propostos:</span> <strong>{current.diasPropostos}</strong></div>
            <div><span className="text-muted-foreground">Status:</span> <strong>{current.status}</strong></div>
          </div>
          <OSTable items={current.itens} />
          <MateriaisSection />
        </div>
      </div>
    );
  }

  // ========== EDIT ==========
  if (view === 'edit' && current) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Editar O.S. {current.numero}</h2>
          <Button variant="outline" onClick={() => setView('list')}>Cancelar</Button>
        </div>
        <div className="bg-card border rounded-lg p-6">
          <OSTable items={editItems} editable />
          <div className="flex gap-2 mt-4">
            <Button onClick={saveEdit}>Salvar Alterações</Button>
            <Button variant="outline" onClick={() => setView('list')}>Cancelar</Button>
          </div>
        </div>
      </div>
    );
  }

  // ========== LIST ==========
  return (
    <div className="space-y-6">
      <div><h1 className="page-header">Produção</h1><p className="page-subtitle">Ordens de serviço e acompanhamento</p></div>

      <div className="border rounded-lg p-4 bg-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nº O.S., nº pedido, nº orçamento, empresa, comprador, CNPJ, telefone, email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th className="text-left p-3 font-medium">O.S.</th>
            <th className="text-left p-3 font-medium">Empresa</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Pedido</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Emissão</th>
            <th className="text-left p-3 font-medium hidden lg:table-cell">Entrega</th>
            <th className="text-left p-3 font-medium min-w-[150px]">Status</th>
            <th className="p-3 w-56"></th>
          </tr></thead>
          <tbody>
            {filteredOrdens.map(os => {
              const pct = statusProgress[os.status] || 0;
              return (
                <tr key={os.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono font-medium">{os.numero}</td>
                  <td className="p-3">{os.empresa}</td>
                  <td className="p-3 hidden md:table-cell font-mono">{os.pedidoNumero}</td>
                  <td className="p-3 hidden md:table-cell">{os.emissao}</td>
                  <td className="p-3 hidden lg:table-cell">{os.entrega}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-2 flex-1" />
                      <span className={`text-xs font-medium whitespace-nowrap ${os.status === 'CONCLUIDA' ? 'text-success' : os.status === 'EM_ANDAMENTO' ? 'text-secondary' : 'text-muted-foreground'}`}>{os.status.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openView(os)} className="p-1.5 rounded hover:bg-muted" title="Ver"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => openEdit(os)} className="p-1.5 rounded hover:bg-muted" title="Editar"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => openPrint(os)} className="p-1.5 rounded hover:bg-muted" title="Imprimir"><Printer className="h-4 w-4" /></button>
                      {os.status === 'ABERTA' && <button onClick={() => updateStatus(os.id, 'EM_ANDAMENTO')} className="p-1.5 rounded hover:bg-muted text-primary" title="Aprovar"><CheckCircle className="h-4 w-4" /></button>}
                      {os.status === 'EM_ANDAMENTO' && <button onClick={() => updateStatus(os.id, 'CONCLUIDA')} className="p-1.5 rounded hover:bg-muted text-success" title="Concluir"><CheckCircle className="h-4 w-4" /></button>}
                      <button onClick={() => cancelarOS(os)} className="p-1.5 rounded hover:bg-muted text-warning" title="Cancelar"><XCircle className="h-4 w-4" /></button>
                      <button onClick={() => deleteOS(os.id)} className="p-1.5 rounded hover:bg-muted text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredOrdens.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma O.S. criada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
