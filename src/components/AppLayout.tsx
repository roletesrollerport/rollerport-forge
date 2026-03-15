import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, DollarSign, Users, Package, FileText,
  ShoppingCart, Factory, Warehouse, UserCog, Menu, X, ChevronRight,
  Bell, MessageSquare, Bot, LogOut, User, Eye, Trash2, MessageCircle, RefreshCw, Database,
  Calendar
} from 'lucide-react';
import { store } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import type { Usuario, PermissaoModulo } from '@/lib/types';
import logo from '@/assets/logo.png';
import ChatWidget from '@/components/ChatWidget';
import { toast } from 'sonner';
import { useUsuarios } from '@/hooks/useUsuarios';
import { usePresence } from '@/hooks/usePresence';
import { PresenceContext } from '@/contexts/PresenceContext';
import { RealTimeClock } from '@/components/RealTimeClock';
import { GlobalHeader } from '@/components/GlobalHeader';
  import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

const navItems: { to: string; label: string; icon: any; modulo: PermissaoModulo }[] = [
  { to: '/', label: 'Início', icon: Home, modulo: 'inicio' },
  { to: '/custos', label: 'Custos', icon: DollarSign, modulo: 'custos' },
  { to: '/clientes', label: 'Clientes', icon: Users, modulo: 'clientes' },
  { to: '/produtos', label: 'Produtos', icon: Package, modulo: 'produtos' },
  { to: '/orcamentos', label: 'Orçamentos', icon: FileText, modulo: 'orcamentos' },
  { to: '/pedidos', label: 'Pedidos', icon: ShoppingCart, modulo: 'pedidos' },
  { to: '/producao', label: 'Produção', icon: Factory, modulo: 'producao' },
  { to: '/estoque', label: 'Estoque', icon: Warehouse, modulo: 'estoque' },
  { to: '/chat', label: 'Bate-Papo', icon: MessageSquare, modulo: 'chat' },
  { to: '/ia', label: 'IA', icon: Bot, modulo: 'ia' },
  { to: '/usuarios', label: 'Usuários', icon: UserCog, modulo: 'usuarios' },
  { to: '/agenda', label: 'CRM Rollerport', icon: Calendar, modulo: 'agenda' },
  { to: '/gestao-dados', label: 'Gestão de Dados', icon: Database, modulo: 'gestao-dados' },
];

export default function AppLayout({ children, currentUser, onLogout }: { children: React.ReactNode; currentUser: Usuario; onLogout: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialUserId, setChatInitialUserId] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const autoCloseTimer = useRef<NodeJS.Timeout | null>(null);
  const { usuarios: allUsuarios } = useUsuarios();
  // Track presence for the current user (broadcasts to all subscribers)
  const { onlineUserIds } = usePresence(currentUser?.id || null);

  const notificacoes = store.getNotificacoes();
  const naoLidas = notificacoes.filter(n => !n.lida).length + unreadChatCount;

  // Auto-close notification popup after 5 seconds
  useEffect(() => {
    if (showNotif) {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
      autoCloseTimer.current = setTimeout(() => setShowNotif(false), 5000);
    }
    return () => { if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current); };
  }, [showNotif]);

  // Poll for unread chat messages
  const checkUnreadMessages = useCallback(async () => {
    if (!currentUser?.id) return;
    const readKey = `rp_chat_read_${currentUser.id}`;
    const lastRead = localStorage.getItem(readKey);
    const lastReadTime = lastRead ? new Date(lastRead).getTime() : 0;
    const { data: recentData } = await supabase
      .from('chat_messages' as any)
      .select('id, sender_id, created_at')
      .neq('sender_id', currentUser.id)
      .eq('deleted_for_all', false)
      .gt('created_at', new Date(lastReadTime).toISOString());
    if (recentData) {
      const uniqueSenders = new Set((recentData as any[]).map(m => m.sender_id));
      setUnreadChatCount(uniqueSenders.size);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    checkUnreadMessages();
    const interval = setInterval(checkUnreadMessages, 10000);
    return () => clearInterval(interval);
  }, [checkUnreadMessages]);

  // Mark chat as read when chat widget is open or navigating to chat page
  useEffect(() => {
    if ((location.pathname === '/chat' || chatOpen) && currentUser?.id) {
      localStorage.setItem(`rp_chat_read_${currentUser.id}`, new Date().toISOString());
      setUnreadChatCount(0);
    }
  }, [location.pathname, chatOpen, currentUser?.id]);

  // Realtime subscription for new messages - with toast notifications
  useEffect(() => {
    if (!currentUser?.id) return;
    const channel = supabase
      .channel('chat-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, (payload: any) => {
        const msg = payload.new;
        if (msg?.sender_id !== currentUser.id && location.pathname !== '/chat') {
          if (!chatOpen) {
            setUnreadChatCount(prev => prev + 1);
          }
          // Show toast notification with sender info
          const sender = allUsuarios.find(u => u.id === msg.sender_id);
          if (sender) {
            const preview = msg.message_type === 'text'
              ? (msg.content?.substring(0, 60) + (msg.content?.length > 60 ? '...' : ''))
              : msg.message_type === 'audio' ? '🎤 Mensagem de áudio' : `📎 ${msg.file_name || 'Arquivo'}`;
            toast(
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => {
                setChatInitialUserId(msg.sender_id);
                setChatOpen(true);
              }}>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {sender.foto ? <img src={sender.foto} alt="" className="h-full w-full object-cover" /> : <User className="h-4 w-4 text-primary" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{sender.nome}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{preview}</p>
                </div>
              </div>,
              { duration: 5000 }
            );
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id, location.pathname, chatOpen, allUsuarios]);

  // Handle global event to open chat with specific user
  useEffect(() => {
    const handleOpenChat = (e: any) => {
      const { userId } = e.detail || {};
      if (userId) {
        setChatInitialUserId(userId);
        setChatOpen(true);
      } else {
        setChatOpen(true);
      }
    };
    window.addEventListener('rp-open-chat' as any, handleOpenChat);
    return () => window.removeEventListener('rp-open-chat' as any, handleOpenChat);
  }, []);

  const fullAccessRoles = ['master', 'SEO', 'admin', 'Admin', 'Administrador', 'administrador', 'adm/dono'];
  const isFullAccess = fullAccessRoles.includes(currentUser.nivel);
  
  const allModulos: PermissaoModulo[] = ['inicio','custos','clientes','produtos','orcamentos','pedidos','producao','estoque','chat','ia','usuarios', 'agenda', 'gestao-dados'];
  const userPerms = currentUser.permissoes?.ver || allModulos;

  const visibleNavItems = isFullAccess
    ? navItems
    : navItems.filter(item => {
        // Restricted roles (Vendas, Estoque, Produção)
        if (item.modulo === 'chat') return true;
        if (item.modulo === 'agenda') return true;
        if (item.modulo === 'inicio') return true;
        
        // Block sensitive modules for non-full-access users
        if (['usuarios', 'gestao-dados', 'custos'].includes(item.modulo)) return false;
        
        // Filter based on specific user permissions if available
        return userPerms.includes(item.modulo);
      });

  // Generate birthday notifications
  useEffect(() => {
    const clientes = store.getClientes();
    const hoje = new Date();
    const em3dias = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000);
    const notifs = store.getNotificacoes();
    clientes.forEach(c => {
      if (c.aniversarioEmpresa) {
        const aniv = new Date(c.aniversarioEmpresa);
        aniv.setFullYear(hoje.getFullYear());
        if (aniv >= hoje && aniv <= em3dias) {
          const jaExiste = notifs.find(n => n.titulo.includes(c.nome) && n.tipo === 'aniversario');
          if (!jaExiste) {
            notifs.push({ id: store.nextId('notif'), tipo: 'aniversario', titulo: `Aniversário: ${c.nome}`, mensagem: `A empresa ${c.nome} faz aniversário em ${c.aniversarioEmpresa}`, lida: false, createdAt: new Date().toISOString() });
          }
        }
      }
      c.compradores?.forEach(comp => {
        if (comp.aniversario) {
          const aniv = new Date(comp.aniversario);
          aniv.setFullYear(hoje.getFullYear());
          if (aniv >= hoje && aniv <= em3dias) {
            const jaExiste = notifs.find(n => n.titulo.includes(comp.nome) && n.tipo === 'aniversario');
            if (!jaExiste) {
              notifs.push({ id: store.nextId('notif'), tipo: 'aniversario', titulo: `Aniversário: ${comp.nome}`, mensagem: `O comprador ${comp.nome} (${c.nome}) faz aniversário em ${comp.aniversario}`, lida: false, createdAt: new Date().toISOString() });
            }
          }
        }
      });
    });
    store.saveNotificacoes(notifs);
  }, []);

  const getNotifRoute = (tipo: string) => {
    switch (tipo) {
      case 'chat': return '/chat';
      case 'pedido': return '/pedidos';
      case 'producao': return '/producao';
      case 'aniversario': return '/clientes';
      default: return '/';
    }
  };

  const handleNotifClick = (n: import('@/lib/types').Notificacao) => {
    const updated = notificacoes.map(x => x.id === n.id ? { ...x, lida: true } : x);
    store.saveNotificacoes(updated);
    setShowNotif(false);
    // If it's a chat notification, open the chat widget instead of navigating
    if (n.tipo === 'chat') {
      setChatOpen(true);
      return;
    }
    navigate(getNotifRoute(n.tipo));
  };

  const excluirNotif = (id: string) => {
    const updated = notificacoes.filter(n => n.id !== id);
    store.saveNotificacoes(updated);
  };

  const excluirTodas = () => { store.saveNotificacoes([]); };

  const handleBellClick = () => {
    setShowNotif(!showNotif);
    if (!showNotif && notificacoes.some(n => !n.lida)) {
      const updated = notificacoes.map(n => ({ ...n, lida: true }));
      store.saveNotificacoes(updated);
    }
    if (!showNotif && unreadChatCount > 0) {
      localStorage.setItem(`rp_chat_read_${currentUser.id}`, new Date().toISOString());
      setUnreadChatCount(0);
    }
  };

  const mobileNavItems = [
    { to: '/', label: 'Início', icon: Home },
    { to: '/pedidos', label: 'Pedidos', icon: ShoppingCart },
    { to: '/producao', label: 'Produção', icon: Factory },
    { to: '/agenda', label: 'CRM Rollerport', icon: Calendar },
    { to: '/chat', label: 'Bate-Papo', icon: MessageSquare },
    { to: '/clientes', label: 'Clientes', icon: Users },
    { to: '/orcamentos', label: 'Orçamentos', icon: FileText },
  ];

  return (
    <div className="flex bg-[#F1F5F9] h-screen overflow-hidden p-[10px] gap-[10px] relative">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex flex-col bg-white border border-[#E2E8F0] w-[92px] rounded-2xl shadow-sm z-50 h-full shrink-0 overflow-hidden">

        <TooltipProvider delayDuration={0}>
          <nav className="flex-1 overflow-y-auto px-2 pt-[15px] gap-[10px] flex flex-col items-center">
            {visibleNavItems.map(item => {
              const active = item.modulo === 'chat' ? false : (location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to)));
              
              const NavItem = (
                <div className={`
                  p-2.5 rounded-2xl transition-all duration-200
                  ${active 
                    ? 'bg-[#223c61]/10 text-[#223c61]' 
                    : 'text-[#223c61] hover:bg-[#223c61]/10'
                  }
                `}>
                  <item.icon className="h-[22px] w-[22px]" />
                </div>
              );

              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    {item.modulo === 'chat' ? (
                      <button
                        onClick={() => { setChatOpen(true); }}
                        className="relative"
                      >
                        {NavItem}
                        {unreadChatCount > 0 && (
                          <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold border-2 border-[#F8FAFC]">
                            {unreadChatCount}
                          </span>
                        )}
                      </button>
                    ) : (
                      <Link
                        to={item.to}
                      >
                        {NavItem}
                      </Link>
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-[#223c61] text-white border-none text-xs font-bold py-1 px-3 ml-2">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </TooltipProvider>

        <div className="py-4 border-t border-[#E2E8F0] opacity-0 pointer-events-none shrink-0">
          {/* Espaçador */}
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 border-none w-[92px] bg-[#F8FAFC] [&>button:last-child]:hidden">
          <div className="flex flex-col h-full">
            {/* Header with styled close button and Menu title */}
            <div className="flex flex-col items-center pt-6 pb-4 border-b border-[#E2E8F0] bg-white gap-4 shrink-0">
              <SheetClose className="h-9 w-9 flex items-center justify-center rounded-full bg-[#223c61] text-white shadow-lg hover:bg-[#1a2e4b] transition-all hover:rotate-90 active:scale-90">
                <X className="h-5 w-5" />
              </SheetClose>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-[0.2em] opacity-50 leading-none">Menu</span>
            </div>
            <TooltipProvider delayDuration={0}>
              <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1 flex flex-col items-center">
                {visibleNavItems.map(item => {
                  const active = item.modulo === 'chat' ? false : (location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to)));
                  
                  const NavItem = (
                    <div className={`
                      p-2.5 rounded-2xl transition-all duration-200
                      ${active 
                        ? 'bg-[#223c61]/10 text-[#223c61]' 
                        : 'text-[#223c61] hover:bg-[#223c61]/10'
                      }
                    `}>
                      <item.icon className="h-[22px] w-[22px]" />
                    </div>
                  );

                  return (
                    <Tooltip key={item.to}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            if (item.modulo === 'chat') {
                              setChatOpen(true);
                            } else {
                              navigate(item.to);
                            }
                            setMobileOpen(false);
                          }}
                          className="relative"
                        >
                          {NavItem}
                          {item.modulo === 'chat' && unreadChatCount > 0 && (
                            <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold border-2 border-[#F8FAFC]">
                              {unreadChatCount}
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="bg-[#223c61] text-white border-none text-xs font-bold py-1 px-3 ml-2">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </nav>
            </TooltipProvider>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0 gap-[10px] h-full">
        <GlobalHeader 
          currentUser={currentUser}
          naoLidas={naoLidas}
          unreadChatCount={unreadChatCount}
          onLogout={onLogout}
          onMenuOpen={() => setMobileOpen(true)}
        />
        <PresenceContext.Provider value={{ onlineUserIds }}>
          <main className="flex-1 overflow-y-auto p-[10px] animate-fade-in relative bg-white border border-[#E2E8F0] rounded-2xl shadow-sm">
            {children}
          </main>
        </PresenceContext.Provider>
      </div>

      {/* Chat Widget */}
      <ChatWidget
        isOpen={chatOpen}
        onToggle={() => setChatOpen(false)}
        initialUserId={chatInitialUserId}
        onClearInitialUser={() => setChatInitialUserId(null)}
      />
    </div>
  );
}
