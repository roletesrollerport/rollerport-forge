import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import type { Cliente } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const emptyCliente = (): Cliente => ({
  id: '', nome: '', cnpj: '', email: '', telefone: '', endereco: '', cidade: '', estado: '', contato: '', createdAt: new Date().toISOString().split('T')[0],
});

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente>(emptyCliente());

  useEffect(() => { setClientes(store.getClientes()); }, []);

  const filtered = clientes.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.cnpj.includes(search)
  );

  const handleSave = () => {
    let updated: Cliente[];
    if (editing.id) {
      updated = clientes.map(c => c.id === editing.id ? editing : c);
    } else {
      const novo = { ...editing, id: store.nextId('cli') };
      updated = [...clientes, novo];
    }
    store.saveClientes(updated);
    setClientes(updated);
    setOpen(false);
    toast.success('Cliente salvo!');
  };

  const handleDelete = (id: string) => {
    const updated = clientes.filter(c => c.id !== id);
    store.saveClientes(updated);
    setClientes(updated);
    toast.success('Cliente removido!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-header">Clientes</h1>
          <p className="page-subtitle">Cadastro de clientes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(emptyCliente())} className="gap-2"><Plus className="h-4 w-4" /> Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing.id ? 'Editar' : 'Novo'} Cliente</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-xs text-muted-foreground">Nome</label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">CNPJ</label><Input value={editing.cnpj} onChange={e => setEditing({ ...editing, cnpj: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Telefone</label><Input value={editing.telefone} onChange={e => setEditing({ ...editing, telefone: e.target.value })} /></div>
              <div className="col-span-2"><label className="text-xs text-muted-foreground">Email</label><Input value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} /></div>
              <div className="col-span-2"><label className="text-xs text-muted-foreground">Endereço</label><Input value={editing.endereco} onChange={e => setEditing({ ...editing, endereco: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Cidade</label><Input value={editing.cidade} onChange={e => setEditing({ ...editing, cidade: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Estado</label><Input value={editing.estado} onChange={e => setEditing({ ...editing, estado: e.target.value })} /></div>
              <div className="col-span-2"><label className="text-xs text-muted-foreground">Contato</label><Input value={editing.contato} onChange={e => setEditing({ ...editing, contato: e.target.value })} /></div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={handleSave}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Nome</th>
              <th className="text-left p-3 font-medium">CNPJ</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Cidade/UF</th>
              <th className="text-left p-3 font-medium hidden lg:table-cell">Contato</th>
              <th className="p-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 font-medium">{c.nome}</td>
                <td className="p-3 font-mono text-xs">{c.cnpj}</td>
                <td className="p-3 hidden md:table-cell">{c.cidade}/{c.estado}</td>
                <td className="p-3 hidden lg:table-cell">{c.contato}</td>
                <td className="p-3 flex gap-1">
                  <button onClick={() => { setEditing(c); setOpen(true); }} className="text-primary hover:text-primary/80"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(c.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum cliente encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
