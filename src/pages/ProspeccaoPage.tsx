import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import type { Cliente, RegistroProspeccao, Usuario } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useUsuarios } from '@/hooks/useUsuarios';
import { Label } from '@/components/ui/label';
import { 
  Search, Mail, Phone, MessageCircle, Link as LinkIcon, 
  Target, CalendarClock, Activity, AlertCircle, Building2, UserCircle2
} from 'lucide-react';
import { parseISO, differenceInDays } from 'date-fns';

export default function ProspeccaoPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [prospeccoes, setProspeccoes] = useState<RegistroProspeccao[]>([]);
  const { usuarios } = useUsuarios();
  
  const [loggedUserId, setLoggedUserId] = useState(() => localStorage.getItem('rp_logged_user') || '');
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);

  const [search, setSearch] = useState('');
  
  // Modal de Prospecção
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [currentProspection, setCurrentProspection] = useState<RegistroProspeccao | null>(null);

  // Load Data
  useEffect(() => {
    const loadData = () => {
      setClientes(store.getClientes());
      setProspeccoes(store.getProspeccoes());
      const me = store.getUsuarios().find(u => u.id === loggedUserId);
      if (me) setCurrentUser(me);
    };
    loadData();
    window.addEventListener('rp-data-synced', loadData);
    return () => window.removeEventListener('rp-data-synced', loadData);
  }, [loggedUserId]);

  const isMaster = currentUser?.nivel === 'master';

  // Verifica se a prospeccao está inativa (+30 dias)
  const isInactive = (dateStr: string) => {
    if (!dateStr) return false;
    const days = differenceInDays(new Date(), parseISO(dateStr));
    return days >= 30;
  };

  // Encontra ou inicializa uma prospecção para o cliente selecionado
  const handleOpenProspection = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    
    // Procura se já existe prospecção pro usuário atual neste cliente
    let p = prospeccoes.find(p => p.clienteId === cliente.id && p.vendedorId === loggedUserId);
    
    if (!p) {
      // Se mestre tentar abrir uma prospect alheia, ele assume visualização da que existir (a mais recente) ou cria uma.
      if (isMaster) {
         p = prospeccoes.find(p => p.clienteId === cliente.id);
      }
      
      if (!p) {
        p = {
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
    
    setCurrentProspection(p);
    setIsModalOpen(true);
  };

  const handleToggleCheck = (field: keyof RegistroProspeccao) => {
    if (!currentProspection) return;
    setCurrentProspection({
      ...currentProspection,
      [field]: !currentProspection[field]
    });
  };

  const handleRegistrarInteracao = () => {
    if (!currentProspection || !selectedCliente) return;

    const novaProspection: RegistroProspeccao = {
      ...currentProspection,
      numeroInteracoes: currentProspection.numeroInteracoes + 1,
      dataUltimaInteracao: new Date().toISOString()
    };

    const updated = [...prospeccoes];
    const idx = updated.findIndex(x => x.id === novaProspection.id);
    
    if (idx >= 0) {
      updated[idx] = novaProspection;
    } else {
      updated.push(novaProspection);
    }

    store.saveProspeccoes(updated);
    setProspeccoes(updated);
    setCurrentProspection(novaProspection);
    toast.success('Interação registrada com sucesso!');
    setIsModalOpen(false); // Fechar após registrar, comportamento dinâmico
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
    // Busca textual
    const s = search.toLowerCase();
    const matchSearch = c.nome.toLowerCase().includes(s) || c.cnpj.includes(s) || (c.cidade || '').toLowerCase().includes(s);
    if (!matchSearch) return false;

    // Regra de Vendedor:
    // Master vê todos (ou a gente poderia fazer master ver quem já tem cadastro de prospect). Vamos testar exibir todos.
    if (isMaster) return true;

    // Vendedor comum só deveria ver clientes se ele "assumiu" a prospecção OU se o cliente não tiver dono. 
    // Para simplificar a entrada, o vendedor comum vê a carteira de clientes, mas quem interage cria vínculo.
    // Vamos exibir todos por enquanto, mas focados nas interações DELE.
    return true; 
  });

  // Função helper pra pegar qual interacao esse card tem
  const getProspectionForCard = (clienteId: string) => {
    if (isMaster) {
      // Master vê a soma ou a última de qualquer pessoa. Vamos pegar a mais recente.
      const todasProf = prospeccoes.filter(p => p.clienteId === clienteId);
      if (todasProf.length === 0) return null;
      return todasProf.sort((a,b) => new Date(b.dataUltimaInteracao).getTime() - new Date(a.dataUltimaInteracao).getTime())[0];
    }
    return prospeccoes.find(p => p.clienteId === clienteId && p.vendedorId === loggedUserId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Prospecção de Clientes</h2>
          <p className="text-muted-foreground">Gerencie o relacionamento, acompanhe interações e feche negócios.</p>
        </div>
        <div className="flex w-full md:w-auto items-center gap-2">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome, CNPJ ou cidade..." 
              className="pl-8 bg-background"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayedClientes.map(cliente => {
          const prosp = getProspectionForCard(cliente.id);
          const hasProspection = !!prosp;
          const interactions = prosp ? prosp.numeroInteracoes : 0;
          const isDanger = prosp ? isInactive(prosp.dataUltimaInteracao) : false;
          
          const principalPhone = cliente.whatsapp || cliente.telefone;
          const principalEmail = cliente.email;

          return (
            <Card 
              key={cliente.id} 
              className={`flex flex-col transition-all hover:shadow-md ${isDanger ? 'border-destructive/60 shadow-sm shadow-destructive/20' : 'hover:border-primary/50'}`}
            >
              <CardHeader className="pb-3 border-b bg-muted/20 relative">
                {isDanger && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] bg-destructive/10 text-destructive px-2 py-1 rounded-full font-bold">
                    <AlertCircle className="h-3 w-3" />
                    Inativo +30D
                  </div>
                )}
                <CardTitle className="text-lg flex items-start justify-between min-h-[3rem]">
                  <span className="line-clamp-2 pr-8">{cliente.nome}</span>
                </CardTitle>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  <span className="truncate">{cliente.cidade} / {cliente.estado}</span>
                </div>
              </CardHeader>
              
              <CardContent className="pt-4 flex-1 space-y-3">
                
                {/* Contact Quick Links */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground group">
                    <button 
                      onClick={() => actionWhatsApp(principalPhone)}
                      disabled={!principalPhone}
                      className="p-1.5 bg-green-500/10 text-green-600 rounded-md hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Chamar no WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                    <span className="truncate flex-1">{principalPhone || 'Sem telefone'}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <button 
                      onClick={() => actionEmail(principalEmail)}
                      disabled={!principalEmail}
                      className="p-1.5 bg-blue-500/10 text-blue-600 rounded-md hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Enviar E-mail"
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                    <span className="truncate flex-1">{principalEmail || 'Sem e-mail'}</span>
                  </div>
                </div>

                {/* Score / Status */}
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Activity className="h-3.5 w-3.5" />
                      <span>Interações:</span>
                    </div>
                    <span className={`font-bold ${interactions > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {interactions}
                    </span>
                  </div>
                  
                  {hasProspection && (
                    <div className="flex items-center justify-between text-xs mt-1.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                         <CalendarClock className="h-3.5 w-3.5" />
                         <span>Último Contato:</span>
                      </div>
                      <span className="font-medium">
                        {new Date(prosp.dataUltimaInteracao).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )}
                  {hasProspection && isMaster && (
                     <div className="flex items-center justify-between text-xs mt-1.5">
                       <div className="flex items-center gap-1.5 text-muted-foreground">
                         <UserCircle2 className="h-3.5 w-3.5" />
                         <span>Responsável:</span>
                       </div>
                       <span className="font-medium truncate max-w-[100px]" title={usuarios.find(u => u.id === prosp.vendedorId)?.nome}>
                         {usuarios.find(u => u.id === prosp.vendedorId)?.nome || '-'}
                       </span>
                     </div>
                  )}
                </div>

              </CardContent>
              
              <CardFooter className="pt-0 pb-4 px-4 border-t mt-auto">
                <Button 
                  onClick={() => handleOpenProspection(cliente)}
                  variant={hasProspection ? (isDanger ? 'destructive' : 'default') : 'outline'}
                  className="w-full gap-2 mt-4"
                >
                  <Target className="h-4 w-4" />
                  {hasProspection ? 'Continuar Prospecção' : 'Iniciar Prospecção'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
        {displayedClientes.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed rounded-lg bg-muted/10">
            <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-20" />
            <p className="text-muted-foreground font-medium">Nenhum cliente encontrado para prospecção.</p>
          </div>
        )}
      </div>

      {/* CRM Interaction Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Painel de Prospecção
            </DialogTitle>
            <DialogDescription>
              {selectedCliente?.nome}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 border-b pb-1">
                <Search className="h-4 w-4 text-muted-foreground" />
                Histórico de Análises (Checklist interno)
              </h4>
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 p-1.5 rounded-md transition-colors">
                  <Checkbox 
                    checked={currentProspection?.checkOrcamentos} 
                    onCheckedChange={() => handleToggleCheck('checkOrcamentos')} 
                  />
                  <span>Verificar Últimos Orçamentos criados</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 p-1.5 rounded-md transition-colors">
                  <Checkbox 
                    checked={currentProspection?.checkPedidos} 
                    onCheckedChange={() => handleToggleCheck('checkPedidos')} 
                  />
                  <span>Verificar Últimos Pedidos vendidos</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 p-1.5 rounded-md transition-colors">
                  <Checkbox 
                    checked={currentProspection?.checkOS} 
                    onCheckedChange={() => handleToggleCheck('checkOS')} 
                  />
                  <span>Verificar Últimas Ordens de Serviço (O.S.)</span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 border-b pb-1">
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                Canais de Contato (Abordagem Registrada)
              </h4>
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between hover:bg-muted/30 p-1.5 rounded-md transition-colors">
                  <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                    <Checkbox 
                      checked={currentProspection?.checkTelefone} 
                      onCheckedChange={() => handleToggleCheck('checkTelefone')} 
                    />
                    <span>Contato via Telefone</span>
                  </label>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => {/* copy to clipboard or direct dial protocol */}}><Phone className="h-3 w-3 mr-1"/> {selectedCliente?.telefone}</Button>
                </div>
                
                <div className="flex items-center justify-between hover:bg-muted/30 p-1.5 rounded-md transition-colors">
                  <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                    <Checkbox 
                      checked={currentProspection?.checkWhatsapp} 
                      onCheckedChange={() => handleToggleCheck('checkWhatsapp')} 
                    />
                    <span>Contato via WhatsApp</span>
                  </label>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => actionWhatsApp(selectedCliente?.whatsapp || selectedCliente?.telefone || '')}><MessageCircle className="h-3 w-3 mr-1"/> Abrir zap</Button>
                </div>
                
                <div className="flex items-center justify-between hover:bg-muted/30 p-1.5 rounded-md transition-colors">
                  <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                    <Checkbox 
                      checked={currentProspection?.checkEmail} 
                      onCheckedChange={() => handleToggleCheck('checkEmail')} 
                    />
                    <span>Contato via E-mail</span>
                  </label>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => actionEmail(selectedCliente?.email || '')}><Mail className="h-3 w-3 mr-1"/> Enviar e-mail</Button>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 p-3 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Marcador de Sucesso</p>
                <p className="text-sm font-medium">Interações totais com o prospect</p>
              </div>
              <div className="h-10 w-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
                {currentProspection?.numeroInteracoes || 0}
              </div>
            </div>

          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Fechar e Salvar progresso
            </Button>
            <Button onClick={handleRegistrarInteracao} className="gap-2 bg-success text-success-foreground hover:bg-success/90">
              <Activity className="h-4 w-4" />
              Finalizar Abordagem (+1 Contato)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
