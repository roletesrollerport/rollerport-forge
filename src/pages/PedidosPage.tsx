import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { store } from '@/lib/store';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useCustos } from '@/hooks/useCustos';
import type { Pedido, StatusPedido, Orcamento, ItemOrcamento, ItemProdutoOrcamento, Tubo, Eixo, Conjunto, Revestimento, Encaixe } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Factory, Eye, Trash2, Search, ShoppingCart, XCircle, Printer, ArrowLeft, Clock, Calendar, History, Truck, FileText, Mail, Settings2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { AcompanhamentoPedidosModal } from '@/components/AcompanhamentoPedidosModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import logo from '@/assets/logo.png';

const emptyItem = (): ItemOrcamento => ({
  id: '', tipoRolete: '' as any, quantidade: '' as any, diametroTubo: '' as any, paredeTubo: '' as any, comprimentoTubo: '' as any,
  comprimentoEixo: '' as any, diametroEixo: '' as any, tipoEncaixe: '', medidaFresado: '', conjunto: '',
  tipoRevestimento: '', especificacaoRevestimento: '', quantidadeAneis: '' as any, custo: 0,
  multiplicador: 1.8, desconto: '' as any, valorPorPeca: 0, valorTotal: 0, ncm: '8431.39.00',
  aliqPIS: 0, aliqCOFINS: 0, aliqICMS: 0, aliqIPI: 0, valorPIS: 0, valorCOFINS: 0, valorICMS: 0, valorIPI: 0
});

function calcItem(item: ItemOrcamento, tubos: Tubo[], eixos: Eixo[], conjuntos: Conjunto[], revestimentos: Revestimento[], encaixes: Encaixe[]): ItemOrcamento {
  const tubo = tubos.find(t => t.diametro === item.diametroTubo && t.parede === item.paredeTubo);
  const eixo = eixos.find(e => e.diametro === String(item.diametroEixo));
  const conj = conjuntos.find(c => c.codigo === item.conjunto);
  const rev = revestimentos.find(r => r.tipo === item.especificacaoRevestimento);
  const enc = encaixes.find(e => e.tipo === item.tipoEncaixe);
  let custoTubo = 0;
  if (tubo && item.comprimentoTubo > 0 && item.comprimentoTubo < 6000) {
    const QT = Math.max(1, Math.floor(6000 / item.comprimentoTubo));
    custoTubo = tubo.precoBarra6000mm / QT;
  }
  let custoEixo = 0;
  if (eixo && item.comprimentoEixo > 0 && item.comprimentoEixo < 6000) {
    const QE = Math.max(1, Math.floor(6000 / item.comprimentoEixo));
    custoEixo = eixo.precoBarra6000mm / QE;
  }
  const custoConj = conj ? conj.valor : 0;
  const custoEnc = enc ? enc.preco : 0;
  let custoRev = 0;
  if (rev) {
    const isSpiraflex = rev.tipo.toUpperCase().includes('SPIRAFLEX');
    if (isSpiraflex) { custoRev = rev.valorMetroOuPeca * (item.comprimentoEixo / 1000); }
    else { custoRev = rev.valorMetroOuPeca * (item.quantidadeAneis || 1); }
  }
  const custo = custoTubo + custoEixo + custoConj + custoEnc + custoRev;
  const multiplicador = item.multiplicador || 1.8;
  const desconto = item.desconto || 0;
  const valorPorPeca = custo * multiplicador * (1 - desconto / 100);
  const valorTotal = valorPorPeca * item.quantidade;
  const aliqPIS = item.aliqPIS || 0; const aliqCOFINS = item.aliqCOFINS || 0;
  const aliqICMS = item.aliqICMS || 0; const aliqIPI = item.aliqIPI || 0;
  return { ...item, custo: +custo.toFixed(2), valorPorPeca: +valorPorPeca.toFixed(2), valorTotal: +valorTotal.toFixed(2),
    aliqPIS, aliqCOFINS, aliqICMS, aliqIPI,
    valorPIS: +(valorTotal * aliqPIS / 100).toFixed(2), valorCOFINS: +(valorTotal * aliqCOFINS / 100).toFixed(2),
    valorICMS: +(valorTotal * aliqICMS / 100).toFixed(2), valorIPI: +(valorTotal * aliqIPI / 100).toFixed(2),
  };
}

const daysSince = (dateStr: string): number => {
  if (!dateStr) return 0;
  const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr.split('/').reverse().join('-'));
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
};

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

const fmtDateShort = (iso: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

function PedidoEditView({ pedido, orcamentos, pedidos, setOrcamentos, setPedidos, setCurrentPedido, setView }: {
  pedido: Pedido; orcamentos: Orcamento[]; pedidos: Pedido[];
  setOrcamentos: (o: Orcamento[]) => void; setPedidos: (p: Pedido[]) => void;
  setCurrentPedido: (p: Pedido) => void; setView: (v: 'list' | 'view' | 'print') => void;
}) {
  const orc = orcamentos.find(o => o.id === pedido.orcamentoId);
  const [editOrc, setEditOrc] = useState<Orcamento | null>(orc ? { ...orc, itensRolete: [...(orc.itensRolete || [])], itensProduto: [...(orc.itensProduto || [])] } : null);

  const costData = useCustos();
  const { tubos, eixos, conjuntos, revestimentos, encaixes } = costData;

  // Rolete editor state
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [editingItemKind, setEditingItemKind] = useState<'rolete' | 'produto' | null>(null);
  const [roleteItem, setRoleteItem] = useState<ItemOrcamento>(emptyItem());
  const [codigoRolete, setCodigoRolete] = useState('');
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);

  type DeleteItemTarget = { kind: 'rolete'; idx: number } | { kind: 'produto'; idx: number };
  const [deleteItemOpen, setDeleteItemOpen] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState<DeleteItemTarget | null>(null);

  const diametrosTubo = [...new Set(tubos.map(t => t.diametro))].sort((a, b) => a - b);
  const paredesTubo = (diam: number) => [...new Set(tubos.filter(t => t.diametro === diam).map(t => t.parede))].sort((a, b) => a - b);
  const diametrosEixo = eixos.map(e => e.diametro);

  const updateRoleteField = (partial: Partial<ItemOrcamento>) => {
    setRoleteItem(prev => calcItem({ ...prev, ...partial }, tubos, eixos, conjuntos, revestimentos, encaixes));
  };

  const openRoleteEditor = (idx: number) => {
    if (!editOrc) return;
    const item = editOrc.itensRolete[idx];
    if (!item) return;
    setRoleteItem(calcItem({ ...item }, tubos, eixos, conjuntos, revestimentos, encaixes));
    setCodigoRolete((item as any).codigoProduto || '');
    setEditingItemIdx(idx);
    setEditingItemKind('rolete');
  };

  const saveRoleteEdit = () => {
    if (editingItemIdx === null || !editOrc) return;
    const calculated = calcItem({ ...roleteItem, codigoProduto: codigoRolete } as any, tubos, eixos, conjuntos, revestimentos, encaixes);
    const updatedItens = [...editOrc.itensRolete];
    updatedItens[editingItemIdx] = { ...calculated, id: editOrc.itensRolete[editingItemIdx].id };
    
    const itensR = updatedItens.map(ir => ({ ...ir, valorTotal: ir.valorPorPeca * ir.quantidade }));
    const itensP = (editOrc.itensProduto || []).map(ip => ({ ...ip, valorTotal: ip.valorUnitario * ip.quantidade }));
    const valorTotal = itensR.reduce((s, i) => s + i.valorTotal, 0) + itensP.reduce((s, i) => s + i.valorTotal, 0);
    
    const updatedOrc = { ...editOrc, itensRolete: itensR, itensProduto: itensP, valorTotal };
    setEditOrc(updatedOrc);
    
    // Save to store
    const updatedOrcs = orcamentos.map(o => o.id === updatedOrc.id ? updatedOrc : o);
    store.saveOrcamentos(updatedOrcs); setOrcamentos(updatedOrcs);
    const updatedPedido = { ...pedido, valorTotal };
    const updatedPedidos = pedidos.map(p => p.id === updatedPedido.id ? updatedPedido : p);
    store.savePedidos(updatedPedidos); setPedidos(updatedPedidos); setCurrentPedido(updatedPedido);
    
    setEditingItemIdx(null);
    setEditingItemKind(null);
    setRoleteItem(emptyItem());
    setCodigoRolete('');
    toast.success('Item atualizado e salvo no pedido!');
  };

  const cancelEdit = () => {
    setEditingItemIdx(null);
    setEditingItemKind(null);
    setRoleteItem(emptyItem());
    setCodigoRolete('');
  };

  const requestDeleteItem = (target: DeleteItemTarget) => { setDeleteItemTarget(target); setDeleteItemOpen(true); };
  const confirmDeleteItem = () => {
    if (!deleteItemTarget || !editOrc) return;
    let updatedOrc: Orcamento;
    if (deleteItemTarget.kind === 'rolete') {
      updatedOrc = { ...editOrc, itensRolete: editOrc.itensRolete.filter((_, i) => i !== deleteItemTarget.idx) };
    } else {
      updatedOrc = { ...editOrc, itensProduto: editOrc.itensProduto.filter((_, i) => i !== deleteItemTarget.idx) };
    }
    const valorTotal = updatedOrc.itensRolete.reduce((s, i) => s + i.valorTotal, 0) + updatedOrc.itensProduto.reduce((s, i) => s + i.valorTotal, 0);
    updatedOrc = { ...updatedOrc, valorTotal };
    setEditOrc(updatedOrc);
    const updatedOrcs = orcamentos.map(o => o.id === updatedOrc.id ? updatedOrc : o);
    store.saveOrcamentos(updatedOrcs); setOrcamentos(updatedOrcs);
    const updatedPedido = { ...pedido, valorTotal };
    const updatedPedidos = pedidos.map(p => p.id === updatedPedido.id ? updatedPedido : p);
    store.savePedidos(updatedPedidos); setPedidos(updatedPedidos); setCurrentPedido(updatedPedido);
    setDeleteItemOpen(false); setDeleteItemTarget(null);
    if (editingItemIdx === deleteItemTarget.idx && editingItemKind === deleteItemTarget.kind) cancelEdit();
  };

  const combinedItems = editOrc
    ? [
        ...editOrc.itensRolete.map((item, idx) => ({ kind: 'rolete' as const, idx, item })),
        ...editOrc.itensProduto.map((item, idx) => ({ kind: 'produto' as const, idx, item })),
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => setView('list')} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        <Button variant="outline" onClick={() => setView('print')} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
      </div>

      {/* ===== Informações do Pedido (Header) ===== */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-bold mb-4">Pedido {pedido.numero}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-medium">Cliente</span>
            <strong className="text-sm break-words">{pedido.clienteNome}</strong>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-medium">Vendedor</span>
            <strong className="text-sm break-words">{orc?.vendedor || pedido.vendedor || '-'}</strong>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-medium">Condição de Pagamento</span>
            <strong className="text-sm break-words">{orc?.condicaoPagamento || '-'}</strong>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-medium">Tipo de Frete</span>
            <strong className="text-sm">{orc?.tipoFrete || '-'}</strong>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-medium">Data</span>
            <strong className="text-sm">{pedido.createdAt}</strong>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-medium">Previsão de Entrega</span>
            <strong className="text-sm break-words">{orc?.previsaoEntrega || pedido.dataEntrega || '-'}</strong>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-medium">Valor Total</span>
            <strong className="text-sm text-primary">{fmt(pedido.valorTotal)}</strong>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px] font-medium">Status</span>
            <strong className="text-sm">{pedido.status.replace('_', ' ')}</strong>
          </div>
        </div>
        {orc?.observacao && (
          <div className="mt-4 pt-3 border-t">
            <span className="text-muted-foreground text-[11px] font-medium">Observação</span>
            <p className="text-sm mt-1">{orc.observacao}</p>
          </div>
        )}
      </div>

      {/* ===== Lista de Itens ===== */}
      <div className="bg-card border rounded-lg p-6">
        <h3 className="font-semibold mb-4">Itens do Pedido ({combinedItems.length})</h3>
        <p className="text-xs text-muted-foreground mb-3">Clique em um item para editar suas especificações técnicas.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left whitespace-nowrap">Item</th>
                <th className="p-2 text-left whitespace-nowrap">Descrição</th>
                <th className="p-2 text-center whitespace-nowrap">Qtd</th>
                <th className="p-2 text-right whitespace-nowrap">Valor Unit.</th>
                <th className="p-2 text-right whitespace-nowrap">Total</th>
                <th className="p-2 text-center whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody>
              {combinedItems.length > 0 ? (
                combinedItems.map((row, i) => {
                  const isRolete = row.kind === 'rolete';
                  const valorUnit = isRolete ? (row.item.valorPorPeca || 0) : (row.item.valorUnitario || 0);
                  const total = valorUnit * (row.item.quantidade || 0);
                  const descricao = isRolete
                    ? `Rolete ${row.item.tipoRolete} ø${row.item.diametroTubo}x${row.item.paredeTubo} T:${row.item.comprimentoTubo}mm E:ø${row.item.diametroEixo} ${row.item.comprimentoEixo}mm — Enc: ${row.item.tipoEncaixe || '-'} — Rev: ${row.item.especificacaoRevestimento || '-'}`
                    : row.item.produtoNome || '-';
                  const isEditing = editingItemIdx === row.idx && editingItemKind === row.kind;
                  
                  return (
                    <tr key={`${row.kind}-${i}`} className={`border-b cursor-pointer transition-colors ${isEditing ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted/30'}`}
                      onClick={() => { if (isRolete) openRoleteEditor(row.idx); }}>
                      <td className="p-2 text-center font-mono">{i + 1}</td>
                      <td className="p-2 align-top min-w-[200px]">
                        <div className="text-[11px] text-foreground font-medium">{descricao}</div>
                      </td>
                      <td className="p-2 text-center font-bold">{row.item.quantidade}</td>
                      <td className="p-2 text-right font-mono">{fmt(Number(valorUnit || 0))}</td>
                      <td className="p-2 text-right font-semibold text-primary">{fmt(Number(total || 0))}</td>
                      <td className="p-2 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {isRolete && (
                            <button onClick={() => openRoleteEditor(row.idx)} className="p-1 rounded hover:bg-muted text-primary" title="Editar Item">
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => requestDeleteItem({ kind: row.kind, idx: row.idx })} className="p-1 rounded hover:bg-muted text-destructive" title="Excluir Item">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum item para exibir.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Rolete Editor Form ===== */}
      {editingItemKind === 'rolete' && editingItemIdx !== null && (
        <div className="border-2 border-primary/30 rounded-lg p-4 bg-card">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <Settings2 className="h-4 w-4" /> Editar Item – Rolete (Item {editingItemIdx + 1})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <label className="text-xs text-primary font-medium">Tipo de Rolete</label>
              <select value={roleteItem.tipoRolete} onChange={e => updateRoleteField({ tipoRolete: e.target.value as any })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="">Selecione...</option>
                {['RC', 'RR', 'RG', 'RI', 'RRA'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-primary font-medium">Diâmetro do Tubo</label>
              <select value={roleteItem.diametroTubo || ''} onChange={e => updateRoleteField({ diametroTubo: +e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="">Selecione...</option>
                {diametrosTubo.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-primary font-medium">Parede do Tubo</label>
              <select value={roleteItem.paredeTubo || ''} onChange={e => updateRoleteField({ paredeTubo: +e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="">Selecione...</option>
                {paredesTubo(roleteItem.diametroTubo).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-primary font-medium">Comp. Tubo (mm)</label>
              <div className="relative">
                <Input type="number" step="0.01" value={roleteItem.comprimentoTubo || ''} onChange={e => updateRoleteField({ comprimentoTubo: e.target.value ? parseFloat(e.target.value) : '' as any })} className="pr-10" />
                {roleteItem.comprimentoTubo ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{roleteItem.comprimentoTubo} mm</span> : null}
              </div>
            </div>
            <div>
              <label className="text-xs text-primary font-medium">Diâmetro do Eixo</label>
              <select value={roleteItem.diametroEixo || ''} onChange={e => updateRoleteField({ diametroEixo: +e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="">Selecione...</option>
                {diametrosEixo.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-primary font-medium">Comp. Eixo (mm)</label>
              <div className="relative">
                <Input type="number" step="0.01" value={roleteItem.comprimentoEixo || ''} onChange={e => updateRoleteField({ comprimentoEixo: e.target.value ? parseFloat(e.target.value) : '' as any })} className="pr-10" />
                {roleteItem.comprimentoEixo ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{roleteItem.comprimentoEixo} mm</span> : null}
              </div>
            </div>
            <div>
              <label className="text-xs text-primary font-medium">Tipo do Encaixe</label>
              <div className="flex items-center gap-2">
                <select value={roleteItem.tipoEncaixe} onChange={e => updateRoleteField({ tipoEncaixe: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Selecione...</option>
                  {encaixes.map(e => <option key={e.id} value={e.tipo}>{e.tipo}</option>)}
                </select>
                {(() => { const img = encaixes.find(e => e.tipo === roleteItem.tipoEncaixe)?.imagem; return img ? <img src={img} alt="Encaixe" className="h-9 w-9 object-cover rounded border cursor-pointer hover:ring-2 hover:ring-primary transition-all shrink-0" onClick={() => setPreviewImage({ src: img, title: `Encaixe – ${roleteItem.tipoEncaixe}` })} /> : null; })()}
              </div>
            </div>
            <div>
              <label className="text-xs text-primary font-medium">Conjunto/Kits</label>
              <div className="flex items-center gap-2">
                <select value={roleteItem.conjunto} onChange={e => updateRoleteField({ conjunto: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Selecione...</option>
                  {conjuntos.map(c => <option key={c.id} value={c.codigo}>{c.codigo}</option>)}
                </select>
                {(() => { const img = conjuntos.find(c => c.codigo === roleteItem.conjunto)?.imagem; return img ? <img src={img} alt="Conjunto" className="h-9 w-9 object-cover rounded border cursor-pointer hover:ring-2 hover:ring-primary transition-all shrink-0" onClick={() => setPreviewImage({ src: img, title: `Conjunto – ${roleteItem.conjunto}` })} /> : null; })()}
              </div>
            </div>
            <div>
              <label className="text-xs text-primary font-medium">Revest. Spiraflex</label>
              <select value={revestimentos.find(r => r.tipo.toUpperCase().includes('SPIRAFLEX') && r.tipo === roleteItem.especificacaoRevestimento) ? roleteItem.especificacaoRevestimento : ''}
                onChange={e => updateRoleteField({ especificacaoRevestimento: e.target.value, tipoRevestimento: e.target.value ? 'SPIRAFLEX' : '', quantidadeAneis: 0 })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="">Sem Spiraflex</option>
                {revestimentos.filter(r => r.tipo.toUpperCase().includes('SPIRAFLEX')).map(r => <option key={r.id} value={r.tipo}>{r.tipo}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-primary font-medium">Revest. Borracha</label>
              <select value={revestimentos.find(r => r.tipo.toUpperCase().includes('ABI') && r.tipo === roleteItem.especificacaoRevestimento) ? roleteItem.especificacaoRevestimento : ''}
                onChange={e => updateRoleteField({ especificacaoRevestimento: e.target.value, tipoRevestimento: e.target.value ? 'ANEIS' : '', quantidadeAneis: e.target.value ? (roleteItem.quantidadeAneis || 1) : 0 })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="">Sem Anéis</option>
                {revestimentos.filter(r => r.tipo.toUpperCase().includes('ABI')).map(r => <option key={r.id} value={r.tipo}>{r.tipo}</option>)}
              </select>
            </div>
            {roleteItem.especificacaoRevestimento && revestimentos.find(r => r.tipo === roleteItem.especificacaoRevestimento && r.tipo.toUpperCase().includes('ABI')) && (
              <div>
                <label className="text-xs text-primary font-medium">Qtd. Anéis</label>
                <Input type="number" min={1} value={roleteItem.quantidadeAneis} onChange={e => updateRoleteField({ quantidadeAneis: +e.target.value })} />
              </div>
            )}
            <div>
              <label className="text-xs text-primary font-medium">Adicional</label>
              <Input value={(roleteItem as any).adicional || ''} onChange={e => updateRoleteField({ adicional: e.target.value } as any)} placeholder="Informações adicionais" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mt-3 text-sm">
            <div>
              <label className="text-xs text-primary font-medium">Código do Produto</label>
              <Input placeholder="Ex: RC-102-250" value={codigoRolete} onChange={e => setCodigoRolete(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-primary font-medium">Código do Cliente</label>
              <Input placeholder="Código do cliente" value={(roleteItem as any).codigoExterno || ''} onChange={e => updateRoleteField({ codigoExterno: e.target.value } as any)} />
            </div>
            <div>
              <label className="text-xs text-primary font-medium">Quantidade</label>
              <Input type="number" value={roleteItem.quantidade || ''} onChange={e => updateRoleteField({ quantidade: e.target.value ? +e.target.value : '' as any })} />
            </div>
            <div>
              <label className="text-xs text-primary font-medium">Multiplicador {roleteItem.multiplicador}%</label>
              <Input type="number" step="0.1" value={roleteItem.multiplicador || ''} onChange={e => updateRoleteField({ multiplicador: e.target.value ? +e.target.value : '' as any })} />
            </div>
            <div>
              <label className="text-xs text-primary font-medium">NCM</label>
              <Input placeholder="NCM" value={roleteItem.ncm || '8431.39.00'} onChange={e => updateRoleteField({ ncm: e.target.value } as any)} />
            </div>
            <div>
              <label className="text-xs text-primary font-medium">Desconto (%)</label>
              <Input type="number" value={roleteItem.desconto || ''} onChange={e => updateRoleteField({ desconto: e.target.value ? +e.target.value : '' as any })} />
            </div>
          </div>
          <div className="bg-muted/30 rounded p-3 mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-xs text-primary">Preço Unit. Final</span><br /><strong>{fmt(roleteItem.valorPorPeca)}</strong></div>
            <div><span className="text-xs text-primary">Total Item</span><br /><strong>{fmt(roleteItem.valorTotal)}</strong></div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={saveRoleteEdit} className="gap-2 bg-yellow-500 hover:bg-yellow-600 text-white">
              ✓ Salvar edição
            </Button>
            <Button variant="outline" onClick={cancelEdit}>Cancelar</Button>
          </div>
          <ImagePreviewModal
            open={!!previewImage}
            onOpenChange={(open) => { if (!open) setPreviewImage(null); }}
            imageSrc={previewImage?.src || ''}
            title={previewImage?.title}
          />
        </div>
      )}

      <ConfirmDialog
        open={deleteItemOpen}
        onOpenChange={(open) => { if (!open) { setDeleteItemOpen(false); setDeleteItemTarget(null); } }}
        title="Excluir registro"
        description="Tem certeza que deseja excluir este registro?"
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        onConfirm={confirmDeleteItem}
      />
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
  const [searchParams] = useSearchParams();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('list');
  const [currentPedido, setCurrentPedido] = useState<Pedido | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Pedido | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [trackingVendor, setTrackingVendor] = useState('');

  // Confirm delete states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteOrcConfirmId, setDeleteOrcConfirmId] = useState<string | null>(null);

  // PDF preview + sharing (used in "print" view)
  const printRef = useRef<HTMLDivElement | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  const { usuarios: dbUsuarios } = useUsuarios();
  const loggedUserId = localStorage.getItem('rp_logged_user');
  const currentUser = dbUsuarios.find(u => u.id === loggedUserId);

  const fullAccessRoles = ['master', 'SEO', 'admin', 'Admin', 'Administrador', 'administrador', 'adm/dono'];
  const isFullAccess = currentUser ? fullAccessRoles.includes(currentUser.nivel) : false;

  const clientes = store.getClientes();
  const produtos = store.getProdutos();

  useEffect(() => {
    const load = () => { setPedidos(store.getPedidos()); setOrcamentos(store.getOrcamentos()); };
    load();
    window.addEventListener('rp-data-synced', load);
    return () => window.removeEventListener('rp-data-synced', load);
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPedidoPrintMeta = () => {
    if (!currentPedido) return { fileName: 'pedido.pdf', vendedorUsuario: '-', clienteEmail: '' };
    const orc = orcamentos.find(o => o.id === currentPedido.orcamentoId);
    const vendedorUsuario = orc?.vendedor || currentPedido.vendedor || '-';
    const cli = store.getClientes().find(c => c.nome === currentPedido.clienteNome);
    const clienteEmail = cli?.email || '';
    const fileName = `Pedido-${currentPedido.numero}-Vendedor-${String(vendedorUsuario).replace(/\s+/g, '-')}.pdf`;
    return { fileName, vendedorUsuario, clienteEmail };
  };

  const generatePedidoPdf = async () => {
    if (!currentPedido) return null;
    if (!printRef.current) return null;
    if (pdfGenerating) return null;

    setPdfGenerating(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const { fileName } = getPedidoPrintMeta();
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

      const pdfPageWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfPageWidth;
      const imgHeight = (canvas.height * pdfPageWidth) / canvas.width;
      const totalPages = Math.max(1, Math.ceil(imgHeight / pdfPageHeight));

      const pageHeightPx = Math.ceil(canvas.height / totalPages);

      for (let page = 0; page < totalPages; page++) {
        const pageCanvas = document.createElement('canvas');
        const startY = page * pageHeightPx;
        const height = Math.min(pageHeightPx, canvas.height - startY);

        pageCanvas.width = canvas.width;
        pageCanvas.height = height;

        const ctx = pageCanvas.getContext('2d');
        if (!ctx) continue;
        ctx.drawImage(canvas, 0, startY, canvas.width, height, 0, 0, canvas.width, height);

        const pageImgData = pageCanvas.toDataURL('image/png');
        const pageImgHeight = (pageCanvas.height * pdfPageWidth) / canvas.width;

        if (page > 0) pdf.addPage();
        pdf.addImage(pageImgData, 'PNG', 0, 0, imgWidth, pageImgHeight);
      }

      const blob = pdf.output('blob');
      // Keep blob + preview url for share/email flows
      setPdfBlob(blob);
      setPdfPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });

      return { blob, fileName };
    } finally {
      setPdfGenerating(false);
    }
  };

  const handlePreviewPdf = async () => {
    const pdf = await generatePedidoPdf();
    if (!pdf) return;
    setPdfPreviewOpen(true);
  };

  const handleSharePdfViaNavigator = async () => {
    const pdf = await generatePedidoPdf();
    if (!pdf) return false;
    const { fileName } = pdf;
    const file = new File([pdf.blob], fileName, { type: 'application/pdf' });

    try {
      if (navigator.share && (navigator as any).canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: fileName,
          text: `Pedido ${currentPedido?.numero} — Rollerport`,
        });
        return true;
      }
    } catch {
      // fallthrough to false
    }
    return false;
  };

  const handleSendWhatsApp = async () => {
    const ok = await handleSharePdfViaNavigator();
    if (ok) return;
    const { vendedorUsuario } = getPedidoPrintMeta();
    const msg = `Pedido ${currentPedido?.numero} (${vendedorUsuario}) — gere/baixe o PDF no botão "Gerar PDF" para encaminhar.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleSendEmail = async () => {
    const ok = await handleSharePdfViaNavigator();
    if (ok) return;
    const { clienteEmail, vendedorUsuario } = getPedidoPrintMeta();
    const to = clienteEmail || '';
    const subject = `Pedido ${currentPedido?.numero} - Rollerport`;
    const body = `Olá! Segue o Pedido ${currentPedido?.numero}.\nVendedor/Usuário: ${vendedorUsuario}\n\n(Anexe o PDF gerado em "Gerar PDF".)`;
    if (to) window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    else window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

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
      id: store.nextId('ped'),
      // Mantém o mesmo número do orçamento ao virar pedido
      numero: orc.numero,
      orcamentoId: orc.id,
      orcamentoNumero: orc.numero,
      clienteNome: orc.clienteNome,
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

  const deletePedido = (id: string) => { setDeleteConfirmId(id); };
  const confirmDeletePedido = () => {
    if (!deleteConfirmId) return;
    const updated = pedidos.filter(p => p.id !== deleteConfirmId); store.savePedidos(updated); setPedidos(updated);
    setDeleteConfirmId(null); toast.success('Pedido excluído!');
  };
  const confirmDeleteOrc = () => {
    if (!deleteOrcConfirmId) return;
    const updated = orcamentos.filter(x => x.id !== deleteOrcConfirmId); store.saveOrcamentos(updated); setOrcamentos(updated);
    setDeleteOrcConfirmId(null); toast.success('Orçamento excluído!');
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
      materiaisUtilizados: {},
      createdAt: new Date().toISOString().split('T')[0],
    };
    store.saveOrdensServico([...store.getOrdensServico(), os]);
    updateStatus(pedido.id, 'EM_PRODUCAO');
    const notifs = store.getNotificacoes();
    notifs.push({ id: store.nextId('notif'), tipo: 'producao', titulo: `O.S. ${os.numero} Gerada`, mensagem: `Ordem de serviço criada para ${pedido.clienteNome}`, lida: false, createdAt: new Date().toISOString() });
    store.saveNotificacoes(notifs); toast.success(`O.S. ${os.numero} gerada!`);
  };

  const orcSemPedido = orcamentos.filter(o => !pedidos.find(p => p.orcamentoId === o.id));

  const nameMatch = (vendedorField: string, userName: string) => {
    const a = (vendedorField || '').trim().toLowerCase();
    const b = (userName || '').trim().toLowerCase();
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a) || a.split(' ')[0] === b.split(' ')[0];
  };

  const filteredOrcs = orcSemPedido
    .filter(o => {
      if (isFullAccess) return true;
      return nameMatch(o.vendedor, currentUser?.nome || '');
    })
    .filter(o =>
      o.numero.includes(search) || clienteMatchesSearch(o.clienteNome, search)
    );
    
  const filteredPedidos = pedidos
    .filter(p => {
      if (isFullAccess) return true;
      const orc = orcamentos.find(o => o.id === p.orcamentoId);
      const vendor = p.vendedor || orc?.vendedor || '';
      return nameMatch(vendor, currentUser?.nome || '');
    })
    .filter(p =>
      p.numero.includes(search) || clienteMatchesSearch(p.clienteNome, search)
    );

  // ========== PRINT VIEW ==========
  if (view === 'print' && currentPedido) {
    const orc = orcamentos.find(o => o.id === currentPedido.orcamentoId);
    const cli = clientes.find(c => c.nome === currentPedido.clienteNome);
    const vendedorUsuario = orc?.vendedor || currentPedido.vendedor || '-';
    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden flex-wrap">
          <Button variant="outline" onClick={() => setView('list')} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
          <Button variant="default" onClick={handlePreviewPdf} className="gap-2" disabled={pdfGenerating}>
            {pdfGenerating ? <Clock className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {pdfGenerating ? 'Gerando PDF...' : 'Gerar PDF'}
          </Button>
          <Button variant="outline" onClick={handleSendWhatsApp} className="gap-2" disabled={pdfGenerating}>
            <Truck className="h-4 w-4" />
            Encaminhar por WhatsApp
          </Button>
          <Button variant="outline" onClick={handleSendEmail} className="gap-2" disabled={pdfGenerating}>
            <Mail className="h-4 w-4" />
            Enviar por E-mail
          </Button>
        </div>
        <div ref={printRef} className="bg-card border rounded-lg p-6 max-w-5xl mx-auto print:border-0 print:shadow-none print:max-w-none">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-6 border rounded p-4">
            <div><span className="font-semibold">Pedido Nº:</span> {currentPedido.numero}</div>
            <div><span className="font-semibold">Orçamento Nº:</span> {currentPedido.orcamentoNumero || '-'}</div>
            <div><span className="font-semibold">Data:</span> {currentPedido.createdAt}</div>
            <div><span className="font-semibold">Entrega:</span> {currentPedido.dataEntrega}</div>
            <div><span className="font-semibold">Vendedor/Usuário:</span> {vendedorUsuario}</div>
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

        {pdfPreviewOpen && pdfPreviewUrl && (
          <Dialog open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen}>
            <DialogContent className="max-w-6xl w-[95vw] h-[80vh] p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <DialogHeader className="p-0 m-0">
                  <DialogTitle className="text-base">Pré-visualização do PDF</DialogTitle>
                </DialogHeader>
                <Button variant="outline" size="sm" onClick={() => setPdfPreviewOpen(false)}>
                  Fechar
                </Button>
              </div>
              <iframe
                title="PDF preview"
                src={pdfPreviewUrl}
                className="w-full h-[calc(80vh-56px)] bg-white"
              />
            </DialogContent>
          </Dialog>
        )}
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
          <Input placeholder="Buscar por nº pedido, empresa, comprador, CNPJ, telefone, email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
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
                        <button onClick={() => setDeleteOrcConfirmId(o.id)} className="p-1.5 rounded hover:bg-muted text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
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
          <table className="w-full text-xs sm:text-[11px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-2 py-2 sm:px-3 font-medium whitespace-nowrap">Nº Pedido</th>
                <th className="text-left px-2 py-2 sm:px-3 font-medium whitespace-nowrap hidden lg:table-cell">Usuário</th>
                <th className="text-left px-2 py-2 sm:px-3 font-medium whitespace-nowrap">Cliente/Revenda</th>
                <th className="text-left px-2 py-2 sm:px-3 font-medium whitespace-nowrap">Data</th>
                <th className="text-left px-2 py-2 sm:px-3 font-medium whitespace-nowrap min-w-[120px] sm:min-w-[160px]">Status</th>
                <th className="text-right px-2 py-2 sm:px-3 font-medium whitespace-nowrap hidden sm:table-cell">Valor</th>
                <th className="px-2 py-2 sm:px-3 font-medium text-right whitespace-nowrap w-[160px] sm:w-[200px]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredPedidos.map(p => {
                const days = daysSince(p.createdAt);
                const lastStatusChange = p.statusHistory?.length ? p.statusHistory[p.statusHistory.length - 1] : null;
                const daysInStatus = lastStatusChange ? daysSince(lastStatusChange.date) : days;
                const orc = orcamentos.find(o => o.id === p.orcamentoId);
                const usuario = p.vendedor || orc?.vendedor || '—';
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-2 py-2 sm:px-3 font-mono font-semibold whitespace-nowrap">
                      <button
                        type="button"
                        className="text-primary underline-offset-2 hover:underline font-semibold"
                        onClick={() => { setCurrentPedido(p); setView('view'); }}
                      >
                        {p.numero}
                      </button>
                    </td>
                    <td className="px-2 py-2 sm:px-3 hidden lg:table-cell text-[10px] text-muted-foreground truncate max-w-[120px]">
                      {usuario}
                    </td>
                    <td className="px-2 py-2 sm:px-3 truncate max-w-[140px] sm:max-w-[220px]">
                      {p.clienteNome}
                    </td>
                    <td className="px-2 py-2 sm:px-3 whitespace-nowrap">
                      {fmtDateShort(p.createdAt)}
                    </td>
                    <td className="px-2 py-2 sm:px-3">
                      <StatusProgressBar status={p.status} />
                      <div className="hidden xl:flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3" />
                        <span>
                          Total: {days}d • No status: {daysInStatus}d
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 sm:px-3 text-right font-mono hidden sm:table-cell whitespace-nowrap">
                      {fmt(p.valorTotal)}
                    </td>
                    <td className="px-2 py-2 sm:px-3 pr-3 text-right">
                      <div className="flex gap-1 justify-end flex-nowrap">
                        <button onClick={() => { setCurrentPedido(p); setView('print'); }} className="p-1 sm:p-1.5 rounded hover:bg-muted" title="Imprimir"><Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
                        {p.status === 'PENDENTE' && <button onClick={() => gerarOS(p)} className="p-1 sm:p-1.5 rounded hover:bg-muted text-primary" title="Gerar O.S."><Factory className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>}
                        <button 
                          onClick={() => {
                            const orc = orcamentos.find(o => o.id === p.orcamentoId);
                            const vendor = p.vendedor || orc?.vendedor || 'Sistema';
                            setTrackingVendor(vendor);
                            setIsTrackingOpen(true);
                          }} 
                          className="p-1 sm:p-1.5 rounded hover:bg-muted text-primary" 
                          title="CRM (Histórico/Observações)"
                        >
                          <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                        <button
                          onClick={() => {
                            const orc = orcamentos.find(o => o.id === p.orcamentoId);
                            const vendor = p.vendedor || orc?.vendedor || 'Sistema';
                            setTrackingVendor(vendor);
                            setIsTrackingOpen(true);
                          }}
                          className="p-1 sm:p-1.5 rounded hover:bg-muted text-primary"
                          title="Rastrear Pedido"
                        >
                          <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                        {p.status === 'EM_PRODUCAO' && <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, 'CONCLUIDO')} className="text-[10px] sm:text-xs h-6 sm:h-7 px-1.5 sm:px-2">Concluir</Button>}
                        {p.status === 'CONCLUIDO' && <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, 'ENTREGUE')} className="text-[10px] sm:text-xs h-6 sm:h-7 px-1.5 sm:px-2">Entregar</Button>}
                        <button onClick={() => cancelarPedido(p)} className="p-1 sm:p-1.5 rounded hover:bg-muted text-warning" title="Cancelar"><XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
                        <button onClick={() => deletePedido(p.id)} className="p-1 sm:p-1.5 rounded hover:bg-muted text-destructive" title="Excluir"><Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
                      </div>
                  </td>
                </tr>
                );
              })}
              {filteredPedidos.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum pedido.</td></tr>}
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

      <AcompanhamentoPedidosModal 
        isOpen={isTrackingOpen}
        onOpenChange={setIsTrackingOpen}
        vendedor={trackingVendor}
        pedidos={pedidos}
        orcamentos={orcamentos}
        onMetaUpdate={() => {}} // Not strictly needed here as we don't show meta cards in PedidosPage
      />
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
        title="Excluir registro"
        description="Tem certeza que deseja excluir este registro?"
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        onConfirm={confirmDeletePedido}
      />
      <ConfirmDialog
        open={!!deleteOrcConfirmId}
        onOpenChange={(open) => { if (!open) setDeleteOrcConfirmId(null); }}
        title="Excluir registro"
        description="Tem certeza que deseja excluir este registro?"
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        onConfirm={confirmDeleteOrc}
      />
    </div>
  );
}
