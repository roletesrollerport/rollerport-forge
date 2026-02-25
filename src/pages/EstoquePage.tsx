import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import type { ItemEstoque } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, AlertTriangle, Eye, Edit } from 'lucide-react';
import { toast } from 'sonner';

const emptyItem = (): ItemEstoque => ({
  id: '', nome: '', categoria: '', quantidade: 0, unidade: 'un', nivelCritico: 5,
  createdAt: new Date().toISOString().split('T')[0],
});

function buildDefaultEstoque(): ItemEstoque[] {
  const items: ItemEstoque[] = [];
  let idx = 1;
  const add = (nome: string, categoria: string, unidade = 'metro') => {
    items.push({ id: String(idx++), nome, categoria, quantidade: 100, unidade, nivelCritico: 10, createdAt: new Date().toISOString().split('T')[0] });
  };
  store.getTubos().forEach(t => add(`Tubo ø${t.diametro} parede ${t.parede}`, 'Tubos'));
  store.getEixos().forEach(e => add(`Eixo ø${e.diametro}`, 'Eixos'));
  store.getConjuntos().forEach(c => add(`Conjunto ${c.codigo}`, 'Conjuntos', 'un'));
  store.getRevestimentos().forEach(r => add(`Revestimento ${r.tipo}`, 'Revestimentos'));
  store.getEncaixes().forEach(e => add(`Encaixe ${e.tipo}`, 'Encaixes', 'un'));
  return items;
}

export default function EstoquePage() {
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ItemEstoque>(emptyItem());
  const [viewItem, setViewItem] = useState<ItemEstoque | null>(null);

  useEffect(() => {
    let data = store.getEstoque();
    if (data.length === 0) {
      data = buildDefaultEstoque();
      store.saveEstoque(data);
    }
    setItens(data);
  }, []);

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

      {/* View item dialog */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes do Item</DialogTitle></DialogHeader>
          {viewItem && (
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Nome:</span> <strong>{viewItem.nome}</strong></div>
              <div><span className="text-muted-foreground">Categoria:</span> <strong>{viewItem.categoria}</strong></div>
              <div><span className="text-muted-foreground">Quantidade:</span> <strong>{viewItem.quantidade} {viewItem.unidade}</strong></div>
              <div><span className="text-muted-foreground">Nível Crítico:</span> <strong>{viewItem.nivelCritico}</strong></div>
              <div><span className="text-muted-foreground">Cadastrado em:</span> <strong>{viewItem.createdAt}</strong></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Nome</th>
              <th className="text-left p-3 font-medium">Categoria</th>
              <th className="text-right p-3 font-medium">Quantidade</th>
              <th className="text-left p-3 font-medium">Unidade</th>
              <th className="text-right p-3 font-medium">Nível Crítico</th>
              <th className="p-3 w-28"></th>
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
                <td className="p-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => setViewItem(item)} className="p-1.5 rounded hover:bg-muted" title="Ver"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => { setEditing(item); setOpen(true); }} className="p-1.5 rounded hover:bg-muted" title="Editar"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-muted text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                  </div>
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
