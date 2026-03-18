import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import type { Produto, TipoRolete } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Edit, Search, Settings2, Package } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number) => v ? `R$ ${v.toFixed(2).replace('.', ',')}` : '-';

const tiposRolete: TipoRolete[] = ['RC', 'RR', 'RG', 'RI', 'RRA'];

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [search, setSearch] = useState('');
  const [openRolete, setOpenRolete] = useState(false);
  const [openProduto, setOpenProduto] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Produto | null>(null);

  const emptyRolete = (): Produto => ({
    id: '', codigo: '', codigoCliente: '', nome: '', nomeCompleto: '', tipo: 'RC', medidas: '', descricao: '',
    miniDescricao: '', valor: 0, createdAt: new Date().toISOString().split('T')[0],
  });

  const emptyProduto = (): Produto => ({
    id: '', codigo: '', nome: '', nomeCompleto: '', tipo: 'GENERICO', medidas: '', descricao: '', valor: '' as any,
    createdAt: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const load = () => setProdutos(store.getProdutos());
    load();
    window.addEventListener('rp-data-synced', load);
    return () => window.removeEventListener('rp-data-synced', load);
  }, []);

  const filtered = produtos.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    p.codigo.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (item: Produto, isRolete: boolean) => {
    // Check for duplicate code
    const duplicate = produtos.find(p => p.codigo === item.codigo && p.id !== item.id);
    if (duplicate) {
      toast.error(`Já existe um produto com o código "${item.codigo}" (${duplicate.nome})`);
      return;
    }

    let updated: Produto[];
    if (item.id) {
      updated = produtos.map(p => p.id === item.id ? item : p);
    } else {
      updated = [...produtos, { ...item, id: store.nextId('prod') }];
    }
    store.saveProdutos(updated);
    setProdutos(updated);
    setOpenRolete(false);
    setOpenProduto(false);
    setEditing(null);
    toast.success('Produto salvo!');
  };

  const handleDelete = (produto: Produto) => {
    const updated = produtos.filter(p => p.id !== produto.id);
    store.saveProdutos(updated);
    setProdutos(updated);
    setDeleteConfirm(null);
    toast.success('Produto removido!');
  };

  const openEditDialog = (p: Produto) => {
    setEditing(p);
    if (p.tipo !== 'GENERICO') setOpenRolete(true);
    else setOpenProduto(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-header">Produtos</h1>
          <p className="page-subtitle">Catálogo de roletes e produtos</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setEditing(emptyRolete()); setOpenRolete(true); }} variant="outline" className="gap-2">
            <Settings2 className="h-4 w-4" /> Cadastrar Rolete
          </Button>
          <Button onClick={() => { setEditing(emptyProduto()); setOpenProduto(true); }} className="gap-2">
            <Package className="h-4 w-4" /> Cadastrar Produto
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por código ou nome..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Rolete Dialog */}
      <Dialog open={openRolete} onOpenChange={setOpenRolete}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar' : 'Cadastrar'} Rolete</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground">Código Interno</label><Input value={editing.codigo} onChange={e => setEditing({ ...editing, codigo: e.target.value })} placeholder="Ex: RC-001" /></div>
              <div><label className="text-xs text-muted-foreground">Código do Cliente (editável)</label><Input value={editing.codigoCliente || ''} onChange={e => setEditing({ ...editing, codigoCliente: e.target.value })} placeholder="Código do cliente" /></div>
              <div><label className="text-xs text-muted-foreground">Nome</label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Nome Completo (aparece entre parênteses)</label><Input value={editing.nomeCompleto || ''} onChange={e => setEditing({ ...editing, nomeCompleto: e.target.value })} placeholder="Ex: Rolete de Carga" /></div>
              <div>
                <label className="text-xs text-muted-foreground">Tipo do Rolete</label>
                <select value={editing.tipo} onChange={e => setEditing({ ...editing, tipo: e.target.value as TipoRolete })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {tiposRolete.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground">Mini Descrição</label><Input value={editing.miniDescricao || ''} onChange={e => setEditing({ ...editing, miniDescricao: e.target.value })} placeholder='Ex: Rolete para correia de 30"' /></div>
              <div><label className="text-xs text-muted-foreground">NCM</label><Input value={(editing as any).ncm || ''} onChange={e => setEditing({ ...editing, ncm: e.target.value } as any)} placeholder="Ex: 8431.39.00" /></div>
              <p className="text-xs text-muted-foreground italic">Valor do rolete é sempre zero (calculado no orçamento)</p>
              <div className="flex justify-end mt-4"><Button onClick={() => handleSave({ ...editing, valor: 0 }, true)}>Salvar</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Produto Dialog */}
      <Dialog open={openProduto} onOpenChange={setOpenProduto}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar' : 'Cadastrar'} Produto</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground">Código</label><Input value={editing.codigo} onChange={e => setEditing({ ...editing, codigo: e.target.value })} placeholder="Ex: PRD-001" /></div>
              <div><label className="text-xs text-muted-foreground">Nome</label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Nome Completo (aparece entre parênteses)</label><Input value={editing.nomeCompleto || ''} onChange={e => setEditing({ ...editing, nomeCompleto: e.target.value })} placeholder="Ex: Bucha de Desgaste" /></div>
              <div><label className="text-xs text-muted-foreground">Medidas</label><Input value={editing.medidas} onChange={e => setEditing({ ...editing, medidas: e.target.value })} placeholder="Ex: 100x50x30mm" /></div>
              <div><label className="text-xs text-muted-foreground">Descrição</label><Textarea value={editing.descricao} onChange={e => setEditing({ ...editing, descricao: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Valor (R$)</label><Input type="number" step="0.01" value={editing.valor || ''} placeholder="Deixe vazio se necessário" onChange={e => setEditing({ ...editing, valor: e.target.value ? +e.target.value : '' as any })} /></div>
              <div><label className="text-xs text-muted-foreground">NCM</label><Input value={(editing as any).ncm || ''} onChange={e => setEditing({ ...editing, ncm: e.target.value } as any)} placeholder="Ex: 8431.39.00" /></div>
              <div className="flex justify-end mt-4"><Button onClick={() => handleSave(editing, false)}>Salvar</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* GRID */}
      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm">Código</th>
              <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm">Nome</th>
              <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm hidden sm:table-cell">Tipo</th>
              <th className="text-right p-2 sm:p-3 font-medium text-xs sm:text-sm hidden sm:table-cell">Valor</th>
              <th className="p-2 sm:p-3 w-20">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-2 sm:p-3 font-mono text-[10px] sm:text-xs">{p.codigo}</td>
                <td className="p-2 sm:p-3 font-medium text-xs sm:text-sm">
                  <span className="truncate block max-w-[150px] sm:max-w-none">{p.nome}</span>
                  {p.nomeCompleto && <span className="text-[10px] sm:text-xs text-muted-foreground block sm:inline sm:ml-2">({p.nomeCompleto})</span>}
                  {!p.nomeCompleto && p.miniDescricao && <span className="text-[10px] sm:text-xs text-muted-foreground block sm:inline sm:ml-2">({p.miniDescricao})</span>}
                </td>
                <td className="p-2 sm:p-3 hidden sm:table-cell">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    p.tipo === 'GENERICO' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                  }`}>{p.tipo === 'GENERICO' ? 'Produto' : `Rolete ${p.tipo}`}</span>
                </td>
                <td className="p-2 sm:p-3 text-right font-mono hidden sm:table-cell">{p.tipo === 'GENERICO' ? fmt(p.valor) : 'Calculado'}</td>
                <td className="p-2 sm:p-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEditDialog(p)} className="p-1 rounded hover:bg-muted text-primary"><Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
                    <button onClick={() => setDeleteConfirm(p)} className="p-1 rounded hover:bg-muted text-destructive"><Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum produto cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o produto <strong>{deleteConfirm?.nome}</strong>?
              <br />
              Esta ação não pode ser desfeita e o produto será removido para todos os usuários.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
