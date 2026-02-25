import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import type { Produto, TipoRolete } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const tipos: { value: TipoRolete | 'GENERICO'; label: string }[] = [
  { value: 'RC', label: 'RC - Rolete de Carga' },
  { value: 'RR', label: 'RR - Rolete de Retorno' },
  { value: 'RG', label: 'RG - Rolete Guia' },
  { value: 'RI', label: 'RI - Rolete de Impacto' },
  { value: 'RRA', label: 'RRA - Rolete de Retorno Auto-limpante' },
  { value: 'GENERICO', label: 'Genérico' },
];

const emptyProduto = (): Produto => ({
  id: '', nome: '', tipo: 'RC', descricao: '',
  createdAt: new Date().toISOString().split('T')[0],
});

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Produto>(emptyProduto());

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('rp_produtos') || '[]');
    setProdutos(saved);
  }, []);

  const handleSave = () => {
    let updated: Produto[];
    if (editing.id) {
      updated = produtos.map(p => p.id === editing.id ? editing : p);
    } else {
      updated = [...produtos, { ...editing, id: store.nextId('prod') }];
    }
    localStorage.setItem('rp_produtos', JSON.stringify(updated));
    setProdutos(updated);
    setOpen(false);
    toast.success('Produto salvo!');
  };

  const handleDelete = (id: string) => {
    const updated = produtos.filter(p => p.id !== id);
    localStorage.setItem('rp_produtos', JSON.stringify(updated));
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
              <div><label className="text-xs text-muted-foreground">Nome</label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div>
                <label className="text-xs text-muted-foreground">Tipo</label>
                <select value={editing.tipo} onChange={e => setEditing({ ...editing, tipo: e.target.value as any })} className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm">
                  {tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground">Descrição</label><Input value={editing.descricao} onChange={e => setEditing({ ...editing, descricao: e.target.value })} /></div>
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
              <th className="text-left p-3 font-medium">Tipo</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Descrição</th>
              <th className="p-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {produtos.map(p => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 font-medium">{p.nome}</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">{p.tipo}</span></td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">{p.descricao || '-'}</td>
                <td className="p-3 flex gap-1">
                  <button onClick={() => { setEditing(p); setOpen(true); }} className="text-primary hover:text-primary/80">✏️</button>
                  <button onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {produtos.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum produto cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
