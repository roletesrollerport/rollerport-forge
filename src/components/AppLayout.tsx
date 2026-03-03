import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, DollarSign, Users, Package, FileText,
  ShoppingCart, Factory, Warehouse, UserCog, Menu, X, ChevronRight,
  Bell, MessageSquare, Bot, LogOut, User, Eye, Trash2
} from 'lucide-react';
import { store } from '@/lib/store';
import type { Usuario, PermissaoModulo } from '@/lib/types';
import logo from '@/assets/logo.png';

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
];

export default function AppLayout({ children, currentUser, onLogout }: { children: React.ReactNode; currentUser: Usuario; onLogout: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [viewNotif, setViewNotif] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const notificacoes = store.getNotificacoes();
  const naoLidas = notificacoes.filter(n => !n.lida).length;

  const isMaster = currentUser.nivel === 'master';
  // If no permissions set, default to all modules (backwards compatibility)
  const allModulos: import('@/lib/types').PermissaoModulo[] = ['inicio','custos','clientes','produtos','orcamentos','pedidos','producao','estoque','chat','ia','usuarios'];
  const userPerms = currentUser.permissoes?.ver || allModulos;

  // Filter nav items based on permissions (master sees all)
  const visibleNavItems = isMaster
    ? navItems
    : navItems.filter(item => {
        if (item.modulo === 'chat') return true;
        if (item.modulo === 'usuarios') return false;
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
            notifs.push({
              id: store.nextId('notif'),
              tipo: 'aniversario',
              titulo: `Aniversário: ${c.nome}`,
              mensagem: `A empresa ${c.nome} faz aniversário em ${c.aniversarioEmpresa}`,
              lida: false,
              createdAt: new Date().toISOString(),
            });
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
              notifs.push({
                id: store.nextId('notif'),
                tipo: 'aniversario',
                titulo: `Aniversário: ${comp.nome}`,
                mensagem: `O comprador ${comp.nome} (${c.nome}) faz aniversário em ${comp.aniversario}`,
                lida: false,
                createdAt: new Date().toISOString(),
              });
            }
          }
        }
      });
    });
    store.saveNotificacoes(notifs);
  }, []);

  const marcarLida = (id: string) => {
    const updated = notificacoes.map(n => n.id === id ? { ...n, lida: true } : n);
    store.saveNotificacoes(updated);
  };

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
    marcarLida(n.id);
    setShowNotif(false);
    setViewNotif(null);
    navigate(getNotifRoute(n.tipo));
  };

  const excluirNotif = (id: string) => {
    const updated = notificacoes.filter(n => n.id !== id);
    store.saveNotificacoes(updated);
    setViewNotif(null);
  };

  const excluirTodas = () => {
    store.saveNotificacoes([]);
    setViewNotif(null);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        flex flex-col bg-sidebar text-sidebar-foreground
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-60'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center gap-3 px-3 py-4 border-b border-sidebar-border">
          <img src={logo} alt="Rollerport" className="h-14 w-14 object-contain flex-shrink-0" />
          {!collapsed && <span className="text-lg font-bold tracking-tight text-sidebar-foreground">ROLLERPORT</span>}
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {visibleNavItems.map(item => {
            const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 mx-2 px-3 py-2.5 rounded-md text-sm font-medium
                  transition-colors duration-150
                  ${active
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }
                `}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center py-3 border-t border-sidebar-border text-sidebar-muted hover:text-sidebar-foreground transition-colors"
        >
          <ChevronRight className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-4 h-14 px-4 border-b bg-card shrink-0">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />

          {/* Notification Bell */}
          <div className="relative">
            <button onClick={() => setShowNotif(!showNotif)} className="relative p-2 rounded-md hover:bg-muted transition-colors">
              <Bell className="h-5 w-5" />
              {naoLidas > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-destructive text-destructive-foreground rounded-full text-[10px] flex items-center justify-center font-bold">
                  {naoLidas}
                </span>
              )}
            </button>
            {showNotif && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-card border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                <div className="p-3 border-b font-semibold text-sm flex items-center justify-between">
                  <span>Notificações</span>
                  {notificacoes.length > 0 && (
                    <button onClick={excluirTodas} className="text-[10px] text-destructive hover:underline">Limpar tudo</button>
                  )}
                </div>
                {viewNotif ? (() => {
                  const n = notificacoes.find(x => x.id === viewNotif);
                  if (!n) { setViewNotif(null); return null; }
                  return (
                    <div className="p-4 space-y-2">
                      <button onClick={() => setViewNotif(null)} className="text-xs text-primary hover:underline">← Voltar</button>
                      <p className="font-semibold text-sm">{n.titulo}</p>
                      <p className="text-xs text-muted-foreground">{n.mensagem}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString('pt-BR')}</p>
                      <button onClick={() => excluirNotif(n.id)} className="flex items-center gap-1 text-xs text-destructive hover:underline mt-2">
                        <Trash2 className="h-3 w-3" /> Excluir
                      </button>
                    </div>
                  );
                })() : (
                  notificacoes.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">Nenhuma notificação</div>
                  ) : (
                    notificacoes.slice(-10).reverse().map(n => (
                      <div
                        key={n.id}
                        className={`p-3 border-b last:border-0 text-sm cursor-pointer hover:bg-muted/50 ${!n.lida ? 'bg-primary/5' : ''}`}
                        onClick={() => handleNotifClick(n)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs truncate">{n.titulo}</p>
                            <p className="text-xs text-muted-foreground truncate">{n.mensagem}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={(e) => { e.stopPropagation(); excluirNotif(n.id); }} className="p-1 rounded hover:bg-muted text-destructive" title="Excluir">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {currentUser.foto ? <img src={currentUser.foto} alt="" className="h-full w-full object-cover" /> : <User className="h-4 w-4 text-muted-foreground" />}
              </div>
              <span className="text-xs font-medium hidden sm:block">{currentUser.nome}</span>
            </div>
            <button onClick={onLogout} className="p-2 rounded-md hover:bg-muted transition-colors" title="Sair">
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
