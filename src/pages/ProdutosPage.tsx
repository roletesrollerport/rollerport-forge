import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import type { Produto } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';

const emptyProduto = (): Produto => ({
  id: '', codigo: '', nome: '', tipo: 'GENERICO', medidas: '', descricao: '', valor: 0,
  createdAt: new Date().toISOString().split('T')[0],
});

const fmt = (v: number) => `R$ ${v.toFixed(2)}`;

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Produto>(emptyProduto());

  useEffect(() => {
    setProdutos(store.getProdutos());
  }, []);

  const handleSave = () => {
    let updated: Produto[];
    if (editing.id) {
      updated = produtos.map(p => p.id === editing.id ? editing : p);
    } else {
      updated = [...produtos, { ...editing, id: store.nextId('prod') }];
    }
    store.saveProdutos(updated);
    setProdutos(updated);
    setOpen(false);
    toast.success('Produto salvo!');
  };

  const handleDelete = (id: string) => {
    const updated = produtos.filter(p => p.id !== id);
    store.saveProdutos(updated);
    setProdutos(updated);
    toast.success('Produto removido!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-header">Produtos</h1>
          <p className="page-subtitle">Catálogo de roletes e produtos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(emptyProduto())} className="gap-2"><Plus className="h-4 w-4" /> Novo Produto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing.id ? 'Editar' : 'Novo'} Produto</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground">Código do Produto</label><Input value={editing.codigo} onChange={e => setEditing({ ...editing, codigo: e.target.value })} placeholder="Ex: RC-001" /></div>
              <div><label className="text-xs text-muted-foreground">Nome do Produto</label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Medidas do Produto</label><Input value={editing.medidas} onChange={e => setEditing({ ...editing, medidas: e.target.value })} placeholder="Ex: ø102x3x500mm" /></div>
              <div><label className="text-xs text-muted-foreground">Descrição do Produto</label><Textarea value={editing.descricao} onChange={e => setEditing({ ...editing, descricao: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Valor do Produto (R$)</label><Input type="number" step="0.01" value={editing.valor} onChange={e => setEditing({ ...editing, valor: +e.target.value })} /></div>
            </div>
            <div className="flex justify-end mt-4"><Button onClick={handleSave}>Salvar</Button></div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Código</th>
              <th className="text-left p-3 font-medium">Nome</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Medidas</th>
              <th className="text-right p-3 font-medium">Valor</th>
              <th className="p-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {produtos.map(p => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 font-mono text-xs">{p.codigo}</td>
                <td className="p-3 font-medium">{p.nome}</td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">{p.medidas || '-'}</td>
                <td className="p-3 text-right font-mono">{fmt(p.valor)}</td>
                <td className="p-3 flex gap-1">
                  <button onClick={() => { setEditing(p); setOpen(true); }} className="text-primary hover:text-primary/80"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {produtos.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum produto cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
