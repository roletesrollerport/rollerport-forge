import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { store } from '@/lib/store';
import { useUsuarios } from '@/hooks/useUsuarios';
import type { Pedido, StatusPedido, Orcamento, ItemOrcamento, ItemProdutoOrcamento } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Factory, Eye, Trash2, Search, ShoppingCart, XCircle, Printer, ArrowLeft, Clock, Calendar, History, Truck, FileText, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { AcompanhamentoPedidosModal } from '@/components/AcompanhamentoPedidosModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import logo from '@/assets/logo.png';

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

  type DeleteItemTarget =
    | { kind: 'rolete'; idx: number }
    | { kind: 'produto'; idx: number };

  const [deleteItemOpen, setDeleteItemOpen] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState<DeleteItemTarget | null>(null);

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
    setEditOrc(prev => {
      if (!prev) return prev;
      const items = [...prev.itensRolete];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, itensRolete: items };
    });
  };
  const updateProdutoItem = (idx: number, field: string, value: any) => {
    setEditOrc(prev => {
      if (!prev) return prev;
      const items = [...prev.itensProduto];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, itensProduto: items };
    });
  };

  const requestDeleteItem = (target: DeleteItemTarget) => {
    setDeleteItemTarget(target);
    setDeleteItemOpen(true);
  };

  const confirmDeleteItem = () => {
    if (!deleteItemTarget) return;

    setEditOrc(prev => {
      if (!prev) return prev;
      if (deleteItemTarget.kind === 'rolete') {
        return { ...prev, itensRolete: prev.itensRolete.filter((_, i) => i !== deleteItemTarget.idx) };
      }
      return { ...prev, itensProduto: prev.itensProduto.filter((_, i) => i !== deleteItemTarget.idx) };
    });

    setDeleteItemOpen(false);
    setDeleteItemTarget(null);
  };

  const combinedItems = editOrc
    ? [
        ...editOrc.itensRolete.map((item, idx) => ({ kind: 'rolete' as const, idx, item })),
        ...editOrc.itensProduto.map((item, idx) => ({ kind: 'produto' as const, idx, item })),
      ]
    : [];

  const getDescricaoTecnica = (row: (typeof combinedItems)[number]) => {
    if (row.kind === 'rolete') {
      const it = row.item;
      return [
        `Rolete ${it.tipoRolete}`,
        `ø${it.diametroTubo}x${it.paredeTubo} (Tubo ${it.comprimentoTubo}mm)`,
        `Eixo ø${it.diametroEixo}mm`,
        `Encaixe ${it.tipoEncaixe || '-'}`,
        `Fresa ${it.medidaFresado || '-'}`,
        `Revest. ${it.especificacaoRevestimento || '-'}`,
      ].join(' • ');
    }

    const it = row.item;
    const extra = it.descricao || it.medidas || '';
    return extra ? `${it.produtoNome} — ${extra}` : it.produtoNome;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setView('list')} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        <Button variant="outline" onClick={() => setView('print')} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
        <Button onClick={saveOrcChanges} className="gap-2">Salvar Alterações</Button>
      </div>
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-bold mb-4">Pedido {pedido.numero} — Edição Completa</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm mb-6">
          <div className="flex flex-col gap-1 break-words">
            <span className="text-muted-foreground text-[11px] font-medium">Número do Pedido</span>
            <strong className="text-sm">{pedido.numero}</strong>
          </div>
          <div className="flex flex-col gap-1 break-words">
            <span className="text-muted-foreground text-[11px] font-medium">Cliente</span>
            <strong className="text-sm break-words">{pedido.clienteNome}</strong>
          </div>
          <div className="flex flex-col gap-1 break-words">
            <span className="text-muted-foreground text-[11px] font-medium">Vendedor/Usuário</span>
            <strong className="text-sm break-words">{orc?.vendedor || pedido.vendedor || '-'}</strong>
          </div>
          <div className="flex flex-col gap-1 break-words">
            <span className="text-muted-foreground text-[11px] font-medium">Número do Orçamento</span>
            <strong className="text-sm">{pedido.orcamentoNumero || orc?.numero || '-'}</strong>
          </div>
          <div className="flex flex-col gap-1 break-words">
            <span className="text-muted-foreground text-[11px] font-medium">Data</span>
            <strong className="text-sm">{pedido.createdAt}</strong>
          </div>
          <div className="flex flex-col gap-1 break-words">
            <span className="text-muted-foreground text-[11px] font-medium">Prazo de Entrega (do Vendedor)</span>
            <strong className="text-sm break-words">{orc?.previsaoEntrega || pedido.dataEntrega || '-'}</strong>
          </div>
        </div>
        {editOrc && (
          <>
            <div className="mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left whitespace-nowrap">Item</th>
                      <th className="p-2 text-left whitespace-nowrap">Descrição Rolete</th>
                      <th className="p-2 text-left whitespace-nowrap">Medida (mm)</th>
                      <th className="p-2 text-left whitespace-nowrap">Diâmetro/Eixo</th>
                      <th className="p-2 text-left whitespace-nowrap">Parede/Tubo</th>
                      <th className="p-2 text-left whitespace-nowrap">Revestimento</th>
                      <th className="p-2 text-center whitespace-nowrap">Quantidade</th>
                      <th className="p-2 text-center whitespace-nowrap">Valor Unitário</th>
                      <th className="p-2 text-center whitespace-nowrap">Total Item</th>
                      <th className="p-2 text-center whitespace-nowrap">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedItems.length > 0 ? (
                      combinedItems.map((row, i) => {
                        const total =
                          row.kind === 'rolete'
                            ? (row.item.valorPorPeca || 0) * (row.item.quantidade || 0)
                            : (row.item.valorUnitario || 0) * (row.item.quantidade || 0);

                        const valorUnit =
                          row.kind === 'rolete' ? (row.item.valorPorPeca || 0) : (row.item.valorUnitario || 0);

                        const descricaoRolete =
                          row.kind === 'rolete'
                            ? `Rolete ${row.item.tipoRolete || '-'}` 
                            : row.item.produtoNome || '-';

                        const medidaMm =
                          row.kind === 'rolete'
                            ? `${row.item.comprimentoTubo || 0} / ${row.item.comprimentoEixo || 0}`
                            : row.item.medidas || row.item.descricao || '-';

                        const diametroEixo =
                          row.kind === 'rolete'
                            ? `ø${row.item.diametroEixo || '-'}`
                            : '-';

                        const paredeTubo =
                          row.kind === 'rolete'
                            ? `${row.item.paredeTubo || '-'}`
                            : '-';

                        const revestimento =
                          row.kind === 'rolete'
                            ? row.item.especificacaoRevestimento || '-'
                            : row.item.descricao || '-';

                        return (
                          <tr key={`${row.kind}-${i}`} className="border-b">
                            <td className="p-2 text-center font-mono">{i + 1}</td>
                            <td className="p-2 align-top break-words min-w-[140px]">
                              <div className="text-[11px] text-foreground font-medium">
                                {descricaoRolete}
                              </div>
                            </td>
                            <td className="p-2 align-top break-words min-w-[140px]">
                              <div className="text-[11px] text-muted-foreground">
                                {medidaMm}
                              </div>
                            </td>
                            <td className="p-2 align-top">
                              <div className="text-[11px] text-muted-foreground">
                                {diametroEixo}
                              </div>
                            </td>
                            <td className="p-2 align-top">
                              <div className="text-[11px] text-muted-foreground">
                                {paredeTubo}
                              </div>
                            </td>
                            <td className="p-2 align-top break-words min-w-[160px]">
                              <div className="text-[11px] text-muted-foreground">
                                {revestimento}
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              <Input
                                type="number"
                                className="h-7 w-20 text-xs mx-auto"
                                value={row.item.quantidade}
                                onChange={e =>
                                  row.kind === 'rolete'
                                    ? updateRoleteItem(row.idx, 'quantidade', +e.target.value)
                                    : updateProdutoItem(row.idx, 'quantidade', +e.target.value)
                                }
                              />
                            </td>
                            <td className="p-2 text-center text-xs text-muted-foreground">
                              <div className="font-mono">{fmt(Number(valorUnit || 0))}</div>
                            </td>
                            <td className="p-2 text-center font-semibold text-primary">
                              {fmt(Number(total || 0))}
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    window.dispatchEvent(new CustomEvent('rp-open-pedido-tracking', { detail: { pedidoId: pedido.id } }));
                                  }}
                                  className="p-1 rounded hover:bg-muted text-primary"
                                  title="Acompanhar Pedido"
                                >
                                  <History className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Cancelamento de item pode ser tratado como exclusão lógica futura
                                    toast.warning('Em breve: cancelamento individual de item.');
                                  }}
                                  className="p-1 rounded hover:bg-muted text-warning"
                                  title="Cancelar Item"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => requestDeleteItem({ kind: row.kind, idx: row.idx })}
                                  className="p-1 rounded hover:bg-muted text-destructive"
                                  title="Excluir Item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    toast.info('Use a ação "Gerar O.S." na lista de pedidos para este pedido.');
                                  }}
                                  className="p-1 rounded hover:bg-muted text-primary"
                                  title="Gerar O.S."
                                >
                                  <Factory className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          Nenhum item para exibir.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <ConfirmDialog
              open={deleteItemOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setDeleteItemOpen(false);
                  setDeleteItemTarget(null);
                }
              }}
              title="Excluir registro"
              description="Tem certeza que deseja excluir este registro?"
              confirmLabel="Confirmar"
              cancelLabel="Cancelar"
              onConfirm={confirmDeleteItem}
            />
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
      p.numero.includes(search) || (p.orcamentoNumero || '').includes(search) || clienteMatchesSearch(p.clienteNome, search)
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
                <th className="text-left px-2 py-2 sm:px-3 font-medium whitespace-nowrap hidden md:table-cell">Nº Orçamento</th>
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
                    <td className="px-2 py-2 sm:px-3 font-mono font-semibold whitespace-nowrap">{p.numero}</td>
                    <td className="px-2 py-2 sm:px-3 hidden md:table-cell font-mono text-[10px] text-primary whitespace-nowrap">
                      {p.orcamentoNumero ? (
                        <button
                          type="button"
                          className="underline-offset-2 hover:underline"
                          onClick={() => navigate(`/orcamentos?q=${encodeURIComponent(p.orcamentoNumero || '')}&mode=edit`)}
                        >
                          {p.orcamentoNumero}
                        </button>
                      ) : (
                        '-'
                      )}
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
