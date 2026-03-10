import { useState, useEffect, useRef } from 'react';
import { store } from '@/lib/store';
import type { Cliente, Comprador, RegimeTributario } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, Eye, Phone, Mail, Building2, Cake, Calendar, Users, Store, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useUsuarios } from '@/hooks/useUsuarios';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatCPForCNPJ, formatTelefone } from '@/lib/formatters';
import { fetchCNPJ } from '@/lib/utils';

const emptyComprador = (): Comprador => ({ nome: '', telefone: '', email: '', whatsapp: '', aniversario: '', redesSociais: '' });

const emptyCliente = (): Cliente => ({
  id: '', nome: '', cnpj: '', inscricaoEstadual: '', inscricaoMunicipal: '', email: '', telefone: '', whatsapp: '', endereco: '', bairro: '', cidade: '', estado: '', cep: '', contato: '',
  compradores: [emptyComprador()], aniversarioEmpresa: '', redesSociais: '',
  regimeTributario: 'Lucro Presumido',
  createdAt: new Date().toISOString().split('T')[0],
});

type Categoria = 'clientes' | 'revenda';

export default function ClientesPage() {
  const [categoria, setCategoria] = useState<Categoria>('clientes');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [revendas, setRevendas] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente>(emptyCliente());
  const [viewCliente, setViewCliente] = useState<Cliente | null>(null);
  const [confirmDeleteClient, setConfirmDeleteClient] = useState<string | null>(null);

  const { usuarios: dbUsuarios } = useUsuarios();
  const loggedUserId = localStorage.getItem('rp_logged_user');
  const currentUser = dbUsuarios.find(u => u.id === loggedUserId) || null;
  const currentUserName = currentUser?.nome || 'Sistema';
  const isMaster = currentUser?.nivel === 'master';
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---- Import CSV/Excel handler ---- */
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast.error('Arquivo vazio ou sem dados.'); return; }
      // Detect separator (tab for Excel export, comma, or semicolon)
      const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const existing = isRevenda ? revendas : clientes;
      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
        const get = (name: string) => {
          const idx = headers.indexOf(name);
          return idx >= 0 ? cols[idx] || '' : '';
        };
        const nome = get('nome') || get('empresa') || get('name') || get('razao social') || get('raz\u00e3o social') || cols[0] || '';
        if (!nome) continue;
        // Skip duplicates by name
        if (existing.some(c => c.nome.toLowerCase() === nome.toLowerCase())) continue;
        const novo: Cliente = {
          id: store.nextId(isRevenda ? 'rev' : 'cli'),
          nome,
          cnpj: get('cnpj') || get('cpf/cnpj') || '',
          email: get('email') || get('e-mail') || '',
          telefone: get('telefone') || get('fone') || get('tel') || '',
          whatsapp: get('whatsapp') || get('celular') || '',
          endereco: get('endereco') || get('endere\u00e7o') || get('logradouro') || '',
          cidade: get('cidade') || get('municipio') || get('munic\u00edpio') || '',
          estado: get('estado') || get('uf') || '',
          contato: get('contato') || nome,
          compradores: [],
          regimeTributario: (get('regime') || 'Lucro Presumido') as any,
          usuarioCriador: currentUserName,
          createdAt: new Date().toISOString().split('T')[0],
        };
        existing.push(novo);
        count++;
      }
      if (isRevenda) { store.saveFornecedores(existing); setRevendas([...existing]); }
      else { store.saveClientes(existing); setClientes([...existing]); }
      toast.success(`${count} ${isRevenda ? 'revenda(s)' : 'cliente(s)'} importado(s)!`);
    };
    reader.readAsText(file);
    e.target.value = ''; // reset input
  };

  /* ---- Export CSV handler (master only) ---- */
  const handleExportCSV = () => {
    const data = isRevenda ? revendas : clientes;
    const headers = ['Nome', 'CNPJ', 'Email', 'Telefone', 'WhatsApp', 'Endere\u00e7o', 'Cidade', 'Estado', 'Regime Tribut\u00e1rio', 'Criado Por', 'Data Cadastro'];
    const rows = data.map(c => [
      c.nome, c.cnpj, c.email, c.telefone, c.whatsapp,
      c.endereco, c.cidade, c.estado, c.regimeTributario,
      c.usuarioCriador || '', c.createdAt
    ].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(';'));
    const csv = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${isRevenda ? 'revendas' : 'clientes'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Planilha exportada com sucesso!');
  };

  useEffect(() => {
    const load = () => {
      setClientes(store.getClientes());
      setRevendas(store.getFornecedores());
    };
    load();
    window.addEventListener('rp-data-synced', load);
    return () => window.removeEventListener('rp-data-synced', load);
  }, []);

  const orcamentos = store.getOrcamentos();
  const pedidos = store.getPedidos();

  const isRevenda = categoria === 'revenda';
  const labelContatos = isRevenda ? 'Vendedores' : 'Compradores';
  const labelContato = isRevenda ? 'Vendedor' : 'Comprador';
  const items = isRevenda ? revendas : clientes;

  const filtered = items.filter(c => {
    const s = search.toLowerCase();
    if (!s) return true;
    const compradorMatch = (c.compradores || []).some(comp =>
      comp.nome?.toLowerCase().includes(s) || comp.telefone?.includes(s) ||
      comp.email?.toLowerCase().includes(s) || comp.whatsapp?.includes(s)
    );
    return (
      c.nome?.toLowerCase().includes(s) || c.cnpj?.includes(s) ||
      c.email?.toLowerCase().includes(s) || c.telefone?.includes(s) ||
      c.whatsapp?.includes(s) || c.endereco?.toLowerCase().includes(s) ||
      c.cidade?.toLowerCase().includes(s) || c.estado?.toLowerCase().includes(s) || compradorMatch
    );
  });

  // Efeito para preenchimento automático via CNPJ
  useEffect(() => {
    const limpo = editing.cnpj.replace(/\D/g, '');
    if (limpo.length === 14) {
      fetchCNPJ(limpo).then(dados => {
        if (dados) {
          const regime = dados.opcao_pelo_simples ? 'Simples Nacional' : 'Lucro Presumido';
          
          setEditing(prev => {
            const updates: Partial<Cliente> = {};
            
            // Só sobrescreve se estiver vazio ou se quisermos forçar os dados da Receita (recomendado para razão social e endereço num ERP)
            if (!prev.nome) updates.nome = dados.razao_social || '';
            if (!prev.endereco) {
              const numStr = dados.numero ? `, ${dados.numero}` : '';
              const compStr = dados.complemento ? ` - ${dados.complemento}` : '';
              updates.endereco = `${dados.logradouro || ''}${numStr}${compStr}`.trim();
            }
            if (!prev.bairro) updates.bairro = dados.bairro || '';
            if (!prev.cep) updates.cep = dados.cep || '';
            if (!prev.cidade) updates.cidade = dados.municipio || '';
            if (!prev.estado) updates.estado = dados.uf || '';
            if (!prev.email) updates.email = dados.email || '';
            if (!prev.inscricaoEstadual && dados.inscricao_estadual) updates.inscricaoEstadual = dados.inscricao_estadual;
            if (!prev.inscricaoMunicipal && dados.inscricao_municipal) updates.inscricaoMunicipal = dados.inscricao_municipal; // Usually not returned by BrasilAPI but just in case
            if (!prev.aniversarioEmpresa && dados.data_inicio_atividade) updates.aniversarioEmpresa = dados.data_inicio_atividade;
            if (prev.regimeTributario !== regime) updates.regimeTributario = regime as any;

            if (Object.keys(updates).length > 0) {
              toast.success('Consultamos o CNPJ e preenchemos os dados automaticamente!');
              if (dados.descricao_situacao_cadastral && dados.descricao_situacao_cadastral !== 'ATIVA') {
                toast.warning(`Atenção: Situação Cadastral na Receita está ${dados.descricao_situacao_cadastral}`, { duration: 6000 });
              }
              return { ...prev, ...updates };
            }
            return prev;
          });
        }
      });
    }
  }, [editing.cnpj]);

  const handleSave = () => {
    if (isRevenda) {
      let updated: Cliente[];
      if (editing.id) { updated = revendas.map(c => c.id === editing.id ? editing : c); }
      else { updated = [...revendas, { ...editing, id: store.nextId('rev'), usuarioCriador: currentUserName }]; }
      store.saveFornecedores(updated); setRevendas(updated);
    } else {
      let updated: Cliente[];
      if (editing.id) { updated = clientes.map(c => c.id === editing.id ? editing : c); }
      else { updated = [...clientes, { ...editing, id: store.nextId('cli'), usuarioCriador: currentUserName }]; }
      store.saveClientes(updated); setClientes(updated);
    }
    setOpen(false); toast.success(`${isRevenda ? 'Revenda' : 'Cliente'} salvo!`);
  };

  const handleDelete = (id: string) => {
    if (isRevenda) {
      const updated = revendas.filter(c => c.id !== id);
      store.saveFornecedores(updated); setRevendas(updated);
    } else {
      const updated = clientes.filter(c => c.id !== id);
      store.saveClientes(updated); setClientes(updated);
    }
    toast.success(`${isRevenda ? 'Revenda' : 'Cliente'} removido!`);
    setConfirmDeleteClient(null);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-header">Clientes & Revendas</h1>
          <p className="page-subtitle">Cadastro de clientes e revendas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Hidden file input for import */}
          <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt,.xls,.xlsx" className="hidden" onChange={handleImportFile} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" /> Importar
          </Button>
          {isMaster && (
            <Button variant="outline" onClick={handleExportCSV} className="gap-2">
              <Download className="h-4 w-4" /> Baixar Planilha
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(emptyCliente())} className="gap-2"><Plus className="h-4 w-4" /> {isRevenda ? 'Nova Revenda' : 'Novo Cliente'}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing.id ? 'Editar' : 'Novo(a)'} {isRevenda ? 'Revenda' : 'Cliente'}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="text-xs text-muted-foreground">Nome da Empresa</label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">CNPJ</label><Input value={editing.cnpj} onChange={e => setEditing({ ...editing, cnpj: formatCPForCNPJ(e.target.value) })} /></div>
                <div><label className="text-xs text-muted-foreground">Regime Tributário</label>
                  <select value={editing.regimeTributario} onChange={e => setEditing({ ...editing, regimeTributario: e.target.value as RegimeTributario })} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                    <option value="Simples Nacional">Simples Nacional</option><option value="Lucro Presumido">Lucro Presumido</option><option value="Lucro Real">Lucro Real</option><option value="Isento">Isento</option>
                  </select>
                </div>
                <div><label className="text-xs text-muted-foreground">Inscrição Estadual</label><Input value={editing.inscricaoEstadual || ''} onChange={e => setEditing({ ...editing, inscricaoEstadual: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Inscrição Municipal</label><Input value={editing.inscricaoMunicipal || ''} onChange={e => setEditing({ ...editing, inscricaoMunicipal: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Telefone</label><Input value={editing.telefone} onChange={e => setEditing({ ...editing, telefone: formatTelefone(e.target.value) })} /></div>
                <div><label className="text-xs text-muted-foreground">WhatsApp</label><Input value={editing.whatsapp} onChange={e => setEditing({ ...editing, whatsapp: formatTelefone(e.target.value) })} /></div>
                <div><label className="text-xs text-muted-foreground">Email</label><Input value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">CEP</label><Input value={editing.cep || ''} onChange={e => setEditing({ ...editing, cep: e.target.value })} /></div>
                <div className="col-span-2"><label className="text-xs text-muted-foreground">Endereço</label><Input value={editing.endereco} onChange={e => setEditing({ ...editing, endereco: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Bairro</label><Input value={editing.bairro || ''} onChange={e => setEditing({ ...editing, bairro: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Cidade</label><Input value={editing.cidade} onChange={e => setEditing({ ...editing, cidade: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Estado</label><Input value={editing.estado} onChange={e => setEditing({ ...editing, estado: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Aniversário da Empresa</label><Input type="date" value={editing.aniversarioEmpresa || ''} onChange={e => setEditing({ ...editing, aniversarioEmpresa: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Redes Sociais da Empresa</label><Input value={editing.redesSociais || ''} onChange={e => setEditing({ ...editing, redesSociais: e.target.value })} placeholder="Instagram, LinkedIn..." /></div>
              </div>
              <div className="mt-4 border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">{labelContatos}</h3>
                  <Button variant="outline" size="sm" onClick={addComprador} className="gap-1"><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
                </div>
                {editing.compradores.map((comp, idx) => (
                  <div key={idx} className="border rounded-lg p-3 mb-2 bg-muted/20">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-muted-foreground">{labelContato} {idx + 1}</span>
                      {editing.compradores.length > 1 && <button onClick={() => removeComprador(idx)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-xs text-muted-foreground">Nome</label><Input value={comp.nome} onChange={e => updateComprador(idx, { nome: e.target.value })} /></div>
                      <div><label className="text-xs text-muted-foreground">Telefone</label><Input value={comp.telefone} onChange={e => updateComprador(idx, { telefone: formatTelefone(e.target.value) })} /></div>
                      <div><label className="text-xs text-muted-foreground">Email</label><Input value={comp.email} onChange={e => updateComprador(idx, { email: e.target.value })} /></div>
                      <div><label className="text-xs text-muted-foreground">WhatsApp</label><Input value={comp.whatsapp} onChange={e => updateComprador(idx, { whatsapp: formatTelefone(e.target.value) })} /></div>
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
      </div>

      {/* Botões de categoria */}
      <div className="flex gap-2">
        <Button
          variant={categoria === 'clientes' ? 'default' : 'outline'}
          onClick={() => { setCategoria('clientes'); setSearch(''); }}
          className="gap-2"
        >
          <Users className="h-4 w-4" /> Clientes
        </Button>
        <Button
          variant={categoria === 'revenda' ? 'default' : 'outline'}
          onClick={() => { setCategoria('revenda'); setSearch(''); }}
          className="gap-2"
        >
          <Store className="h-4 w-4" /> Revendas
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={`Buscar ${isRevenda ? 'revenda' : 'cliente'} por empresa, ${isRevenda ? 'vendedor' : 'comprador'}, CNPJ, endereço, telefone, email...`} value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Dialog open={!!viewCliente} onOpenChange={() => setViewCliente(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{viewCliente?.nome}</DialogTitle></DialogHeader>
          {viewCliente && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">CNPJ:</span> <strong>{viewCliente.cnpj}</strong></div>
                <div><span className="text-muted-foreground">IE/IM:</span> <strong>{viewCliente.inscricaoEstadual || '-'} / {viewCliente.inscricaoMunicipal || '-'}</strong></div>
                <div><span className="text-muted-foreground">Cidade:</span> <strong>{viewCliente.cidade}/{viewCliente.estado}</strong></div>
                <div><span className="text-muted-foreground">Telefone:</span> <strong>{viewCliente.telefone}</strong></div>
                <div><span className="text-muted-foreground">Email:</span> <strong>{viewCliente.email}</strong></div>
                <div><span className="text-muted-foreground">Aniv. Empresa:</span> <strong>{viewCliente.aniversarioEmpresa || '-'}</strong></div>
                <div><span className="text-muted-foreground">Redes (Empresa):</span> <strong>{viewCliente.redesSociais || '-'}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Endereço:</span> <strong>{viewCliente.endereco} {viewCliente.bairro ? `- ${viewCliente.bairro}` : ''} {viewCliente.cep ? `(CEP: ${viewCliente.cep})` : ''}</strong></div>
              </div>
              <div className="border-t pt-3">
                <h4 className="font-semibold text-xs mb-2">{labelContatos}</h4>
                {(viewCliente.compradores || []).map((c, i) => (
                  <div key={i} className="bg-muted/20 rounded p-2 mb-1 text-xs">
                    <strong>{c.nome}</strong> • {c.telefone} • {c.email}
                    {c.aniversario && ` • Aniv: ${c.aniversario}`}
                    {c.redesSociais && ` • Redes: ${c.redesSociais}`}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* GRID de Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(c => {
          const anivCompradores = (c.compradores || []).filter(comp => comp.aniversario).map(comp => `${comp.nome}: ${comp.aniversario}`);
          return (
            <div key={c.id} className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm truncate">{c.nome}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{c.cnpj}</p>
                </div>
                <div className="flex gap-1 ml-2 flex-shrink-0">
                  <button onClick={() => setViewCliente(c)} className="p-1 rounded hover:bg-muted" title="Ver"><Eye className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { setEditing({ ...c, compradores: c.compradores?.length ? c.compradores : [emptyComprador()] }); setOpen(true); }} className="p-1 rounded hover:bg-muted text-primary" title="Editar"><Edit className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setConfirmDeleteClient(c.id)} className="p-1 rounded hover:bg-muted text-destructive" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{c.telefone || '-'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{c.email || '-'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{c.cidade}/{c.estado}</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Último Orçamento:</span>
                  <span className="font-medium">{getUltimoOrcamento(c.id)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Última Compra:</span>
                  <span className="font-medium">{getUltimaCompra(c.nome)}</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t space-y-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <Cake className="h-3 w-3 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Empresa:</span>
                  <span className="font-medium">{c.aniversarioEmpresa || '-'}</span>
                </div>
                {anivCompradores.length > 0 && (
                  <div className="flex items-start gap-1.5">
                    <Calendar className="h-3 w-3 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-muted-foreground">{labelContatos}:</span>
                      {anivCompradores.map((a, i) => (
                        <p key={i} className="font-medium">{a}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {(c.compradores || []).length > 0 && (
                <div className="mt-3 pt-3 border-t text-xs">
                  <span className="text-muted-foreground font-medium">{labelContatos}:</span>
                  {(c.compradores || []).map((comp, i) => (
                    <p key={i} className="truncate mt-0.5">{comp.nome} {comp.telefone ? `• ${comp.telefone}` : ''}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">Nenhum(a) {isRevenda ? 'revenda' : 'cliente'} encontrado(a).</div>
        )}
      </div>

      {/* Confirmação */}
      <ConfirmDialog
        open={!!confirmDeleteClient}
        onOpenChange={(open) => !open && setConfirmDeleteClient(null)}
        title={`Excluir ${isRevenda ? 'Revenda' : 'Cliente'}`}
        description={`Tem certeza que deseja excluir est${isRevenda ? 'a revenda' : 'e cliente'}?`}
        onConfirm={() => confirmDeleteClient && handleDelete(confirmDeleteClient)}
      />
    </div>
  );
}
