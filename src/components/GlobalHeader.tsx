import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, LogOut, RefreshCw, Clock, Calendar as CalendarIcon, Trash2,
  Menu
} from 'lucide-react';
import { store } from '@/lib/store';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { parseISO, isSameDay, isBefore, startOfDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Usuario } from '@/lib/types';
import logo from '@/assets/logo.png';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GlobalHeaderProps {
  currentUser: Usuario;
  naoLidas: number;
  unreadChatCount: number;
  onLogout: () => void;
  onMenuOpen?: () => void;
}

export function GlobalHeader({ currentUser, naoLidas, unreadChatCount, onLogout, onMenuOpen }: GlobalHeaderProps) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [agendaItems, setAgendaItems] = useState<any[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const notificacoes = store.getNotificacoes();

  // Real-time Clock logic
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Agenda items for the calendar popover
  useEffect(() => {
    const loadAgendaData = () => {
      setAgendaItems(store.getAgenda());
    };
    loadAgendaData();
    window.addEventListener('rp-data-synced', loadAgendaData);
    window.addEventListener('rp-store-save', loadAgendaData);
    return () => {
      window.removeEventListener('rp-data-synced', loadAgendaData);
      window.removeEventListener('rp-store-save', loadAgendaData);
    };
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const handleBellClick = () => setShowNotif(!showNotif);

  const handleNotifClick = (n: any) => {
    const updated = notificacoes.map(notif => notif.id === n.id ? { ...notif, lida: true } : notif);
    store.saveNotificacoes(updated);
    if (n.link) navigate(n.link);
    else if (n.tipo === 'chat') navigate('/chat');
    setShowNotif(false);
  };

  const excluirNotif = (id: string) => {
    const updated = notificacoes.filter(n => n.id !== id);
    store.saveNotificacoes(updated);
  };

  const excluirTodas = () => {
    store.saveNotificacoes([]);
    setShowNotif(false);
  };

  const nameMatch = (vendedorField: string, userName: string) => {
    const a = (vendedorField || '').trim().toLowerCase();
    const b = (userName || '').trim().toLowerCase();
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a) || a.split(' ')[0] === b.split(' ')[0];
  };

  const filteredAgendaItems = agendaItems.filter(item => {
    if (!currentUser) return false;
    const fullAccessRoles = ['master', 'SEO', 'admin', 'Admin', 'Administrador', 'administrador', 'adm/dono'];
    if (fullAccessRoles.includes(currentUser.nivel)) return true;
    return nameMatch(item.vendedor || '', currentUser.nome || '');
  });

  return (
    <header className="bg-white border border-[#E2E8F0] px-4 py-2 sm:px-6 sm:py-3 z-40 w-full font-sans rounded-2xl shadow-sm">
      <div className="w-full flex flex-col lg:flex-row lg:items-center justify-between items-start gap-2 lg:gap-6">
        {/* Branch / Greeting Section (TOP on mobile, LEFT on desktop) */}
        <div className="flex flex-row items-center justify-start w-full lg:w-auto h-12 sm:h-16 lg:h-12 px-1 gap-3">
          {onMenuOpen && (
            <button 
              onClick={onMenuOpen}
              className="lg:hidden p-2 rounded-xl bg-[#223c61] text-white hover:bg-[#1a2e4b] transition-all shadow-md active:scale-95 shrink-0"
            >
              <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}
          <div className="flex flex-row items-center gap-3 lg:gap-5 text-left">
            <img src={logo} alt="Rollerport" className="h-12 w-12 sm:h-16 sm:w-16 lg:h-16 lg:w-16 object-contain shrink-0 drop-shadow-sm" />
            <div className="flex flex-col items-start justify-center">
              <h1 className="text-base sm:text-2xl lg:text-2xl font-black text-[#223c61] tracking-tight leading-none mb-0.5 whitespace-nowrap">
                {getGreeting()}, {currentUser?.nome}!
              </h1>
              <p className="text-[8px] sm:text-xs lg:text-[11px] font-black text-muted-foreground tracking-[0.15em] opacity-60 uppercase leading-none">
                Central de Comando Rollerport
              </p>
            </div>
          </div>
        </div>

        {/* Tools Section (BOTTOM on mobile, RIGHT on desktop) */}
        <div className="flex flex-row items-center gap-1.5 sm:gap-2 lg:gap-3 flex-nowrap pb-1 lg:pb-0 w-full lg:w-auto">
          {/* Time Command Center */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1 sm:gap-2.5 bg-[#F8FAFC] border border-[#E2E8F0] px-1.5 sm:px-3 lg:px-4 h-8 sm:h-10 lg:h-12 rounded-lg sm:rounded-xl shrink-0 shadow-sm hover:bg-white transition-all group min-h-0 min-w-0">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-[#223c61] group-hover:scale-110 transition-transform" />
                <div className="flex flex-row items-center gap-1 sm:gap-2 leading-none whitespace-nowrap">
                  <span className="text-[10px] sm:text-xs lg:text-base font-bold text-[#223c61] tabular-nums">
                    {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="hidden sm:inline-block w-px h-3 bg-[#E2E8F0]" />
                  <span className="text-[8px] sm:text-[10px] lg:text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    {currentTime.toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0 border-none shadow-2xl rounded-3xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="bg-white p-4">
                <style>{`
                  @keyframes pulse-urgency {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.15); opacity: 0.7; }
                  }
                  .animate-pulse-urgency {
                    animation: pulse-urgency 1.2s ease-in-out infinite;
                  }
                  /* Orange circle for on-time pending events (matches PENDENTES card) */
                  .day-ontime {
                    background-color: #f97316 !important;
                    color: white !important;
                    border-radius: 9999px !important;
                    font-weight: 700 !important;
                  }
                  .day-ontime:hover {
                    background-color: #ea580c !important;
                  }
                  /* Red pulsing circle for overdue events (PRIORITY over green) */
                  .day-overdue {
                    background-color: #ef4444 !important;
                    color: white !important;
                    border-radius: 9999px !important;
                    font-weight: 700 !important;
                    animation: pulse-urgency 1.2s ease-in-out infinite;
                  }
                  .day-overdue:hover {
                    background-color: #dc2626 !important;
                  }
                `}</style>
                <Calendar
                  mode="single"
                  selected={currentTime}
                  onDayClick={(date) => {
                    const today = new Date();
                    const isToday = isSameDay(date, today);

                    const hasOverdueItem = agendaItems.some(item => 
                      isSameDay(parseISO(item.data_inicio), date) && 
                      !item.status && 
                      isBefore(startOfDay(parseISO(item.data_inicio)), startOfDay(today))
                    );

                    const hasPendingItem = agendaItems.some(item => 
                      isSameDay(parseISO(item.data_inicio), date) && !item.status
                    );

                    const hasAnyEvent = agendaItems.some(item => 
                      isSameDay(parseISO(item.data_inicio), date)
                    );

                    if (hasOverdueItem) {
                      navigate('/agenda?filter=overdue');
                    } else if (isToday) {
                      navigate('/agenda?filter=today');
                    } else if (hasPendingItem) {
                      navigate('/agenda?filter=pending');
                    } else if (hasAnyEvent) {
                      const formattedDate = date.toISOString().split('T')[0];
                      navigate(`/agenda?data=${formattedDate}`);
                    } else {
                      navigate('/agenda');
                    }
                  }}
                  className="rounded-2xl border-none p-4"
                  locale={ptBR}
                  modifiers={{
                    overdue: (date) => filteredAgendaItems.some(item => 
                      isSameDay(parseISO(item.data_inicio), date) && 
                      !item.status && 
                      isBefore(startOfDay(parseISO(item.data_inicio)), startOfDay(new Date()))
                    ),
                    ontime: (date) => {
                      const today = new Date();
                      // Exclude today — today always stays navy blue
                      if (isSameDay(date, today)) return false;
                      // Exclude overdue — red takes priority
                      const isOverdue = filteredAgendaItems.some(item => 
                        isSameDay(parseISO(item.data_inicio), date) && 
                        !item.status && 
                        isBefore(startOfDay(parseISO(item.data_inicio)), startOfDay(new Date()))
                      );
                      if (isOverdue) return false;
                      return filteredAgendaItems.some(item => 
                        isSameDay(parseISO(item.data_inicio), date) && !item.status
                      );
                    },
                  }}
                  classNames={{
                    day_selected: "bg-[#223c61] text-white hover:bg-[#223c61] hover:text-white focus:bg-[#223c61] focus:text-white rounded-full",
                    day_today: "bg-[#223c61] text-white font-extrabold rounded-full",
                    day: "h-9 w-9 p-0 font-medium hover:bg-[#223c61]/10 rounded-full transition-all flex items-center justify-center cursor-pointer",
                    cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                    head_cell: "text-muted-foreground font-medium w-9 text-[0.8rem] pb-2",
                  }}
                  modifiersClassNames={{
                    ontime: "day-ontime",
                    overdue: "day-overdue",
                  }}
                />
                <div className="px-4 pb-4 pt-2 border-t border-[#F1F5F9]">
                  <button 
                    onClick={() => navigate('/agenda')}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#223c61] text-white text-xs font-bold hover:bg-[#1a2e4b] transition-all shadow-md active:scale-95"
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Ver Agenda Completa
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Sync Button */}
          <button 
            onClick={() => {
              if(confirm('Deseja recarregar o sistema e forçar a busca de dados novos do banco?')) {
                localStorage.clear();
                window.location.reload();
              }
            }} 
            className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 flex items-center justify-center rounded-lg sm:rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] hover:text-[#223c61] hover:bg-white transition-all shadow-sm shrink-0 min-h-0 min-w-0"
            title="Forçar Sincronização"
          >
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5" />
          </button>

          {/* Notifications */}
          <Popover open={showNotif} onOpenChange={setShowNotif}>
            <PopoverTrigger asChild>
              <button 
                className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 flex items-center justify-center rounded-lg sm:rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] hover:text-[#223c61] hover:bg-white transition-all shadow-sm relative group min-h-0 min-w-0"
              >
                <Bell className={`h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5 ${naoLidas > 0 ? 'animate-bounce text-[#223c61]' : ''}`} />
                {naoLidas > 0 && (
                  <span className="absolute top-1 right-1 sm:top-2 sm:right-2 h-3.5 w-3.5 sm:h-4 sm:w-4 bg-red-500 text-white rounded-full text-[8px] sm:text-[9px] flex items-center justify-center font-bold border-2 border-white">
                    {naoLidas}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 border-none shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-200 z-[100]">
              <div className="bg-white border border-[#E2E8F0]">
                <div className="p-4 border-b border-[#F1F5F9] font-bold text-sm flex items-center justify-between text-[#223c61]">
                  <span>Notificações</span>
                  {notificacoes.length > 0 && (
                    <button onClick={excluirTodas} className="text-[10px] text-red-500 hover:underline">Limpar tudo</button>
                  )}
                </div>
                {notificacoes.length === 0 && unreadChatCount === 0 ? (
                  <div className="p-8 text-sm text-muted-foreground text-center">Nenhuma notificação nova</div>
                ) : (
                  <div className="divide-y divide-[#F1F5F9] max-h-96 overflow-y-auto">
                    {unreadChatCount > 0 && (
                      <div
                        className="p-4 cursor-pointer hover:bg-[#F8FAFC] transition-colors bg-[#223c61]/5"
                        onClick={() => { setShowNotif(false); navigate('/chat'); }}
                      >
                        <p className="font-bold text-xs text-[#223c61]">💬 Novas mensagens</p>
                        <p className="text-[11px] text-[#64748B] mt-1">{unreadChatCount} conversa(s) com mensagens novas</p>
                      </div>
                    )}
                    {[...notificacoes].slice(-10).reverse().map(n => (
                      <div
                        key={n.id}
                        className={`p-4 cursor-pointer hover:bg-[#F8FAFC] transition-colors ${!n.lida ? 'bg-[#223c61]/5' : ''}`}
                        onClick={() => handleNotifClick(n)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-xs text-[#223c61] truncate">{n.titulo}</p>
                            <p className="text-[11px] text-[#64748B] mt-1 line-clamp-2">{n.mensagem}</p>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); excluirNotif(n.id); }} className="p-1 rounded-lg hover:bg-red-50 text-red-400" title="Excluir">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Profile & Logout */}
          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 pl-1.5 sm:pl-2 lg:pl-3 border-l border-[#E2E8F0] shrink-0">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 sm:gap-2.5 bg-[#F8FAFC] hover:bg-white border border-[#E2E8F0] p-0.5 sm:p-1 h-8 sm:h-10 lg:h-12 rounded-lg sm:rounded-xl transition-all cursor-pointer min-h-0 min-w-0">
                    <Avatar className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 border border-white shadow-sm">
                      {currentUser?.foto ? <AvatarImage src={currentUser.foto} alt="" /> : null}
                      <AvatarFallback className="bg-[#223c61] text-white text-[10px] sm:text-xs lg:text-sm font-bold">
                        {currentUser?.nome?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:flex flex-row items-center pr-2 leading-none">
                      <p className="text-xs sm:text-sm font-bold text-[#223c61]">{currentUser?.nome?.split(' ')[0]}</p>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="md:hidden bg-[#223c61] text-white border-none text-[10px] font-bold py-1 px-2 mb-1">
                  {currentUser?.nome}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <button 
              onClick={() => {
                if (confirm('Deseja realmente sair do sistema?')) {
                  onLogout();
                }
              }}
              className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 flex items-center justify-center rounded-lg sm:rounded-xl bg-red-50 border border-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm shrink-0 min-h-0 min-w-0"
              title="Sair do Sistema"
            >
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
