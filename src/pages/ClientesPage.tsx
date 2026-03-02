import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import type { Cliente, Comprador } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';

const emptyComprador = (): Comprador => ({ nome: '', telefone: '', email: '', whatsapp: '', aniversario: '', redesSociais: '' });

const emptyCliente = (): Cliente => ({
  id: '', nome: '', cnpj: '', email: '', telefone: '', whatsapp: '', endereco: '', cidade: '', estado: '', contato: '',
  compradores: [emptyComprador()], aniversarioEmpresa: '', redesSociais: '',
  createdAt: new Date().toISOString().split('T')[0],
});

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente>(emptyCliente());
  const [viewCliente, setViewCliente] = useState<Cliente | null>(null);

  useEffect(() => { setClientes(store.getClientes()); }, []);

  const orcamentos = store.getOrcamentos();
  const pedidos = store.getPedidos();

  // Comprehensive search across all fields
  const filtered = clientes.filter(c => {
    const s = search.toLowerCase();
    if (!s) return true;
    const compradorMatch = (c.compradores || []).some(comp =>
      comp.nome?.toLowerCase().includes(s) ||
      comp.telefone?.includes(s) ||
      comp.email?.toLowerCase().includes(s) ||
      comp.whatsapp?.includes(s)
    );
    return (
      c.nome?.toLowerCase().includes(s) ||
      c.cnpj?.includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.telefone?.includes(s) ||
      c.whatsapp?.includes(s) ||
      c.endereco?.toLowerCase().includes(s) ||
      c.cidade?.toLowerCase().includes(s) ||
      c.estado?.toLowerCase().includes(s) ||
      compradorMatch
    );
  });

  const handleSave = () => {
    let updated: Cliente[];
    if (editing.id) { updated = clientes.map(c => c.id === editing.id ? editing : c); }
    else { updated = [...clientes, { ...editing, id: store.nextId('cli') }]; }
    store.saveClientes(updated); setClientes(updated); setOpen(false); toast.success('Cliente salvo!');
  };

  const handleDelete = (id: string) => {
    const updated = clientes.filter(c => c.id !== id);
    store.saveClientes(updated); setClientes(updated); toast.success('Cliente removido!');
  };

  const updateComprador = (idx: number, partial: Partial<Comprador>) => {
    const compradores = [...editing.compradores];
    compradores[idx] = { ...compradores[idx], ...partial };
    setEditing({ ...editing, compradores });
  };

  const addComprador = () => setEditing({ ...editing, compradores: [...editing.compradores, emptyComprador()] });
  const removeComprador = (idx: number) => { if (editing.compradores.length <= 1) return; setEditing({ ...editing, compradores: editing.compradores.filter((_, i) => i !== idx) }); };

  const getUltimoOrcamento = (clienteId: string) => {
    const orcs = orcamentos.filter(o => o.clienteId === clienteId);
    return orcs.length > 0 ? orcs[orcs.length - 1].dataOrcamento || orcs[orcs.length - 1].createdAt : '-';
  };
  const getUltimaCompra = (clienteNome: string) => {
    const peds = pedidos.filter(p => p.clienteNome === clienteNome && p.status === 'ENTREGUE');
    return peds.length > 0 ? peds[peds.length - 1].createdAt : '-';
  };
  const getAnivComprador = (c: Cliente) => {
    const comps = (c.compradores || []).filter(comp => comp.aniversario);
    if (comps.length === 0) return '-';
    return comps.map(comp => `${comp.nome}: ${comp.aniversario}`).join(', ');
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing.id ? 'Editar' : 'Novo'} Cliente</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-xs text-muted-foreground">Nome da Empresa</label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">CNPJ</label><Input value={editing.cnpj} onChange={e => setEditing({ ...editing, cnpj: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Telefone</label><Input value={editing.telefone} onChange={e => setEditing({ ...editing, telefone: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">WhatsApp</label><Input value={editing.whatsapp} onChange={e => setEditing({ ...editing, whatsapp: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Email</label><Input value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} /></div>
              <div className="col-span-2"><label className="text-xs text-muted-foreground">Endereço</label><Input value={editing.endereco} onChange={e => setEditing({ ...editing, endereco: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Cidade</label><Input value={editing.cidade} onChange={e => setEditing({ ...editing, cidade: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Estado</label><Input value={editing.estado} onChange={e => setEditing({ ...editing, estado: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Aniversário da Empresa</label><Input type="date" value={editing.aniversarioEmpresa || ''} onChange={e => setEditing({ ...editing, aniversarioEmpresa: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Redes Sociais da Empresa</label><Input value={editing.redesSociais || ''} onChange={e => setEditing({ ...editing, redesSociais: e.target.value })} placeholder="Instagram, LinkedIn..." /></div>
            </div>
            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Compradores</h3>
                <Button variant="outline" size="sm" onClick={addComprador} className="gap-1"><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
              </div>
              {editing.compradores.map((comp, idx) => (
                <div key={idx} className="border rounded-lg p-3 mb-2 bg-muted/20">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Comprador {idx + 1}</span>
                    {editing.compradores.length > 1 && <button onClick={() => removeComprador(idx)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-xs text-muted-foreground">Nome</label><Input value={comp.nome} onChange={e => updateComprador(idx, { nome: e.target.value })} /></div>
                    <div><label className="text-xs text-muted-foreground">Telefone</label><Input value={comp.telefone} onChange={e => updateComprador(idx, { telefone: e.target.value })} /></div>
                    <div><label className="text-xs text-muted-foreground">Email</label><Input value={comp.email} onChange={e => updateComprador(idx, { email: e.target.value })} /></div>
                    <div><label className="text-xs text-muted-foreground">WhatsApp</label><Input value={comp.whatsapp} onChange={e => updateComprador(idx, { whatsapp: e.target.value })} /></div>
                    <div><label className="text-xs text-muted-foreground">Aniversário</label><Input type="date" value={comp.aniversario || ''} onChange={e => updateComprador(idx, { aniversario: e.target.value })} /></div>
                    <div><label className="text-xs text-muted-foreground">Redes Sociais</label><Input value={comp.redesSociais || ''} onChange={e => updateComprador(idx, { redesSociais: e.target.value })} placeholder="Instagram..." /></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4"><Button onClick={handleSave}>Salvar</Button></div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por empresa, comprador, CNPJ, endereço, telefone, email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Dialog open={!!viewCliente} onOpenChange={() => setViewCliente(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{viewCliente?.nome}</DialogTitle></DialogHeader>
          {viewCliente && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">CNPJ:</span> <strong>{viewCliente.cnpj}</strong></div>
                <div><span className="text-muted-foreground">Cidade:</span> <strong>{viewCliente.cidade}/{viewCliente.estado}</strong></div>
                <div><span className="text-muted-foreground">Telefone:</span> <strong>{viewCliente.telefone}</strong></div>
                <div><span className="text-muted-foreground">WhatsApp:</span> <strong>{viewCliente.whatsapp}</strong></div>
                <div><span className="text-muted-foreground">Email:</span> <strong>{viewCliente.email}</strong></div>
                <div><span className="text-muted-foreground">Aniv. Empresa:</span> <strong>{viewCliente.aniversarioEmpresa || '-'}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Endereço:</span> <strong>{viewCliente.endereco}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Redes Sociais (Empresa):</span> <strong>{viewCliente.redesSociais || '-'}</strong></div>
              </div>
              <div className="border-t pt-3">
                <h4 className="font-semibold text-xs mb-2">Compradores</h4>
                {(viewCliente.compradores || []).map((c, i) => (
                  <div key={i} className="bg-muted/20 rounded p-2 mb-1 text-xs">
                    <strong>{c.nome}</strong> • {c.telefone} • {c.email}
                    {c.whatsapp && ` • WhatsApp: ${c.whatsapp}`}
                    {c.aniversario && ` • Aniv: ${c.aniversario}`}
                    {c.redesSociais && ` • Redes: ${c.redesSociais}`}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Empresa</th>
              <th className="text-left p-3 font-medium">CNPJ</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Cidade</th>
              <th className="text-left p-3 font-medium hidden lg:table-cell">Telefone</th>
              <th className="text-left p-3 font-medium hidden lg:table-cell">Aniv. Empresa</th>
              <th className="text-left p-3 font-medium hidden xl:table-cell">Redes (Empresa)</th>
              <th className="text-left p-3 font-medium hidden xl:table-cell">Aniv. Comprador</th>
              <th className="text-left p-3 font-medium hidden 2xl:table-cell">Último Orçamento</th>
              <th className="text-left p-3 font-medium hidden 2xl:table-cell">Última Compra</th>
              <th className="p-3 w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 font-medium">{c.nome}</td>
                <td className="p-3 font-mono text-xs">{c.cnpj}</td>
                <td className="p-3 hidden md:table-cell">{c.cidade}/{c.estado}</td>
                <td className="p-3 hidden lg:table-cell text-xs">{c.telefone}</td>
                <td className="p-3 hidden lg:table-cell text-xs">{c.aniversarioEmpresa || '-'}</td>
                <td className="p-3 hidden xl:table-cell text-xs truncate max-w-[100px]">{c.redesSociais || '-'}</td>
                <td className="p-3 hidden xl:table-cell text-xs truncate max-w-[150px]" title={getAnivComprador(c)}>{getAnivComprador(c)}</td>
                <td className="p-3 hidden 2xl:table-cell text-muted-foreground text-xs">{getUltimoOrcamento(c.id)}</td>
                <td className="p-3 hidden 2xl:table-cell text-muted-foreground text-xs">{getUltimaCompra(c.nome)}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button onClick={() => setViewCliente(c)} className="p-1 rounded hover:bg-muted" title="Ver"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => { setEditing({ ...c, compradores: c.compradores?.length ? c.compradores : [emptyComprador()] }); setOpen(true); }} className="p-1 rounded hover:bg-muted text-primary" title="Editar"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(c.id)} className="p-1 rounded hover:bg-muted text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Nenhum cliente encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
