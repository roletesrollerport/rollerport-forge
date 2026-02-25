import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import type { ItemEstoque } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const emptyItem = (): ItemEstoque => ({
  id: '', nome: '', categoria: '', quantidade: 0, unidade: 'un', nivelCritico: 5,
  createdAt: new Date().toISOString().split('T')[0],
});

export default function EstoquePage() {
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ItemEstoque>(emptyItem());

  useEffect(() => { setItens(store.getEstoque()); }, []);

  const handleSave = () => {
    let updated: ItemEstoque[];
    if (editing.id) {
      updated = itens.map(i => i.id === editing.id ? editing : i);
    } else {
      updated = [...itens, { ...editing, id: store.nextId('est') }];
    }
    store.saveEstoque(updated);
    setItens(updated);
    setOpen(false);
    toast.success('Item salvo!');
  };

  const handleDelete = (id: string) => {
    const updated = itens.filter(i => i.id !== id);
    store.saveEstoque(updated);
    setItens(updated);
    toast.success('Item removido!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-header">Estoque</h1>
          <p className="page-subtitle">Controle de matéria-prima</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(emptyItem())} className="gap-2"><Plus className="h-4 w-4" /> Novo Item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing.id ? 'Editar' : 'Novo'} Item</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-xs text-muted-foreground">Nome</label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Categoria</label><Input value={editing.categoria} onChange={e => setEditing({ ...editing, categoria: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Unidade</label><Input value={editing.unidade} onChange={e => setEditing({ ...editing, unidade: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Quantidade</label><Input type="number" value={editing.quantidade} onChange={e => setEditing({ ...editing, quantidade: +e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Nível Crítico</label><Input type="number" value={editing.nivelCritico} onChange={e => setEditing({ ...editing, nivelCritico: +e.target.value })} /></div>
            </div>
            <div className="flex justify-end mt-4"><Button onClick={handleSave}>Salvar</Button></div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Nome</th>
              <th className="text-left p-3 font-medium">Categoria</th>
              <th className="text-right p-3 font-medium">Quantidade</th>
              <th className="text-left p-3 font-medium">Unidade</th>
              <th className="text-right p-3 font-medium">Nível Crítico</th>
              <th className="p-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {itens.map(item => (
              <tr key={item.id} className={`border-b last:border-0 hover:bg-muted/30 ${item.quantidade <= item.nivelCritico ? 'bg-destructive/5' : ''}`}>
                <td className="p-3 font-medium flex items-center gap-2">
                  {item.quantidade <= item.nivelCritico && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  {item.nome}
                </td>
                <td className="p-3">{item.categoria}</td>
                <td className="p-3 text-right font-mono">{item.quantidade}</td>
                <td className="p-3">{item.unidade}</td>
                <td className="p-3 text-right font-mono">{item.nivelCritico}</td>
                <td className="p-3 flex gap-1">
                  <button onClick={() => { setEditing(item); setOpen(true); }} className="text-primary hover:text-primary/80">✏️</button>
                  <button onClick={() => handleDelete(item.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {itens.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum item no estoque.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
