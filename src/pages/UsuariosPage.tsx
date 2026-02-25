import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import type { Usuario, NivelAcesso } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const niveis: { value: NivelAcesso; label: string }[] = [
  { value: 'master', label: 'Master' },
  { value: 'admin', label: 'Administrador' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'producao', label: 'Produção' },
  { value: 'estoque', label: 'Estoque' },
];

const emptyUsuario = (): Usuario => ({
  id: '', nome: '', email: '', nivel: 'vendedor', ativo: true,
  createdAt: new Date().toISOString().split('T')[0],
});

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario>(emptyUsuario());

  useEffect(() => { setUsuarios(store.getUsuarios()); }, []);

  const handleSave = () => {
    let updated: Usuario[];
    if (editing.id) {
      updated = usuarios.map(u => u.id === editing.id ? editing : u);
    } else {
      updated = [...usuarios, { ...editing, id: store.nextId('usr') }];
    }
    store.saveUsuarios(updated);
    setUsuarios(updated);
    setOpen(false);
    toast.success('Usuário salvo!');
  };

  const handleDelete = (id: string) => {
    const updated = usuarios.filter(u => u.id !== id);
    store.saveUsuarios(updated);
    setUsuarios(updated);
    toast.success('Usuário removido!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-header">Usuários</h1>
          <p className="page-subtitle">Gerenciamento de acesso</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(emptyUsuario())} className="gap-2"><Plus className="h-4 w-4" /> Novo Usuário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing.id ? 'Editar' : 'Novo'} Usuário</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground">Nome</label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Email</label><Input type="email" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} /></div>
              <div>
                <label className="text-xs text-muted-foreground">Nível de Acesso</label>
                <select value={editing.nivel} onChange={e => setEditing({ ...editing, nivel: e.target.value as NivelAcesso })} className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm">
                  {niveis.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editing.ativo} onChange={e => setEditing({ ...editing, ativo: e.target.checked })} className="h-4 w-4 rounded" />
                <label className="text-sm">Ativo</label>
              </div>
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
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-left p-3 font-medium">Nível</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="p-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 font-medium">{u.nome}</td>
                <td className="p-3 text-muted-foreground">{u.email}</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary capitalize">{u.nivel}</span></td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${u.ativo ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td className="p-3 flex gap-1">
                  <button onClick={() => { setEditing(u); setOpen(true); }} className="text-primary hover:text-primary/80">✏️</button>
                  <button onClick={() => handleDelete(u.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
