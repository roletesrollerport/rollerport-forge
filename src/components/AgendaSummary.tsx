import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, ListTodo, Eye, AlertTriangle, TrendingUp } from "lucide-react";
import { AgendaItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isPast, format, isSameDay, startOfDay, isBefore, parseISO } from "date-fns";
import type { Usuario } from "@/lib/types";

interface AgendaSummaryProps {
  items: AgendaItem[];
  currentUser?: { nome: string; nivel: string };
  currentFilter?: 'all' | 'today' | 'pending' | 'completed' | 'overdue';
  onFilter?: (filter: 'all' | 'today' | 'pending' | 'completed' | 'overdue') => void;
}

export function AgendaSummary({ items, currentUser, currentFilter = 'all', onFilter }: AgendaSummaryProps) {
  const now = new Date();
  
  const nameMatch = (vendedorField: string, userName: string) => {
    const a = (vendedorField || '').trim().toLowerCase();
    const b = (userName || '').trim().toLowerCase();
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a) || a.split(' ')[0] === b.split(' ')[0];
  };

  const filteredItems = items.filter(item => {
    if (!currentUser) return false;
    const fullAccessRoles = ['master', 'SEO', 'admin', 'Admin', 'Administrador', 'administrador', 'adm/dono'];
    if (fullAccessRoles.includes(currentUser.nivel)) return true;
    return nameMatch(item.vendedor || '', currentUser.nome || '');
  });

  const todayStr = format(now, 'yyyy-MM-dd');
  const todayItems = filteredItems.filter(item => isSameDay(parseISO(item.data_inicio), now));
  
  const totalToday = todayItems.length;
  const completedToday = todayItems.filter(item => item.status).length;
  const pendingTotal = filteredItems.filter(item => !item.status).length;
  const overdueTotal = filteredItems.filter(item => 
    !item.status && isBefore(startOfDay(parseISO(item.data_inicio)), startOfDay(now))
  ).length;

  const handleFilterClick = (filter: 'all' | 'today' | 'pending' | 'completed' | 'overdue') => {
    if (onFilter) {
      onFilter(currentFilter === filter ? 'all' : filter);
    }
  };

  const cards = [
    {
      key: 'today' as const,
      label: 'Hoje',
      value: totalToday,
      icon: ListTodo,
      btnLabel: 'Ver Todas',
      active: { border: 'border-primary', bg: 'bg-primary/5', iconBg: 'bg-primary/15', iconColor: 'text-primary' },
      idle: { border: 'border-transparent', bg: 'bg-card', iconBg: 'bg-muted/60', iconColor: 'text-muted-foreground' },
      btnClass: 'hover:bg-primary hover:text-primary-foreground text-primary',
      valueColor: 'text-foreground',
    },
    {
      key: 'pending' as const,
      label: 'Pendentes',
      value: pendingTotal,
      icon: Clock,
      btnLabel: 'Ver Lista',
      active: { border: 'border-orange-400', bg: 'bg-orange-50', iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
      idle: { border: 'border-transparent', bg: 'bg-card', iconBg: 'bg-orange-50', iconColor: 'text-orange-400' },
      btnClass: 'hover:bg-orange-500 hover:text-white text-orange-600',
      valueColor: 'text-orange-600',
    },
    {
      key: 'completed' as const,
      label: 'Concluídas',
      value: completedToday,
      icon: CheckCircle2,
      btnLabel: 'Ver Lista',
      active: { border: 'border-emerald-400', bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
      idle: { border: 'border-transparent', bg: 'bg-card', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-400' },
      btnClass: 'hover:bg-emerald-500 hover:text-white text-emerald-600',
      valueColor: 'text-emerald-600',
    },
    {
      key: 'overdue' as const,
      label: 'Em Atraso',
      value: overdueTotal,
      icon: AlertTriangle,
      btnLabel: 'Ver Atrasados',
      active: { border: 'border-destructive', bg: 'bg-destructive/5', iconBg: 'bg-destructive/15', iconColor: 'text-destructive' },
      idle: { border: 'border-transparent', bg: 'bg-card', iconBg: 'bg-destructive/10', iconColor: 'text-destructive/60' },
      btnClass: 'hover:bg-destructive hover:text-destructive-foreground text-destructive',
      valueColor: 'text-destructive',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(card => {
        const isActive = currentFilter === card.key;
        const style = isActive ? card.active : card.idle;
        const Icon = card.icon;

        return (
          <Card
            key={card.key}
            className={cn(
              "relative overflow-hidden transition-all duration-300 border-2 cursor-pointer group",
              style.border, style.bg,
              isActive && "shadow-lg ring-1 ring-black/5",
              !isActive && "hover:shadow-md hover:border-border"
            )}
            onClick={() => handleFilterClick(card.key)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center transition-colors", style.iconBg)}>
                  <Icon className={cn("h-4.5 w-4.5", style.iconColor)} />
                </div>
                {card.key === 'overdue' && card.value > 0 && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{card.label}</p>
                <div className="flex items-end justify-between">
                  <span className={cn("text-3xl font-extrabold tracking-tight", card.valueColor)}>
                    {card.value}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 text-[10px] gap-1 font-bold uppercase tracking-wider rounded-lg transition-all",
                      card.btnClass
                    )}
                    onClick={(e) => { e.stopPropagation(); handleFilterClick(card.key); }}
                  >
                    <Eye className="h-3 w-3" /> {card.btnLabel}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
