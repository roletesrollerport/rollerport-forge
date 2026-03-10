import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import type { Cliente, Comprador, RegistroProspeccao, Usuario, Orcamento, Pedido } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useUsuarios } from '@/hooks/useUsuarios';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { 
  Search, Mail, Phone, MessageCircle, Link as LinkIcon, 
  Target, CalendarClock, Activity, AlertCircle, Building2, UserCircle2, Sparkles, Plus, FileUp, FileDown, Lock, Unlock, Trash2, FileText, ShoppingCart
} from 'lucide-react';
import { parseISO, differenceInDays } from 'date-fns';

const emptyComprador = (): Comprador => ({ nome: '', telefone: '', email: '', whatsapp: '', aniversario: '', redesSociais: '' });
const emptyCliente = (): Cliente => ({
  id: '', nome: '', cnpj: '', email: '', telefone: '', whatsapp: '', endereco: '', cidade: '', estado: '', contato: '',
  compradores: [emptyComprador()], aniversarioEmpresa: '', redesSociais: '',
  regimeTributario: 'Lucro Presumido',
  createdAt: new Date().toISOString().split('T')[0],
});

export default function ProspeccaoPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [prospeccoes, setProspeccoes] = useState<RegistroProspeccao[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  
  const { usuarios } = useUsuarios();
  const [loggedUserId, setLoggedUserId] = useState(() => localStorage.getItem('rp_logged_user') || '');
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);

  const [search, setSearch] = useState('');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [currentProspection, setCurrentProspection] = useState<RegistroProspeccao | null>(null);

  const [openCadastro, setOpenCadastro] = useState(false);
  const [editingCli, setEditingCli] = useState<Cliente>(emptyCliente());

  // Load Data
  useEffect(() => {
    const loadData = () => {
      setClientes(store.getClientes());
      setProspeccoes(store.getProspeccoes());
      setOrcamentos(store.getOrcamentos());
      setPedidos(store.getPedidos());
      const me = store.getUsuarios().find(u => u.id === loggedUserId);
      if (me) setCurrentUser(me);
    };
    loadData();
    window.addEventListener('rp-data-synced', loadData);
    return () => window.removeEventListener('rp-data-synced', loadData);
  }, [loggedUserId]);

  const isMaster = currentUser?.nivel === 'master';

  const isInactive = (dateStr: string) => {
    if (!dateStr) return false;
    const days = differenceInDays(new Date(), parseISO(dateStr));
    return days >= 30;
  };

  // ----- MÉTODOS ANALYTICS (Histórico no Card) -----
  const getUltimoOrcamento = (clienteId: string) => {
    const orcs = orcamentos.filter(o => o.clienteId === clienteId);
    if (orcs.length === 0) return '-';
    // Pega o mais recente
    return new Date(orcs[orcs.length - 1].dataOrcamento || orcs[orcs.length - 1].createdAt).toLocaleDateString('pt-BR');
  };

  const getUltimaCompra = (clienteNome: string) => {
    // Filtro mais robusto, considera as últimas compras (pedidos aprovados/entregues seriam o ideal, mas vamos pegar todos)
    const peds = pedidos.filter(p => p.clienteNome === clienteNome);
    if (peds.length === 0) return '-';
    // Pega o mais recente
    return new Date(peds[peds.length - 1].createdAt).toLocaleDateString('pt-BR');
  };

  // ----- FLUXO DA PROSPECÇÃO E EXCLUSIVIDADE (LOCK) -----
  const getProspectionForCard = (clienteId: string) => {
    if (isMaster) {
      const todasProf = prospeccoes.filter(p => p.clienteId === clienteId);
      if (todasProf.length === 0) return null;
      return todasProf.sort((a,b) => new Date(b.dataUltimaInteracao).getTime() - new Date(a.dataUltimaInteracao).getTime())[0];
    }
    // Procura se tem de qualquer pessoa p/ validar Lock visualmente, mas focar na do usuário se houver
    const minha = prospeccoes.find(p => p.clienteId === clienteId && p.vendedorId === loggedUserId);
    if (minha) return minha;
    
    // Mostra a de outro vendedor apenas para o Vendedor ver que existe e a quantidade
    const outra = prospeccoes.find(p => p.clienteId === clienteId);
    return outra || null;
  };

  const handleOpenProspection = (cliente: Cliente) => {
    // Busca se existe registro Deste Cliente
    let pRecord = prospeccoes.find(p => p.clienteId === cliente.id && p.vendedorId === loggedUserId);
    const pAny = prospeccoes.find(p => p.clienteId === cliente.id);

    // Validação de Lock (Em Atendimento)
    if (pAny && pAny.emAtendimentoPor && pAny.emAtendimentoPor !== loggedUserId && !isMaster) {
        const atendente = usuarios.find(u => u.id === pAny.emAtendimentoPor)?.nome || 'Outro Vendedor';
        toast.error(`Cliente em atendimento exclusivo por: ${atendente}`);
        return;
    }

    if (!pRecord) {
        if (isMaster && pAny) {
            pRecord = pAny;
        } else {
            // Cria um novo registro vazio do zero
            pRecord = {
                id: store.nextId('prosp'),
                clienteId: cliente.id,
                vendedorId: loggedUserId,
                checkOrcamentos: false,
                checkPedidos: false,
                checkOS: false,
                checkTelefone: false,
                checkWhatsapp: false,
                checkEmail: false,
                numeroInteracoes: 0,
                dataUltimaInteracao: new Date().toISOString(),
                createdAt: new Date().toISOString()
            };
        }
    }

    // Aplica o Lock
    pRecord = {
        ...pRecord,
        emAtendimentoPor: loggedUserId,
        emAtendimentoDesde: new Date().toISOString()
    };

    setSelectedCliente(cliente);
    setCurrentProspection(pRecord);
    setIsModalOpen(true);

    // Salva o estado Locked silênciosamente para outros não entrarem
    updatePropsStoreSilently(pRecord);
  };

  const updatePropsStoreSilently = (p: RegistroProspeccao) => {
    const updated = [...prospeccoes];
    const idx = updated.findIndex(x => x.id === p.id);
    if (idx >= 0) {
      updated[idx] = p;
    } else {
      updated.push(p);
    }
    store.saveProspeccoes(updated);
    setProspeccoes(updated);
  };

  const handleToggleCheck = (field: keyof RegistroProspeccao) => {
    if (!currentProspection) return;
    setCurrentProspection({
      ...currentProspection,
      [field]: !currentProspection[field]
    });
  };

  const handleIncrementQtd = (field: 'qtdTelefone' | 'qtdWhatsapp' | 'qtdEmail') => {
    if (!currentProspection) return;
    const currentVal = currentProspection[field] || 0;
    const checkField = field.replace('qtd', 'check') as keyof RegistroProspeccao;
    setCurrentProspection({
      ...currentProspection,
      [field]: currentVal + 1,
      [checkField]: true // Marca a caixinha automaticamente se for > 0
    });
  };

  const handleDecrementQtd = (field: 'qtdTelefone' | 'qtdWhatsapp' | 'qtdEmail') => {
    if (!currentProspection) return;
    const currentVal = currentProspection[field] || 0;
    if (currentVal > 0) {
      const checkField = field.replace('qtd', 'check') as keyof RegistroProspeccao;
      setCurrentProspection({
        ...currentProspection,
        [field]: currentVal - 1,
        [checkField]: currentVal - 1 > 0
      });
    }
  };

  const handleRegistrarInteracao = () => {
    if (!currentProspection || !selectedCliente) return;

    // Remove Lock ao finalizar, adiciona +1
    const novaProspection: RegistroProspeccao = {
      ...currentProspection,
      numeroInteracoes: currentProspection.numeroInteracoes + 1,
      dataUltimaInteracao: new Date().toISOString(),
      emAtendimentoPor: undefined,
      emAtendimentoDesde: undefined
    };

    updatePropsStoreSilently(novaProspection);
    setCurrentProspection(novaProspection);
    toast.success('Interação registrada com sucesso!');
    setIsModalOpen(false);
  };

  const handleCloseModalSemInteracao = () => {
    if (!currentProspection) { setIsModalOpen(false); return; }
    // Apenas solta o lock sem somar contador se fechar vazio
    const solta = {
        ...currentProspection,
        emAtendimentoPor: undefined,
        emAtendimentoDesde: undefined
    };
    updatePropsStoreSilently(solta);
    setIsModalOpen(false);
  };

  // ----- CADASTRO RÁPIDO & AÇÕES DE TOPO -----
  const updateComprador = (idx: number, partial: Partial<Comprador>) => {
    const compradores = [...editingCli.compradores];
    compradores[idx] = { ...compradores[idx], ...partial };
    setEditingCli({ ...editingCli, compradores });
  };
  const addComprador = () => setEditingCli({ ...editingCli, compradores: [...editingCli.compradores, emptyComprador()] });
  const removeComprador = (idx: number) => { 
      if (editingCli.compradores.length <= 1) return; 
      setEditingCli({ ...editingCli, compradores: editingCli.compradores.filter((_, i) => i !== idx) }); 
  };

  const handleSaveCliente = () => {
      let updated: Cliente[];
      if (editingCli.id) { updated = clientes.map(c => c.id === editingCli.id ? editingCli : c); }
      else { updated = [...clientes, { ...editingCli, id: store.nextId('cli') }]; }
      
      store.saveClientes(updated); 
      setClientes(updated);
      setOpenCadastro(false); 
      toast.success('Cliente salvo com sucesso!');
  };

  const mockIaSearch = () => {
    if(!search) { toast.error("Digite um termo na busca para a Inteligência Artificial analisar."); return; }
    toast.promise(
        new Promise(resolve => setTimeout(resolve, 3000)),
        {
            loading: `A IA está buscando na web por potenciais contatos no LinkedIn relacionados a "${search}"...`,
            success: `A busca retornou conexões em potencial. Funcionalidade em desenvolvimento de integração API!`,
            error: 'Erro na conexão'
        }
    );
  };

  const handleExportCsv = () => {
    if (clientes.length === 0) {
      toast.error('Nenhum cliente para exportar.');
      return;
    }
    
    const header = "Nome,CNPJ,Cidade,Estado,Telefone,Email,Total_Interacoes_CRM,Ultimo_Contato_CRM\n";
    const csvContent = clientes.map(c => {
        const prosp = getProspectionForCard(c.id);
        const inteRS = prosp ? prosp.numeroInteracoes : 0;
        const uc = prosp ? new Date(prosp.dataUltimaInteracao).toLocaleDateString('pt-BR') : '-';
        return `"${c.nome}","${c.cnpj}","${c.cidade}","${c.estado}","${c.telefone}","${c.email}","${inteRS}","${uc}"`;
    }).join("\n");

    const blob = new Blob([header + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Prospeccao_Clientes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Lista de Prospecções exportada com sucesso!');
  };

  // Link actions
  const actionWhatsApp = (phone: string, text: string = "") => {
    if (!phone) return;
    const numbers = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${numbers}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const actionEmail = (email: string) => {
    if (!email) return;
    window.location.href = `mailto:${email}`;
  };

  // View Filtering
  const displayedClientes = clientes.filter(c => {
    const s = search.toLowerCase();
    const matchSearch = c.nome.toLowerCase().includes(s) || c.cnpj.includes(s) || (c.cidade || '').toLowerCase().includes(s);
    if (!matchSearch) return false;
    return true; 
  });

  return (
    <div className="space-y-6">
      
      {/* HEADER E TOP BUTTONS */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Prospecção / CRM</h2>
          <p className="text-muted-foreground hidden sm:block">Gerencie histórico, interaja ativamente e maximize fechamentos.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2 bg-background"><FileUp className="h-4 w-4" /> Importar</Button>
            <Button variant="outline" onClick={handleExportCsv} className="gap-2 bg-background"><FileDown className="h-4 w-4" /> Exportar</Button>
            
            <Dialog open={openCadastro} onOpenChange={setOpenCadastro}>
                <DialogTrigger asChild>
                    <Button onClick={() => setEditingCli(emptyCliente())} className="gap-2"><Plus className="h-4 w-4" /> Cadastrar Cliente</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{editingCli.id ? 'Editar Cliente' : 'Novo Lead/Cliente'}</DialogTitle></DialogHeader>
                    {/* Reuse Modal do ClientesPage simplificado */}
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="col-span-2"><label className="text-xs text-muted-foreground">Nome da Empresa</label><Input value={editingCli.nome} onChange={e => setEditingCli({ ...editingCli, nome: e.target.value })} /></div>
                        <div><label className="text-xs text-muted-foreground">CNPJ</label><Input value={editingCli.cnpj} onChange={e => setEditingCli({ ...editingCli, cnpj: e.target.value })} /></div>
                        <div><label className="text-xs text-muted-foreground">Telefone Central</label><Input value={editingCli.telefone} onChange={e => setEditingCli({ ...editingCli, telefone: e.target.value })} /></div>
                        <div><label className="text-xs text-muted-foreground">WhatsApp Empresa</label><Input value={editingCli.whatsapp} onChange={e => setEditingCli({ ...editingCli, whatsapp: e.target.value })} /></div>
                        <div><label className="text-xs text-muted-foreground">Email</label><Input value={editingCli.email} onChange={e => setEditingCli({ ...editingCli, email: e.target.value })} /></div>
                        <div className="col-span-2"><label className="text-xs text-muted-foreground">Endereço</label><Input value={editingCli.endereco} onChange={e => setEditingCli({ ...editingCli, endereco: e.target.value })} /></div>
                        <div><label className="text-xs text-muted-foreground">Cidade</label><Input value={editingCli.cidade} onChange={e => setEditingCli({ ...editingCli, cidade: e.target.value })} /></div>
                        <div><label className="text-xs text-muted-foreground">Estado</label><Input value={editingCli.estado} onChange={e => setEditingCli({ ...editingCli, estado: e.target.value })} /></div>
                    </div>
                    <div className="mt-4 border-t pt-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-sm">Compradores (Contatos Diretos)</h3>
                            <Button variant="outline" size="sm" onClick={addComprador} className="gap-1"><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
                        </div>
                        {editingCli.compradores.map((comp, idx) => (
                            <div key={idx} className="border rounded-lg p-3 mb-2 bg-muted/20">
                                <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-medium text-muted-foreground">Comprador {idx + 1}</span>
                                {editingCli.compradores.length > 1 && <button onClick={() => removeComprador(idx)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className="text-xs text-muted-foreground">Nome</label><Input value={comp.nome} onChange={e => updateComprador(idx, { nome: e.target.value })} /></div>
                                    <div><label className="text-xs text-muted-foreground">Telefone Direto</label><Input value={comp.telefone} onChange={e => updateComprador(idx, { telefone: e.target.value })} /></div>
                                    <div><label className="text-xs text-muted-foreground">Email de Vendas</label><Input value={comp.email} onChange={e => updateComprador(idx, { email: e.target.value })} /></div>
                                    <div><label className="text-xs text-muted-foreground">WhatsApp Pessoal</label><Input value={comp.whatsapp} onChange={e => updateComprador(idx, { whatsapp: e.target.value })} /></div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <DialogFooter><Button onClick={handleSaveCliente}>Salvar Lead</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      <div className="flex w-full items-center gap-2">
          <div className="relative flex-1 max-w-xl flex items-center gap-2">
            <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                placeholder="Buscar por cliente, CNPJ ou cidade da sua carteira..." 
                className="pl-8 bg-background border-primary/20"
                value={search}
                onChange={e => setSearch(e.target.value)}
                />
            </div>
            <Button onClick={mockIaSearch} variant={'secondary'} className="gap-2 whitespace-nowrap bg-purple-100 text-purple-700 hover:bg-purple-200 border-none">
                <Sparkles className="h-4 w-4" />
                Busca Web IA
            </Button>
          </div>
      </div>

      {/* GRID DE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {displayedClientes.map(cliente => {
          const prosp = getProspectionForCard(cliente.id);
          const hasProspection = !!prosp;
          const interactions = prosp ? prosp.numeroInteracoes : 0;
          const isDanger = prosp ? isInactive(prosp.dataUltimaInteracao) : false;
          
          let lockedByOther = false;
          let lockedName = '';
          if (prosp?.emAtendimentoPor && prosp.emAtendimentoPor !== loggedUserId && !isMaster) {
              lockedByOther = true;
              lockedName = usuarios.find(u => u.id === prosp.emAtendimentoPor)?.nome || 'Outro Vendedor';
          }
          if (prosp?.emAtendimentoPor && isMaster) {
               lockedName = usuarios.find(u => u.id === prosp.emAtendimentoPor)?.nome || 'Outro Vendedor';
          }

          const principalPhone = cliente.whatsapp || cliente.telefone;
          const principalEmail = cliente.email;

          // Dados de Compra (Analytics)
          const lastOrca = getUltimoOrcamento(cliente.id);
          const lastPed = getUltimaCompra(cliente.nome);

          return (
            <Card 
              key={cliente.id} 
              className={`flex flex-col transition-all overflow-hidden relative shadow-sm hover:shadow-md ${isDanger ? 'border-destructive/60' : 'hover:border-primary/50'}`}
            >
              <CardHeader className={`pb-3 border-b relative ${isDanger ? 'bg-destructive/5' : 'bg-muted/10'}`}>
                {isDanger && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 text-[9px] bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-sm font-bold shadow-sm">
                    <AlertCircle className="h-2.5 w-2.5" />
                    INATIVO
                  </div>
                )}
                <CardTitle className={`text-sm flex items-start justify-between min-h-[2.5rem] leading-tight ${isDanger ? 'text-destructive pr-16' : 'pr-6'}`}>
                  <span className="line-clamp-2">{cliente.nome}</span>
                </CardTitle>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="truncate">{cliente.cidade} / {cliente.estado}</span>
                </div>
              </CardHeader>
              
              <CardContent className="pt-4 flex-1 space-y-4">
                
                {/* Contact Quick Links */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <button 
                      onClick={() => actionWhatsApp(principalPhone)}
                      disabled={!principalPhone}
                      className="p-1.5 bg-[#25D366]/15 text-[#25D366] rounded hover:bg-[#25D366]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Chamar no WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                    <span className="truncate flex-1 font-medium">{principalPhone || 'Sem telefone'}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <button 
                      onClick={() => actionEmail(principalEmail)}
                      disabled={!principalEmail}
                      className="p-1.5 bg-blue-500/15 text-blue-600 rounded hover:bg-blue-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Enviar E-mail"
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                    <span className="truncate flex-1 font-medium">{principalEmail || 'Sem e-mail'}</span>
                  </div>
                </div>

                {/* Histórico Analytics */}
                <div className="bg-muted/30 p-2 rounded-md space-y-1.5 border">
                    <div className="flex justify-between items-center text-[10px] sm:text-xs">
                        <span className="text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3"/> Últ. Orçamento:</span>
                        <span className="font-semibold">{lastOrca}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] sm:text-xs">
                        <span className="text-muted-foreground flex items-center gap-1"><ShoppingCart className="h-3 w-3"/> Últ. Compra:</span>
                        <span className="font-semibold text-primary">{lastPed}</span>
                    </div>
                </div>

                {/* Score / Status */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-[10px] sm:text-xs mb-1">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Activity className="h-3.5 w-3.5" />
                      <span>Interações CRM:</span>
                    </div>
                    <span className={`font-bold px-1.5 rounded ${interactions > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {interactions} check(s)
                    </span>
                  </div>
                  
                  {hasProspection && (
                    <div className="flex items-center justify-between text-[10px] sm:text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                         <CalendarClock className="h-3.5 w-3.5" />
                         <span>Último Contato:</span>
                      </div>
                      <span className="font-medium text-foreground">
                        {new Date(prosp.dataUltimaInteracao).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )}

                   {/* Indicador de Lock */}
                   {prosp?.emAtendimentoPor && (
                      <div className="flex items-center justify-between text-[9px] sm:text-[10px] mt-2 bg-yellow-500/10 text-yellow-700 p-1 rounded font-medium border border-yellow-500/20">
                         <span className="flex items-center gap-1"><Lock className="h-2.5 w-2.5"/> Atendimento:</span>
                         <span className="truncate ml-1 max-w-[100px]">{lockedName}</span>
                      </div>
                   )}
                </div>

              </CardContent>
              
              <CardFooter className="pt-0 pb-4 px-4 mt-auto">
                <Button 
                  onClick={() => handleOpenProspection(cliente)}
                  variant={lockedByOther ? 'secondary' : (hasProspection ? (isDanger ? 'destructive' : 'default') : 'outline')}
                  className={`w-full gap-2 transition-all ${lockedByOther ? 'opacity-70' : 'shadow-sm'}`}
                >
                  {lockedByOther ? <Lock className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                  {lockedByOther ? 'Em Uso (Travado)' : (hasProspection ? 'Continuar Abordagem' : 'Iniciar Prospecção')}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
        {displayedClientes.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed rounded-lg bg-muted/10">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-medium text-foreground mb-1">Cenário Limpo</h3>
            <p className="text-muted-foreground text-sm">Nenhum lead encontrado com estes filtros ou você não possui clientes.</p>
          </div>
        )}
      </div>

      {/* CRM Interaction Modal */}
      <Dialog open={isModalOpen} onOpenChange={(val) => {
          if (!val) handleCloseModalSemInteracao();
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto w-full md:w-[90vw]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Target className="h-6 w-6 text-primary" />
              Checklist de Prospecção
            </DialogTitle>
            <DialogDescription className="text-base font-medium text-foreground mt-1">
              {selectedCliente?.nome}
            </DialogDescription>
            {isMaster && currentProspection?.emAtendimentoPor && currentProspection.emAtendimentoPor !== loggedUserId && (
               <div className="flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 bg-blue-50 p-2 rounded w-fit border border-blue-200">
                  <Unlock className="h-3 w-3" /> Master Override: Superando trava do vendedor {usuarios.find(u => u.id === currentProspection.emAtendimentoPor)?.nome}.
               </div>
            )}
          </DialogHeader>
          
          <div className="space-y-6 py-2">
            
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 bg-muted/30 p-2 rounded text-foreground">
                <Search className="h-4 w-4 text-muted-foreground" />
                Histórico Anterior (Interno)
              </h4>
              <div className="flex flex-col sm:flex-row sm:gap-4 gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/40 p-2 border rounded-md transition-colors flex-1 shadow-sm">
                  <Checkbox 
                    checked={currentProspection?.checkOrcamentos} 
                    onCheckedChange={() => handleToggleCheck('checkOrcamentos')} 
                  />
                  <span>Verificar Orçamentos</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/40 p-2 border rounded-md transition-colors flex-1 shadow-sm">
                  <Checkbox 
                    checked={currentProspection?.checkPedidos} 
                    onCheckedChange={() => handleToggleCheck('checkPedidos')} 
                  />
                  <span>Verificar Pedidos</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/40 p-2 border rounded-md transition-colors flex-1 shadow-sm">
                  <Checkbox 
                    checked={currentProspection?.checkOS} 
                    onCheckedChange={() => handleToggleCheck('checkOS')} 
                  />
                  <span>Consultar O.S.</span>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 bg-muted/30 p-2 rounded text-foreground">
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                Tentativas e Contatos Realizados (Abordagem)
              </h4>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/10 p-2 border rounded-md transition-colors shadow-sm gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                    <Checkbox className="h-5 w-5"
                      checked={currentProspection?.checkTelefone} 
                      onCheckedChange={() => handleToggleCheck('checkTelefone')} 
                    />
                    <span className="font-medium flex-1">Liguei / Telefonei</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border rounded-md h-8 overflow-hidden bg-background">
                      <button onClick={() => handleDecrementQtd('qtdTelefone')} className="w-8 h-full flex items-center justify-center bg-muted/30 hover:bg-muted/60">-</button>
                      <span className="w-8 text-center text-xs font-semibold">{currentProspection?.qtdTelefone || 0}x</span>
                      <button onClick={() => handleIncrementQtd('qtdTelefone')} className="w-8 h-full flex items-center justify-center bg-muted/30 hover:bg-muted/60">+</button>
                    </div>
                    <Button size="sm" variant="secondary" className="h-8 px-3 text-xs flex-shrink-0"><Phone className="h-3.5 w-3.5 mr-1.5"/> {selectedCliente?.telefone}</Button>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/10 p-2 border rounded-md transition-colors shadow-sm gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                    <Checkbox className="h-5 w-5"
                      checked={currentProspection?.checkWhatsapp} 
                      onCheckedChange={() => handleToggleCheck('checkWhatsapp')} 
                    />
                    <span className="font-medium flex-1">Chamei no WhatsApp</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border rounded-md h-8 overflow-hidden bg-background">
                      <button onClick={() => handleDecrementQtd('qtdWhatsapp')} className="w-8 h-full flex items-center justify-center bg-muted/30 hover:bg-muted/60">-</button>
                      <span className="w-8 text-center text-xs font-semibold">{currentProspection?.qtdWhatsapp || 0}x</span>
                      <button onClick={() => handleIncrementQtd('qtdWhatsapp')} className="w-8 h-full flex items-center justify-center bg-muted/30 hover:bg-muted/60">+</button>
                    </div>
                    <Button size="sm" variant="secondary" className="h-8 px-3 text-xs flex-shrink-0 text-[#25D366] hover:bg-green-50 hover:text-green-700" onClick={() => actionWhatsApp(selectedCliente?.whatsapp || selectedCliente?.telefone || '')}><MessageCircle className="h-3.5 w-3.5 mr-1.5"/> Iniciar Chat Web</Button>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/10 p-2 border rounded-md transition-colors shadow-sm gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                    <Checkbox  className="h-5 w-5"
                      checked={currentProspection?.checkEmail} 
                      onCheckedChange={() => handleToggleCheck('checkEmail')} 
                    />
                    <span className="font-medium flex-1">Enviei um E-mail</span>
                  </label>
                  <div className="flex items-center gap-3">
                     <div className="flex items-center border rounded-md h-8 overflow-hidden bg-background">
                      <button onClick={() => handleDecrementQtd('qtdEmail')} className="w-8 h-full flex items-center justify-center bg-muted/30 hover:bg-muted/60">-</button>
                      <span className="w-8 text-center text-xs font-semibold">{currentProspection?.qtdEmail || 0}x</span>
                      <button onClick={() => handleIncrementQtd('qtdEmail')} className="w-8 h-full flex items-center justify-center bg-muted/30 hover:bg-muted/60">+</button>
                    </div>
                    <Button size="sm" variant="secondary" className="h-8 px-3 text-xs flex-shrink-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => actionEmail(selectedCliente?.email || '')}><Mail className="h-3.5 w-3.5 mr-1.5"/> Escrever E-mail</Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 p-4 rounded-lg flex items-center justify-between border border-primary/10">
              <div>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Marcador Operacional</p>
                <p className="text-sm font-medium text-foreground">Somas de todas as interações e retomadas</p>
              </div>
              <div className="h-12 w-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-black text-xl shadow-md border-2 border-background">
                {currentProspection?.numeroInteracoes || 0}
              </div>
            </div>

          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 border-t pt-5 mt-2">
            <Button variant="outline" onClick={handleCloseModalSemInteracao} className="sm:flex-1 h-11">
              Cancelar e Soltar Lead (Não Salva)
            </Button>
            <Button onClick={handleRegistrarInteracao} className="sm:flex-1 h-11 gap-2 bg-success text-success-foreground hover:bg-success/90 font-bold text-sm">
              <Activity className="h-4 w-4" />
              Finalizar Abordagem (+1 Contato)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
