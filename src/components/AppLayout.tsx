import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, DollarSign, Users, Package, FileText,
  ShoppingCart, Factory, Warehouse, UserCog, Menu, X, ChevronRight
} from 'lucide-react';
import logo from '@/assets/logo.png';

const navItems = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/custos', label: 'Custos', icon: DollarSign },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/produtos', label: 'Produtos', icon: Package },
  { to: '/orcamentos', label: 'Orçamentos', icon: FileText },
  { to: '/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { to: '/producao', label: 'Produção', icon: Factory },
  { to: '/estoque', label: 'Estoque', icon: Warehouse },
  { to: '/usuarios', label: 'Usuários', icon: UserCog },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

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
          <img src={logo} alt="Rollerport" className="h-10 w-10 object-contain flex-shrink-0" />
          {!collapsed && <span className="text-lg font-bold tracking-tight text-sidebar-foreground">ROLLERPORT</span>}
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map(item => {
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
          <span className="text-xs text-muted-foreground font-mono">ERP v1.0</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
