import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import type { Usuario, NivelAcesso } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, ImagePlus, User, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const niveis: { value: NivelAcesso; label: string }[] = [
  { value: 'master', label: 'Master' },
  { value: 'admin', label: 'Administrador' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'producao', label: 'Produção' },
  { value: 'estoque', label: 'Estoque' },
];

const emptyUsuario = (): Usuario => ({
  id: '', nome: '', email: '', telefone: '', whatsapp: '', login: '', senha: '', nivel: 'vendedor', ativo: true,
  createdAt: new Date().toISOString().split('T')[0],
});

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario>(emptyUsuario());
  const [showSenha, setShowSenha] = useState(false);

  useEffect(() => { setUsuarios(store.getUsuarios()); }, []);

  const handleSave = () => {
    if (!editing.login || !editing.senha) { toast.error('Login e senha são obrigatórios!'); return; }
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditing({ ...editing, foto: reader.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-header">Usuários</h1>
          <p className="page-subtitle">Gerenciamento de acesso e login</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(emptyUsuario())} className="gap-2"><Plus className="h-4 w-4" /> Novo Usuário</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing.id ? 'Editar' : 'Novo'} Usuário</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {/* Photo */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/30">
                  {editing.foto ? (
                    <img src={editing.foto} alt="Foto" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <label className="cursor-pointer flex items-center gap-2 text-sm text-primary hover:text-primary/80">
                    <ImagePlus className="h-4 w-4" /> Escolher Foto
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                  {editing.foto && (
                    <button onClick={() => setEditing({ ...editing, foto: undefined })} className="text-xs text-destructive mt-1">Remover foto</button>
                  )}
                </div>
              </div>

              <div><label className="text-xs text-muted-foreground">Nome</label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Email</label><Input type="email" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">Telefone</label><Input value={editing.telefone || ''} onChange={e => setEditing({ ...editing, telefone: e.target.value })} placeholder="(11) 4441-3572" /></div>
                <div><label className="text-xs text-muted-foreground">WhatsApp</label><Input value={editing.whatsapp || ''} onChange={e => setEditing({ ...editing, whatsapp: e.target.value })} placeholder="(11) 94441-3572" /></div>
              </div>

              <div className="border-t pt-3 mt-2">
                <p className="text-xs font-semibold text-primary mb-2">Dados de Acesso</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-muted-foreground">Login</label><Input value={editing.login} onChange={e => setEditing({ ...editing, login: e.target.value })} placeholder="Nome, email ou número" /></div>
                  <div>
                    <label className="text-xs text-muted-foreground">Senha</label>
                    <div className="relative">
                      <Input type={showSenha ? 'text' : 'password'} value={editing.senha} onChange={e => setEditing({ ...editing, senha: e.target.value })} placeholder="Senha" />
                      <button type="button" onClick={() => setShowSenha(!showSenha)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

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
              <th className="p-3 w-12"></th>
              <th className="text-left p-3 font-medium">Nome</th>
              <th className="text-left p-3 font-medium">Login</th>
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-left p-3 font-medium">Telefone</th>
              <th className="text-left p-3 font-medium">Nível</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="p-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {u.foto ? (
                      <img src={u.foto} alt={u.nome} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </td>
                <td className="p-3 font-medium">{u.nome}</td>
                <td className="p-3 text-muted-foreground">{u.login}</td>
                <td className="p-3 text-muted-foreground">{u.email}</td>
                <td className="p-3 text-muted-foreground">{u.telefone || '-'}</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary capitalize">{u.nivel}</span></td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
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
