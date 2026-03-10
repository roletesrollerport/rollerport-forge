import { useState } from 'react';
import { useUsuarios, type UsuarioDB } from '@/hooks/useUsuarios';
import type { NivelAcesso, Genero, PermissaoModulo } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, ImagePlus, User, Eye, EyeOff, Edit, Phone, Mail, Loader2, Lock, LogOut, ShieldAlert, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

const niveis: { value: NivelAcesso; label: string }[] = [
  { value: 'master', label: 'Master' },
  { value: 'admin', label: 'Admin/Dono' },
  { value: 'SEO', label: 'SEO' },
  { value: 'Administrador', label: 'Administrador' },
  { value: 'Vendas', label: 'Vendas' },
  { value: 'Estoque', label: 'Estoque' },
  { value: 'Produção', label: 'Produção' },
];

const TODOS_MODULOS: { value: PermissaoModulo; label: string }[] = [
  { value: 'inicio', label: 'Início' },
  { value: 'custos', label: 'Custos' },
  { value: 'clientes', label: 'Clientes' },
  { value: 'produtos', label: 'Produtos' },
  { value: 'orcamentos', label: 'Orçamentos' },
  { value: 'pedidos', label: 'Pedidos' },
  { value: 'producao', label: 'Produção' },
  { value: 'estoque', label: 'Estoque' },
  { value: 'chat', label: 'Bate-Papo' },
  { value: 'ia', label: 'IA' },
  { value: 'usuarios', label: 'Usuários' },
];

const ALL_MODULOS = TODOS_MODULOS.map(m => m.value);

const emptyEditing = () => ({
  id: '' as string | undefined,
  nome: '', email: '', telefone: '', whatsapp: '', login: '', senha: '',
  nivel: 'Vendas' as NivelAcesso, ativo: true, foto: undefined as string | undefined,
  genero: undefined as Genero | undefined,
  permissoes: { ver: [...ALL_MODULOS], editar: [...ALL_MODULOS] },
});

type EditingState = ReturnType<typeof emptyEditing>;

export default function UsuariosPage() {
  const { 
    usuarios, loading, saveUsuario, deleteUsuario, getUserCredentials, 
    generateTempPassword, logoutUser, logoutAllCommonUsers 
  } = useUsuarios();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditingState>(emptyEditing());
  const [openingEdit, setOpeningEdit] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewingPass, setViewingPass] = useState<{ id: string, pass: string, isPlain: boolean } | null>(null);
  const [cardPassVisible, setCardPassVisible] = useState<Record<string, string | null>>({});

  const handleViewPass = async (userId: string) => {
    try {
      const data = await getUserCredentials(userId);
      setViewingPass({ id: userId, pass: data.password, isPlain: data.isPlain });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao buscar senha');
    }
  };

  const handleGenTempPass = async (userId: string) => {
    if (!confirm('Deseja gerar uma nova senha temporária para este usuário? A senha atual será invalidada.')) return;
    try {
      const data = await generateTempPassword(userId);
      toast.success(`Nova senha gerada com sucesso!`);
      setViewingPass({ id: userId, pass: data.tempPassword, isPlain: true });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar senha');
    }
  };

  const handleLogoutUser = async (userId: string) => {
    if (!confirm('Deseja deslogar este usuário remotamente?')) return;
    try {
      await logoutUser(userId);
      toast.success('Solicitação de logout enviada!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao deslogar usuário');
    }
  };

  const handleLogoutAll = async () => {
    if (!confirm('Deseja deslogar TODOS os usuários comuns do sistema?')) return;
    try {
      await logoutAllCommonUsers();
      toast.success('Todos os usuários comuns foram deslogados!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao deslogar todos');
    }
  };

  const handleToggleActive = async (u: UsuarioDB) => {
    const novoStatus = !u.ativo;
    if (!confirm(`Deseja ${novoStatus ? 'ativar' : 'bloquear'} o usuário ${u.nome}?`)) return;
    try {
      await saveUsuario({ ...u, ativo: novoStatus });
      toast.success(`Usuário ${novoStatus ? 'ativado' : 'bloqueado'}!`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao alterar status');
    }
  };

  const loggedUserId = localStorage.getItem('rp_logged_user');
  const loggedUser = usuarios.find(u => u.id === loggedUserId);
  const isMaster = loggedUser?.nivel === 'master';

  const handleSave = async () => {
    if (!editing.login || (!editing.id && !editing.senha)) { toast.error('Login e senha são obrigatórios!'); return; }
    const perms = editing.nivel === 'master'
      ? { ver: [...ALL_MODULOS], editar: [...ALL_MODULOS] }
      : editing.permissoes;

    setSaving(true);
    try {
      let fotoUrl = editing.foto;

      // If foto is base64, upload to storage first
      if (fotoUrl && fotoUrl.startsWith('data:image')) {
        const sessionToken = localStorage.getItem('rp_session_token');
        const matches = fotoUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && sessionToken) {
          const { data, error } = await supabase.functions.invoke('avatar-api', {
            body: {
              action: 'upload_avatar',
              sessionToken,
              userId: editing.id || crypto.randomUUID(),
              file_base64: matches[2],
              content_type: matches[1],
            },
          });
          if (!error && data?.url) {
            fotoUrl = data.url;
          }
        }
      }

      await saveUsuario({
        id: editing.id || undefined,
        nome: editing.nome,
        email: editing.email,
        telefone: editing.telefone,
        whatsapp: editing.whatsapp,
        login: editing.login,
        senha: editing.senha,
        nivel: editing.nivel,
        genero: editing.genero,
        ativo: editing.ativo,
        foto: fotoUrl,
        permissoes: perms,
      });
      setOpen(false);
      toast.success('Usuário salvo!');
    } catch {
      toast.error('Erro ao salvar!');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    const u = usuarios.find(x => x.id === id);
    if (u?.nivel === 'master') { toast.error('Não é possível excluir o usuário Master!'); return; }
    await deleteUsuario(id);
    toast.success('Usuário removido!');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditing({ ...editing, foto: reader.result as string });
    reader.readAsDataURL(file);
  };

  const togglePerm = (tipo: 'ver' | 'editar', modulo: PermissaoModulo) => {
    const perms = editing.permissoes || { ver: [...ALL_MODULOS], editar: [...ALL_MODULOS] };
    const list = perms[tipo];
    const newList = list.includes(modulo) ? list.filter(m => m !== modulo) : [...list, modulo];
    if (tipo === 'ver' && !newList.includes(modulo)) {
      const newEditar = perms.editar.filter(m => m !== modulo);
      setEditing({ ...editing, permissoes: { ver: newList, editar: newEditar } });
    } else if (tipo === 'editar' && newList.includes(modulo) && !perms.ver.includes(modulo)) {
      setEditing({ ...editing, permissoes: { ver: [...perms.ver, modulo], editar: newList } });
    } else {
      setEditing({ ...editing, permissoes: { ...perms, [tipo]: newList } });
    }
  };

  const openEdit = async (u: UsuarioDB) => {
    setOpeningEdit(true);
    let currentPass = '';
    try {
      if (isMaster && u.nivel !== 'master') {
        const data = await getUserCredentials(u.id);
        currentPass = data.isPlain ? data.password : '';
      }
    } catch (e) {
      console.error(e);
    }

    setEditing({
      id: u.id,
      nome: u.nome,
      email: u.email,
      telefone: u.telefone,
      whatsapp: u.whatsapp,
      login: u.login,
      senha: currentPass,
      nivel: u.nivel,
      ativo: u.ativo,
      foto: u.foto,
      genero: u.genero,
      permissoes: u.permissoes || { ver: [...ALL_MODULOS], editar: [...ALL_MODULOS] },
    });
    setOpeningEdit(false);
    setOpen(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-header">Usuários</h1>
          <p className="page-subtitle">Gerenciamento de acesso e login</p>
        </div>
        {isMaster && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleLogoutAll} className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50">
              <LogOut className="h-4 w-4" /> Deslogar Todos
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditing(emptyEditing())} className="gap-2"><Plus className="h-4 w-4" /> Novo Usuário</Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                      <label className="text-xs text-muted-foreground">
                        {editing.nivel === 'master' ? 'Senha' : 'Senha (até 8 números)'}
                      </label>
                      <div className="relative">
                        <Input 
                          type={showSenha ? 'text' : 'password'} 
                          value={editing.senha} 
                          onChange={e => {
                            if (editing.nivel === 'master') {
                              setEditing({ ...editing, senha: e.target.value });
                            } else {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                              setEditing({ ...editing, senha: val });
                            }
                          }} 
                          placeholder={editing.id ? 'Digite p/ alterar' : (editing.nivel === 'master' ? 'Senha' : 'Senha numérica')}
                          maxLength={editing.nivel === 'master' ? undefined : 8}
                          inputMode={editing.nivel === 'master' ? undefined : "numeric"}
                          pattern={editing.nivel === 'master' ? undefined : "[0-9]*"}
                        />
                        <button type="button" onClick={() => setShowSenha(!showSenha)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Setor</label>
                    <select value={editing.nivel} onChange={e => setEditing({ ...editing, nivel: e.target.value as NivelAcesso })} className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm">
                      {niveis.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Gênero</label>
                    <select value={editing.genero || ''} onChange={e => setEditing({ ...editing, genero: e.target.value as Genero })} className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm">
                      <option value="">Selecione...</option>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={editing.ativo} onChange={e => setEditing({ ...editing, ativo: e.target.checked })} className="h-4 w-4 rounded" />
                  <label className="text-sm">Ativo</label>
                </div>

                {editing.nivel !== 'master' && (
                  <div className="border-t pt-3 mt-2">
                    <p className="text-xs font-semibold text-primary mb-3">Permissões de Acesso</p>
                    <div className="grid grid-cols-1 gap-1">
                      <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold text-muted-foreground uppercase mb-1 px-1">
                        <span>Módulo</span>
                        <span className="text-center">Visualizar</span>
                        <span className="text-center">Editar</span>
                      </div>
                      {TODOS_MODULOS.filter(m => m.value !== 'usuarios').map(mod => {
                        const perms = editing.permissoes || { ver: [...ALL_MODULOS], editar: [...ALL_MODULOS] };
                        return (
                          <div key={mod.value} className="grid grid-cols-3 gap-2 items-center py-1.5 px-1 rounded hover:bg-muted/30">
                            <span className="text-xs font-medium">{mod.label}</span>
                            <div className="flex justify-center">
                              <Checkbox checked={perms.ver.includes(mod.value)} onCheckedChange={() => togglePerm('ver', mod.value)} />
                            </div>
                            <div className="flex justify-center">
                              <Checkbox checked={perms.editar.includes(mod.value)} onCheckedChange={() => togglePerm('editar', mod.value)} disabled={!perms.ver.includes(mod.value)} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar
                </Button>
              </div>
            </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...usuarios].sort((a, b) => (a.nivel === 'master' ? -1 : b.nivel === 'master' ? 1 : 0)).map(u => (
          <div key={u.id} className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3 mb-3">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-primary/20">
                {u.foto ? (
                  <img src={u.foto} alt={u.nome} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-7 w-7 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm truncate">{u.nome || 'Sem nome'}</h3>
                <p className="text-xs text-muted-foreground font-mono">{u.login}</p>
                {isMaster && (
                  <div className="flex items-center gap-1">
                    <p className="text-[10px] text-muted-foreground/60 font-mono">
                      Senha: {cardPassVisible[u.id] ? cardPassVisible[u.id] : '•'.repeat(u.senha?.length || 8)}
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        if (cardPassVisible[u.id]) {
                          setCardPassVisible(prev => ({ ...prev, [u.id]: null }));
                        } else {
                          try {
                            const data = await getUserCredentials(u.id);
                            setCardPassVisible(prev => ({ ...prev, [u.id]: data.password }));
                          } catch {
                            toast.error('Erro ao buscar senha');
                          }
                        }
                      }}
                      className="text-muted-foreground/60 hover:text-muted-foreground"
                    >
                      {cardPassVisible[u.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary capitalize">{u.nivel}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.ativo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span>
                </div>
              </div>
            </div>

            {viewingPass?.id === u.id && (
              <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-[10px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-800 dark:text-amber-400">Credenciais:</span>
                  <button onClick={() => setViewingPass(null)} className="text-amber-800 dark:text-amber-400 hover:underline">Fechar</button>
                </div>
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono bg-white dark:bg-black/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 text-xs">
                      {viewingPass.pass}
                    </span>
                    {viewingPass.isPlain && <span className="text-green-600 font-medium whitespace-nowrap">Senha Original</span>}
                  </div>
                  {!viewingPass.isPlain && (
                     <p className="text-muted-foreground/80 italic text-[9px] leading-tight">
                       Por segurança, esta senha foi <b>criptografada (hashed)</b> e é irreversível.
                       <br />Não é possível ver o texto original. Use "Gerar Senha Temporária" se precisar recuperar o acesso.
                     </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{u.email || '-'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{u.telefone || '-'}</span>
              </div>
              {u.whatsapp && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">WhatsApp: {u.whatsapp}</span>
                </div>
              )}
            </div>

            {isMaster && (
              <div className="mt-4 pt-3 border-t flex gap-1 justify-start flex-wrap">
                <button onClick={() => openEdit(u)} disabled={openingEdit} className="p-1.5 rounded bg-muted/50 hover:bg-muted text-primary disabled:opacity-50" title="Editar"><Edit className="h-4 w-4" /></button>
                {u.nivel !== 'master' && (
                  <>
                    <button onClick={() => handleViewPass(u.id)} className="p-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:hover:bg-amber-900/40" title="Ver Senha"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => handleGenTempPass(u.id)} className="p-1.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:hover:bg-blue-900/40" title="Gerar Senha Temporária"><Lock className="h-4 w-4" /></button>
                    <button onClick={() => handleToggleActive(u)} className={`p-1.5 rounded ${u.ativo ? 'bg-orange-50 hover:bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:hover:bg-orange-900/40' : 'bg-green-50 hover:bg-green-100 text-green-600 dark:bg-green-900/20 dark:hover:bg-green-900/40'}`} title={u.ativo ? 'Bloquear' : 'Ativar'}>
                      {u.ativo ? <ShieldAlert className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </button>
                    <button onClick={() => handleLogoutUser(u.id)} className="p-1.5 rounded bg-red-50 hover:bg-red-100 text-red-500 dark:bg-red-900/20 dark:hover:bg-red-900/40" title="Forçar Logout"><LogOut className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {usuarios.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">Nenhum usuário cadastrado.</div>
        )}
      </div>
    </div>
  );
}
