import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import type { Orcamento, ItemOrcamento, ItemProdutoOrcamento, StatusOrcamento, TipoFrete } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Eye, Send, Check, X as XIcon, Edit, Search, Settings2, Package } from 'lucide-react';
import { toast } from 'sonner';

const emptyItem = (): ItemOrcamento => ({
  id: '', tipoRolete: 'RC', quantidade: 1, diametroTubo: 102, paredeTubo: 3, comprimentoTubo: 0,
  comprimentoEixo: 0, diametroEixo: 20, tipoEncaixe: 'LPW', medidaFresado: '', conjunto: '',
  tipoRevestimento: '', especificacaoRevestimento: '', quantidadeAneis: 0, custo: 0,
  multiplicador: 1.8, desconto: 0, valorPorPeca: 0, valorTotal: 0,
});

const emptyProdutoItem = (): ItemProdutoOrcamento => ({
  id: '', produtoId: '', produtoNome: '', quantidade: 1, valorUnitario: 0, valorTotal: 0,
});

function calcItem(item: ItemOrcamento): ItemOrcamento {
  const tubos = store.getTubos();
  const eixos = store.getEixos();
  const conjuntos = store.getConjuntos();
  const revestimentos = store.getRevestimentos();
  const encaixes = store.getEncaixes();

  const tubo = tubos.find(t => t.diametro === item.diametroTubo && t.parede === item.paredeTubo);
  const eixo = eixos.find(e => e.diametro === String(item.diametroEixo));
  const conj = conjuntos.find(c => c.codigo === item.conjunto);
  const rev = revestimentos.find(r => r.tipo === item.especificacaoRevestimento);
  const enc = encaixes.find(e => e.tipo === item.tipoEncaixe);

  const custoTubo = tubo ? (item.comprimentoTubo / 1000) * tubo.valorMetro : 0;
  const custoEixo = eixo ? (item.comprimentoEixo / 1000) * eixo.valorMetro : 0;
  const custoConj = conj ? conj.valor * 2 : 0;
  const custoRev = rev ? (item.comprimentoTubo / 1000) * rev.valorMetroOuPeca * (item.quantidadeAneis || 1) : 0;
  const custoEnc = enc ? enc.preco * 2 : 0;

  const custo = custoTubo + custoEixo + custoConj + custoRev + custoEnc;
  const valorPorPeca = custo * item.multiplicador * (1 - item.desconto / 100);
  const valorTotal = valorPorPeca * item.quantidade;

  return { ...item, custo: +custo.toFixed(2), valorPorPeca: +valorPorPeca.toFixed(2), valorTotal: +valorTotal.toFixed(2) };
}

export default function OrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [open, setOpen] = useState(false);
  const [viewOrc, setViewOrc] = useState<Orcamento | null>(null);
  const [editingOrc, setEditingOrc] = useState<Orcamento | null>(null);

  // Form state
  const [clienteId, setClienteId] = useState('');
  const [clienteSearch, setClienteSearch] = useState('');
  const [tipoFrete, setTipoFrete] = useState<TipoFrete>('CIF');
  const [condicaoPagamento, setCondicaoPagamento] = useState('');
  const [vendedor, setVendedor] = useState('');
  const [dataOrcamento, setDataOrcamento] = useState(new Date().toLocaleDateString('pt-BR'));
  const [previsaoEntrega, setPrevisaoEntrega] = useState('');
  const [observacao, setObservacao] = useState('');
  const [itensRolete, setItensRolete] = useState<ItemOrcamento[]>([]);
  const [itensProduto, setItensProduto] = useState<ItemProdutoOrcamento[]>([]);

  const clientes = store.getClientes();
  const produtos = store.getProdutos();
  const encaixes = store.getEncaixes();
  const conjuntos = store.getConjuntos();
  const revestimentos = store.getRevestimentos();

  const filteredClientes = clientes.filter(c =>
    c.nome.toLowerCase().includes(clienteSearch.toLowerCase()) ||
    c.cnpj.includes(clienteSearch) ||
    c.telefone.includes(clienteSearch) ||
    c.email.toLowerCase().includes(clienteSearch.toLowerCase())
  );

  useEffect(() => { setOrcamentos(store.getOrcamentos()); }, []);

  const resetForm = () => {
    setClienteId('');
    setClienteSearch('');
    setTipoFrete('CIF');
    setCondicaoPagamento('');
    setVendedor('');
    setDataOrcamento(new Date().toLocaleDateString('pt-BR'));
    setPrevisaoEntrega('');
    setObservacao('');
    setItensRolete([]);
    setItensProduto([]);
    setEditingOrc(null);
  };

  const openNew = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (orc: Orcamento) => {
    setEditingOrc(orc);
    setClienteId(orc.clienteId);
    setClienteSearch(orc.clienteNome);
    setTipoFrete(orc.tipoFrete || 'CIF');
    setCondicaoPagamento(orc.condicaoPagamento || '');
    setVendedor(orc.vendedor || '');
    setDataOrcamento(orc.dataOrcamento || orc.createdAt);
    setPrevisaoEntrega(orc.previsaoEntrega || orc.dataEntrega);
    setObservacao(orc.observacao || '');
    setItensRolete(orc.itensRolete || []);
    setItensProduto(orc.itensProduto || []);
    setOpen(true);
  };

  const updateItem = (idx: number, partial: Partial<ItemOrcamento>) => {
    const n = [...itensRolete];
    n[idx] = calcItem({ ...n[idx], ...partial });
    setItensRolete(n);
  };

  const updateProdutoItem = (idx: number, partial: Partial<ItemProdutoOrcamento>) => {
    const n = [...itensProduto];
    n[idx] = { ...n[idx], ...partial };
    if (partial.produtoId) {
      const prod = produtos.find(p => p.id === partial.produtoId);
      if (prod) {
        n[idx].produtoNome = prod.nome;
        n[idx].valorUnitario = prod.valor;
      }
    }
    n[idx].valorTotal = n[idx].valorUnitario * n[idx].quantidade;
    setItensProduto(n);
  };

  const totalRoletes = itensRolete.reduce((s, i) => s + i.valorTotal, 0);
  const totalProdutos = itensProduto.reduce((s, i) => s + i.valorTotal, 0);
  const totalGeral = totalRoletes + totalProdutos;

  const handleSave = (status: StatusOrcamento = 'RASCUNHO') => {
    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente) { toast.error('Selecione um cliente'); return; }

    const orc: Orcamento = {
      id: editingOrc?.id || store.nextId('orc'),
      numero: editingOrc?.numero || store.nextNumero('orc'),
      clienteId,
      clienteNome: cliente.nome,
      tipoFrete,
      condicaoPagamento,
      vendedor,
      dataOrcamento,
      previsaoEntrega,
      observacao,
      dataEntrega: previsaoEntrega,
      itensRolete,
      itensProduto,
      status,
      valorTotal: +totalGeral.toFixed(2),
      createdAt: editingOrc?.createdAt || new Date().toISOString().split('T')[0],
    };

    let updated: Orcamento[];
    if (editingOrc) {
      updated = orcamentos.map(o => o.id === editingOrc.id ? orc : o);
    } else {
      updated = [...orcamentos, orc];
    }
    store.saveOrcamentos(updated);
    setOrcamentos(updated);
    setOpen(false);
    resetForm();
    toast.success(`Orçamento ${orc.numero} ${status === 'ENVIADO' ? 'enviado' : 'salvo'}!`);
  };

  const updateStatus = (id: string, status: StatusOrcamento) => {
    const updated = orcamentos.map(o => o.id === id ? { ...o, status } : o);
    store.saveOrcamentos(updated);
    setOrcamentos(updated);
    toast.success('Status atualizado!');
  };

  const deleteOrcamento = (id: string) => {
    const updated = orcamentos.filter(o => o.id !== id);
    store.saveOrcamentos(updated);
    setOrcamentos(updated);
    toast.success('Orçamento removido!');
  };

  const fmt = (v: number) => `R$ ${v.toFixed(2)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-header">Orçamentos</h1>
          <p className="page-subtitle">Acompanhamento de orçamentos</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Orçamento</Button>
      </div>

      {/* List */}
      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Nº</th>
              <th className="text-left p-3 font-medium">Cliente</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Entrega</th>
              <th className="text-right p-3 font-medium">Valor Total</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="p-3 w-36"></th>
            </tr>
          </thead>
          <tbody>
            {orcamentos.slice().reverse().map(o => (
              <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 font-mono font-medium">{o.numero}</td>
                <td className="p-3">{o.clienteNome}</td>
                <td className="p-3 hidden md:table-cell">{o.previsaoEntrega || o.dataEntrega}</td>
                <td className="p-3 text-right font-mono">{fmt(o.valorTotal)}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    o.status === 'APROVADO' ? 'bg-success/10 text-success' :
                    o.status === 'ENVIADO' ? 'bg-info/10 text-info' :
                    o.status === 'REPROVADO' ? 'bg-destructive/10 text-destructive' :
                    'bg-muted text-muted-foreground'
                  }`}>{o.status}</span>
                </td>
                <td className="p-3 flex gap-1">
                  <button onClick={() => setViewOrc(o)} className="text-primary hover:text-primary/80"><Eye className="h-4 w-4" /></button>
                  <button onClick={() => openEdit(o)} className="text-info hover:text-info/80"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => deleteOrcamento(o.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button>
                  {o.status === 'RASCUNHO' && <button onClick={() => updateStatus(o.id, 'ENVIADO')} className="text-info hover:text-info/80"><Send className="h-4 w-4" /></button>}
                  {o.status === 'ENVIADO' && <>
                    <button onClick={() => updateStatus(o.id, 'APROVADO')} className="text-success hover:text-success/80"><Check className="h-4 w-4" /></button>
                    <button onClick={() => updateStatus(o.id, 'REPROVADO')} className="text-destructive hover:text-destructive/80"><XIcon className="h-4 w-4" /></button>
                  </>}
                </td>
              </tr>
            ))}
            {orcamentos.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum orçamento criado.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* New/Edit Orcamento Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingOrc ? 'Editar' : 'Novo'} Orçamento</DialogTitle></DialogHeader>

          <div className="space-y-4">
            {/* Cliente search */}
            <div className="border rounded-lg p-4 bg-muted/10">
              <label className="text-xs text-muted-foreground font-medium">Cliente</label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, CNPJ, telefone, e-mail..."
                    value={clienteSearch}
                    onChange={e => { setClienteSearch(e.target.value); setClienteId(''); }}
                    className="pl-10"
                  />
                </div>
              </div>
              {clienteSearch && !clienteId && (
                <div className="border rounded mt-1 max-h-32 overflow-y-auto bg-card">
                  {filteredClientes.map(c => (
                    <button key={c.id} onClick={() => { setClienteId(c.id); setClienteSearch(c.nome); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex justify-between">
                      <span className="font-medium">{c.nome}</span>
                      <span className="text-muted-foreground text-xs">{c.cnpj}</span>
                    </button>
                  ))}
                  {filteredClientes.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado</p>}
                </div>
              )}
            </div>

            {/* Frete, Pagamento, Vendedor */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Tipo de Frete</label>
                <select value={tipoFrete} onChange={e => setTipoFrete(e.target.value as TipoFrete)}
                  className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm">
                  <option value="CIF">CIF (frete por conta do vendedor)</option>
                  <option value="FOB">FOB (frete por conta do comprador)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Condição de Pagamento</label>
                <Input placeholder="Ex: 30/60/90" value={condicaoPagamento} onChange={e => setCondicaoPagamento(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Vendedor</label>
                <Input placeholder="Nome do vendedor" value={vendedor} onChange={e => setVendedor(e.target.value)} />
              </div>
            </div>

            {/* Data, Previsão */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Data</label>
                <Input value={dataOrcamento} readOnly className="bg-muted/30" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Previsão de Entrega</label>
                <Input placeholder="Ex: 15 dias úteis" value={previsaoEntrega} onChange={e => setPrevisaoEntrega(e.target.value)} />
              </div>
            </div>

            {/* Observação */}
            <div>
              <label className="text-xs text-muted-foreground">Observação</label>
              <Textarea placeholder="Observações gerais do orçamento..." value={observacao} onChange={e => setObservacao(e.target.value)} />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setItensProduto([...itensProduto, { ...emptyProdutoItem(), id: store.nextId('item') }])} className="gap-2">
                <Package className="h-4 w-4" /> Inserir Produto
              </Button>
              <Button variant="outline" onClick={() => setItensRolete([...itensRolete, { ...emptyItem(), id: store.nextId('item') }])} className="gap-2">
                <Settings2 className="h-4 w-4" /> Inserir Rolete
              </Button>
            </div>

            {/* Produto items */}
            {itensProduto.map((item, idx) => (
              <div key={item.id} className="border rounded-lg p-3 bg-muted/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Produto {idx + 1}</span>
                  <button onClick={() => setItensProduto(itensProduto.filter((_, i) => i !== idx))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="col-span-2">
                    <label className="text-muted-foreground">Produto</label>
                    <select value={item.produtoId} onChange={e => updateProdutoItem(idx, { produtoId: e.target.value })}
                      className="flex h-8 w-full rounded border bg-transparent px-2 text-sm">
                      <option value="">Selecione...</option>
                      {produtos.map(p => <option key={p.id} value={p.id}>{p.codigo} - {p.nome}</option>)}
                    </select>
                  </div>
                  <div><label className="text-muted-foreground">Qtd</label><Input type="number" className="h-8" value={item.quantidade} onChange={e => updateProdutoItem(idx, { quantidade: +e.target.value })} /></div>
                  <div><label className="text-muted-foreground">Valor Unit.</label><Input type="number" step="0.01" className="h-8" value={item.valorUnitario} onChange={e => updateProdutoItem(idx, { valorUnitario: +e.target.value })} /></div>
                </div>
                <div className="mt-2 text-xs font-mono">
                  <span>Total: <strong className="text-primary">{fmt(item.valorTotal)}</strong></span>
                </div>
              </div>
            ))}

            {/* Rolete items */}
            {itensRolete.map((item, idx) => (
              <div key={item.id} className="border rounded-lg p-3 bg-muted/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Settings2 className="h-3 w-3" /> Rolete {idx + 1}</span>
                  <button onClick={() => setItensRolete(itensRolete.filter((_, i) => i !== idx))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-muted-foreground">Tipo</label>
                    <select value={item.tipoRolete} onChange={e => updateItem(idx, { tipoRolete: e.target.value as any })} className="flex h-8 w-full rounded border bg-transparent px-2 text-sm">
                      {['RC', 'RR', 'RG', 'RI', 'RRA'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label className="text-muted-foreground">Qtd</label><Input type="number" className="h-8" value={item.quantidade} onChange={e => updateItem(idx, { quantidade: +e.target.value })} /></div>
                  <div><label className="text-muted-foreground">ø Tubo</label><Input type="number" className="h-8" value={item.diametroTubo} onChange={e => updateItem(idx, { diametroTubo: +e.target.value })} /></div>
                  <div><label className="text-muted-foreground">Parede</label><Input type="number" className="h-8" value={item.paredeTubo} onChange={e => updateItem(idx, { paredeTubo: +e.target.value })} /></div>
                  <div><label className="text-muted-foreground">Comp. Tubo (mm)</label><Input type="number" className="h-8" value={item.comprimentoTubo} onChange={e => updateItem(idx, { comprimentoTubo: +e.target.value })} /></div>
                  <div><label className="text-muted-foreground">Comp. Eixo (mm)</label><Input type="number" className="h-8" value={item.comprimentoEixo} onChange={e => updateItem(idx, { comprimentoEixo: +e.target.value })} /></div>
                  <div><label className="text-muted-foreground">ø Eixo</label><Input type="number" className="h-8" value={item.diametroEixo} onChange={e => updateItem(idx, { diametroEixo: +e.target.value })} /></div>
                  <div>
                    <label className="text-muted-foreground">Encaixe</label>
                    <select value={item.tipoEncaixe} onChange={e => updateItem(idx, { tipoEncaixe: e.target.value })} className="flex h-8 w-full rounded border bg-transparent px-2 text-sm">
                      {encaixes.map(e => <option key={e.id} value={e.tipo}>{e.tipo}</option>)}
                    </select>
                  </div>
                  <div><label className="text-muted-foreground">Fresado</label><Input className="h-8" value={item.medidaFresado} onChange={e => updateItem(idx, { medidaFresado: e.target.value })} /></div>
                  <div>
                    <label className="text-muted-foreground">Conjunto</label>
                    <select value={item.conjunto} onChange={e => updateItem(idx, { conjunto: e.target.value })} className="flex h-8 w-full rounded border bg-transparent px-2 text-sm">
                      <option value="">-</option>
                      {conjuntos.map(c => <option key={c.id} value={c.codigo}>{c.codigo}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-muted-foreground">Revestimento</label>
                    <select value={item.especificacaoRevestimento} onChange={e => updateItem(idx, { especificacaoRevestimento: e.target.value })} className="flex h-8 w-full rounded border bg-transparent px-2 text-sm">
                      <option value="">-</option>
                      {revestimentos.map(r => <option key={r.id} value={r.tipo}>{r.tipo}</option>)}
                    </select>
                  </div>
                  <div><label className="text-muted-foreground">Anéis</label><Input type="number" className="h-8" value={item.quantidadeAneis} onChange={e => updateItem(idx, { quantidadeAneis: +e.target.value })} /></div>
                  <div><label className="text-muted-foreground">Multiplicador</label><Input type="number" step="0.1" className="h-8" value={item.multiplicador} onChange={e => updateItem(idx, { multiplicador: +e.target.value })} /></div>
                  <div><label className="text-muted-foreground">Desconto %</label><Input type="number" className="h-8" value={item.desconto} onChange={e => updateItem(idx, { desconto: +e.target.value })} /></div>
                </div>
                <div className="flex gap-4 mt-2 text-xs font-mono">
                  <span>Custo: <strong className="text-foreground">{fmt(item.custo)}</strong></span>
                  <span>Valor/pç: <strong className="text-foreground">{fmt(item.valorPorPeca)}</strong></span>
                  <span>Total: <strong className="text-primary">{fmt(item.valorTotal)}</strong></span>
                </div>
              </div>
            ))}

            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t">
              <span className="font-semibold">Total: {fmt(totalGeral)}</span>
              <Button onClick={() => handleSave('RASCUNHO')} className="gap-2">
                Salvar Orçamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewOrc} onOpenChange={() => setViewOrc(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Orçamento {viewOrc?.numero}</DialogTitle></DialogHeader>
          {viewOrc && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Cliente:</span> {viewOrc.clienteNome}</div>
                <div><span className="text-muted-foreground">Frete:</span> {viewOrc.tipoFrete || '-'}</div>
                <div><span className="text-muted-foreground">Pagamento:</span> {viewOrc.condicaoPagamento || '-'}</div>
                <div><span className="text-muted-foreground">Vendedor:</span> {viewOrc.vendedor || '-'}</div>
                <div><span className="text-muted-foreground">Entrega:</span> {viewOrc.previsaoEntrega || viewOrc.dataEntrega}</div>
                <div><span className="text-muted-foreground">Status:</span> {viewOrc.status}</div>
                <div><span className="text-muted-foreground">Total:</span> <strong>{fmt(viewOrc.valorTotal)}</strong></div>
              </div>
              {viewOrc.observacao && <div><span className="text-muted-foreground">Obs:</span> {viewOrc.observacao}</div>}

              {(viewOrc.itensProduto || []).length > 0 && <>
                <h4 className="font-semibold mt-3">Produtos ({viewOrc.itensProduto.length})</h4>
                {viewOrc.itensProduto.map((item, i) => (
                  <div key={i} className="bg-muted/30 rounded p-2 text-xs font-mono">
                    {item.produtoNome} | Qtd:{item.quantidade} | {fmt(item.valorTotal)}
                  </div>
                ))}
              </>}

              {(viewOrc.itensRolete || []).length > 0 && <>
                <h4 className="font-semibold mt-3">Roletes ({viewOrc.itensRolete.length})</h4>
                {viewOrc.itensRolete.map((item, i) => (
                  <div key={i} className="bg-muted/30 rounded p-2 text-xs font-mono">
                    {item.tipoRolete} | ø{item.diametroTubo}x{item.paredeTubo} | Tubo:{item.comprimentoTubo}mm | Eixo:{item.comprimentoEixo}mm ø{item.diametroEixo} | {item.tipoEncaixe} | Qtd:{item.quantidade} | {fmt(item.valorTotal)}
                  </div>
                ))}
              </>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
