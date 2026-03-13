import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import { store } from '@/lib/store';
import { AgendaItem, TipoCompromisso } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Calendar as CalendarIcon, 
  Filter, 
  Printer, 
  Briefcase, 
  Phone, 
  Truck, 
  History,
  Bell,
  AlertCircle,
  Zap,
  Target,
  Clock,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { AgendaModal } from '@/components/AgendaModal';
import { AgendaSummary } from '@/components/AgendaSummary';
import { AgendaDetailsSheet } from '@/components/AgendaDetailsSheet';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { isPast, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { IAHunterModal } from '@/components/IAHunterModal';
import { EstrategiaFocoModal } from '@/components/EstrategiaFocoModal';
import { addDays, startOfWeek, setDay } from 'date-fns';

const TYPE_COLORS: Record<TipoCompromisso, string> = {
  'Visita Técnica': '#f59e0b',
  'Ligação': '#3b82f6',
  'Retorno de Orçamento': '#8b5cf6',
  'Entrega de Roletes': '#10b981',
};

const TYPE_ICONS: Record<TipoCompromisso, any> = {
  'Visita Técnica': Briefcase,
  'Ligação': Phone,
  'Retorno de Orçamento': History,
  'Entrega de Roletes': Truck,
};

export default function AgendaPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // IA Hunter States
  const [iaHunterOpen, setIaHunterOpen] = useState(false);
  const [estrategiaFocoOpen, setEstrategiaFocoOpen] = useState(false);

  const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null);
  const [editingItem, setEditingItem] = useState<AgendaItem | undefined>();
  const [initialDate, setInitialDate] = useState<Date | undefined>();
  const [filterTypes, setFilterTypes] = useState<TipoCompromisso[]>(['Visita Técnica', 'Ligação', 'Retorno de Orçamento', 'Entrega de Roletes']);
  const [agendaFilter, setAgendaFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const loadData = () => {
      setLoading(true);
      const data = store.getAgenda();
      setItems(data);
      setLoading(false);
    };

    loadData();
    window.addEventListener('rp-data-synced', loadData);
    return () => window.removeEventListener('rp-data-synced', loadData);
  }, []);

  const handleAgendarLead = (lead: any, targetDayOfWeek: number) => {
    // Calculates the date for the target day in the CURRENT week
    const now = new Date();
    let targetDate = setDay(startOfWeek(now, { weekStartsOn: 0 }), targetDayOfWeek);
    
    // If that day has already passed this week, schedule for next week
    if (isPast(targetDate) && targetDate.getDate() !== now.getDate()) {
       targetDate = addDays(targetDate, 7);
    }
    
    // Set Time to 09:00 AM
    targetDate.setHours(9, 0, 0, 0);

    const newItem: AgendaItem = {
      id: crypto.randomUUID(),
      titulo: `Prospecção: ${lead.empresa}`,
      descricao: `Contato inicial com ${lead.empresa}.\nSetor: ${lead.setor}\nLocal: ${lead.localizacao}\nContato: (Agente IA buscou as redês: ${lead.contato})`,
      tipo: 'Ligação',
      data_inicio: targetDate.toISOString(),
      data_fim: addDays(targetDate, 0).setHours(10, 0, 0, 0).toString(), // 1 hour duration
      status: false,
      createdAt: new Date().toISOString()
    };

    const updated = [...items, newItem];
    setItems(updated);
    store.saveAgenda(updated);
    toast.success('Lead agendado com sucesso!');
    
    // Refresh calendar view
    if (calendarRef.current) {
       calendarRef.current.getApi().gotoDate(targetDate);
       calendarRef.current.getApi().changeView('timeGridDay');
    }
    
    setIaHunterOpen(false);
  };

  // Handle follow-up from other pages
  useEffect(() => {
    if (location.state?.followUp) {
      const { clienteId, orcNumero } = location.state.followUp;
      setEditingItem({
        id: '',
        titulo: `Follow-up Orçamento ${orcNumero}`,
        descricao: `Retorno sobre o orçamento ${orcNumero}`,
        tipo: 'Retorno de Orçamento',
        cliente_id: clienteId,
        data_inicio: new Date().toISOString(),
        data_fim: new Date(Date.now() + 30 * 60000).toISOString(),
        status: false
      } as any);
      setInitialDate(new Date());
      setModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const dateParam = searchParams.get('data');
    if (dateParam && calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(dateParam);
      calendarApi.changeView('timeGridDay');
    }
  }, [searchParams]);

  const overdueItems = useMemo(() => {
    return items.filter(item => !item.status && isPast(new Date(item.data_inicio)));
  }, [items]);

  const overdueCount = overdueItems.length;

  const handleShowOverdue = () => {
    setAgendaFilter('overdue');
    if (calendarRef.current) {
      calendarRef.current.getApi().changeView('listWeek');
    }
  };

  const handleDateClick = (arg: any) => {
    setInitialDate(arg.date);
    setEditingItem(undefined);
    setModalOpen(true);
  };

  const handleEventClick = (arg: any) => {
    const item = items.find(i => i.id === arg.event.id);
    if (item) {
      setSelectedItem(item);
      setDetailsOpen(true);
    }
  };

  const handleSave = (item: AgendaItem) => {
    let updated;
    const existing = items.find(i => i.id === item.id);
    if (existing) {
      updated = items.map(i => i.id === item.id ? item : i);
      toast.success('Compromisso atualizado!');
    } else {
      updated = [...items, item];
      toast.success('Compromisso criado!');
    }
    setItems(updated);
    store.saveAgenda(updated);
    if (selectedItem?.id === item.id) setSelectedItem(item);
  };

  const handleDelete = (id: string) => {
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
    store.saveAgenda(updated);
    toast.success('Compromisso removido!');
  };

  const handleToggleComplete = (item: AgendaItem) => {
    const updatedItem = { ...item, status: !item.status };
    const updated = items.map(i => i.id === item.id ? updatedItem : i);
    setItems(updated);
    store.saveAgenda(updated);
    setSelectedItem(updatedItem);
    toast.success(updatedItem.status ? 'Compromisso concluído!' : 'Compromisso marcado como pendente.');
  };

  const filteredEvents = items
    .filter(item => filterTypes.includes(item.tipo))
    .filter(item => {
      if (agendaFilter === 'pending') return !item.status;
      if (agendaFilter === 'completed') return item.status;
      if (agendaFilter === 'overdue') return !item.status && isPast(new Date(item.data_inicio));
      return true;
    })
    .map(item => ({
      id: item.id,
      title: item.titulo,
      start: item.data_inicio,
      end: item.data_fim,
      backgroundColor: TYPE_COLORS[item.tipo],
      borderColor: TYPE_COLORS[item.tipo],
      extendedProps: { ...item },
      className: cn("transition-opacity duration-200", item.status ? 'opacity-50' : 'opacity-100'),
    }));

  const toggleFilter = (type: TipoCompromisso) => {
    setFilterTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between flex-wrap gap-4 no-print">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
            <Target className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-foreground">CRM Rollerport</h1>
              <Badge variant="secondary" className="text-[10px] h-5 font-bold uppercase tracking-wider gap-1 bg-secondary/15 text-secondary border-0">
                <Zap className="h-3 w-3" /> Pro
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Pipeline comercial · Compromissos · Follow-ups</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* IA HUNTER BUTTONS */}
          <Button 
            onClick={() => setIaHunterOpen(true)}
            size="sm" 
            className="gap-2 h-9 rounded-xl text-xs font-bold shadow-md shadow-primary/20"
          >
            <Sparkles className="h-4 w-4" />
            Agente de Prospecção IA
          </Button>
          
          <Button 
            onClick={() => setEstrategiaFocoOpen(true)}
            variant="outline"
            size="sm" 
            className="gap-2 h-9 rounded-xl text-xs font-bold text-primary hover:bg-primary hover:text-white border-primary/20 transition-colors"
          >
            <Target className="h-4 w-4" />
            Estratégia de Foco
          </Button>

          <div className="h-6 w-px bg-border mx-1" />
          {/* Bell / Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn(
                "relative h-9 w-9 rounded-xl flex items-center justify-center transition-all",
                overdueCount > 0 
                  ? "bg-destructive/10 hover:bg-destructive/20" 
                  : "bg-muted/50 hover:bg-muted"
              )}>
                <Bell className={cn("h-4.5 w-4.5", overdueCount > 0 ? "text-destructive" : "text-muted-foreground")} />
                {overdueCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-sm">
                    {overdueCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="p-3 border-b bg-destructive/5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    Compromissos Atrasados
                  </h4>
                  <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                    {overdueCount}
                  </span>
                </div>
              </div>
              {overdueItems.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum compromisso atrasado 🎉
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y">
                  {overdueItems.slice(0, 8).map(item => {
                    const Icon = TYPE_ICONS[item.tipo] || CalendarIcon;
                    return (
                      <button
                        key={item.id}
                        className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          setSelectedItem(item);
                          setDetailsOpen(true);
                        }}
                      >
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: TYPE_COLORS[item.tipo] + '20' }}>
                          <Icon className="h-4 w-4" style={{ color: TYPE_COLORS[item.tipo] }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate text-foreground">{item.titulo}</p>
                          <p className="text-[11px] text-destructive font-medium">
                            {format(new Date(item.data_inicio), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </p>
                          {item.clienteNome && (
                            <p className="text-[11px] text-muted-foreground truncate">{item.clienteNome}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {overdueCount > 0 && (
                <div className="p-2 border-t">
                  <Button size="sm" variant="ghost" className="w-full h-8 text-xs font-bold text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={handleShowOverdue}>
                    Ver todos os atrasados
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Overdue badge - clickable */}
          {overdueCount > 0 && (
            <button
              onClick={handleShowOverdue}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-xl text-xs font-bold border border-destructive/20 hover:bg-destructive hover:text-destructive-foreground transition-all"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              {overdueCount} {overdueCount === 1 ? 'ATRASADO' : 'ATRASADOS'}
            </button>
          )}

          <div className="h-6 w-px bg-border mx-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-9 rounded-xl text-xs font-semibold">
                <Filter className="h-3.5 w-3.5" /> Filtros
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipos de Compromisso</div>
              <DropdownMenuSeparator />
              {(['Visita Técnica', 'Ligação', 'Retorno de Orçamento', 'Entrega de Roletes'] as TipoCompromisso[]).map(type => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={filterTypes.includes(type)}
                  onCheckedChange={() => toggleFilter(type)}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] }} />
                    {type}
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 no-print h-9 rounded-xl text-xs font-semibold">
            <Printer className="h-3.5 w-3.5" />
          </Button>

          <Button size="sm" onClick={() => { setEditingItem(undefined); setInitialDate(new Date()); setModalOpen(true); }} className="gap-2 h-9 rounded-xl text-xs font-semibold shadow-md shadow-primary/20">
            <Plus className="h-3.5 w-3.5" /> Novo
          </Button>
        </div>
      </div>

      {/* ===== SUMMARY CARDS ===== */}
      <AgendaSummary items={items} onFilter={(f) => {
        setAgendaFilter(f);
        if (calendarRef.current) {
          calendarRef.current.getApi().changeView('listWeek');
        }
      }} currentFilter={agendaFilter} />

      {/* ===== ACTIVE FILTER INDICATOR ===== */}
      {agendaFilter !== 'all' && (
        <div className="flex items-center gap-2">
          <div className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border",
            agendaFilter === 'pending' && "bg-orange-50 text-orange-700 border-orange-200",
            agendaFilter === 'completed' && "bg-emerald-50 text-emerald-700 border-emerald-200",
            agendaFilter === 'overdue' && "bg-destructive/10 text-destructive border-destructive/20"
          )}>
            {agendaFilter === 'pending' && <><Clock className="h-3 w-3" /> Mostrando: Pendentes</>}
            {agendaFilter === 'completed' && <><CheckCircle2 className="h-3 w-3" /> Mostrando: Concluídas</>}
            {agendaFilter === 'overdue' && <><AlertCircle className="h-3 w-3" /> Mostrando: Atrasados</>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs font-semibold"
            onClick={() => {
              setAgendaFilter('all');
              if (calendarRef.current) calendarRef.current.getApi().changeView('dayGridMonth');
            }}
          >
            Limpar filtro
          </Button>
        </div>
      )}

      {/* ===== CALENDAR ===== */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm calendar-container print:border-0 print:shadow-none print:p-0">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
          }}
          locale={ptBrLocale}
          events={filteredEvents}
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          nowIndicator={true}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          height="auto"
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
            hour12: false
          }}
          eventContent={(arg) => {
            const isCompleted = arg.event.extendedProps.status;
            const type = arg.event.extendedProps.tipo as TipoCompromisso;
            const Icon = TYPE_ICONS[type] || CalendarIcon;
            const isOverdue = !isCompleted && isPast(new Date(arg.event.extendedProps.data_inicio));

            return (
              <div className={cn(
                "px-1.5 py-1 text-[10px] sm:text-xs overflow-hidden truncate font-medium flex items-center gap-1.5",
                isCompleted && "line-through text-white/60",
                isOverdue && "animate-pulse"
              )}>
                <Icon className="h-3 w-3 flex-shrink-0" />
                <div className="truncate">
                  <span className="font-bold opacity-80 mr-1">{arg.timeText}</span>
                  {arg.event.title}
                </div>
                {isOverdue && <AlertCircle className="h-3 w-3 flex-shrink-0 text-white/90" />}
              </div>
            );
          }}
        />
      </div>

      <AgendaModal 
        open={modalOpen} 
        onOpenChange={setModalOpen} 
        item={editingItem}
        initialDate={initialDate}
        onSave={handleSave}
      />

      <AgendaDetailsSheet
        item={selectedItem}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onEdit={(item) => {
          setEditingItem(item);
          setDetailsOpen(false);
          setModalOpen(true);
        }}
        onDelete={handleDelete}
        onToggleComplete={handleToggleComplete}
      />

      <IAHunterModal
        isOpen={iaHunterOpen}
        onOpenChange={setIaHunterOpen}
        onAgendar={handleAgendarLead}
      />
      
      <EstrategiaFocoModal
        isOpen={estrategiaFocoOpen}
        onOpenChange={setEstrategiaFocoOpen}
      />

      <style>{`
        .fc {
          --fc-button-bg-color: transparent;
          --fc-button-border-color: hsl(var(--border));
          --fc-button-text-color: hsl(var(--muted-foreground));
          --fc-button-hover-bg-color: hsl(var(--muted));
          --fc-button-hover-border-color: hsl(var(--border));
          --fc-button-active-bg-color: hsl(var(--primary) / 0.1);
          --fc-button-active-border-color: hsl(var(--primary) / 0.3);
          --fc-border-color: hsl(var(--border) / 0.5);
          --fc-page-bg-color: transparent;
          --fc-today-bg-color: hsl(var(--primary) / 0.04);
          font-family: inherit;
        }
        .fc .fc-toolbar-title {
          font-size: 1rem;
          font-weight: 800;
          color: hsl(var(--foreground));
          letter-spacing: -0.02em;
        }
        .fc .fc-button {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: capitalize;
          padding: 0.35rem 0.7rem;
          box-shadow: none !important;
          border-radius: 0.6rem;
        }
        .fc .fc-button-primary:not(:disabled).fc-button-active, 
        .fc .fc-button-primary:not(:disabled):active {
          background-color: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-color: hsl(var(--primary));
        }
        .fc-theme-standard td, .fc-theme-standard th {
          border: 1px solid hsl(var(--border) / 0.4);
        }
        .fc-event {
          cursor: pointer;
          border-radius: 8px;
          margin-bottom: 1px;
          border: none !important;
          padding: 1px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .fc-event:hover {
          filter: brightness(1.1);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .fc-h-event .fc-event-main {
          color: white;
        }
        .fc-list-event-title a {
          color: hsl(var(--foreground)) !important;
        }
        .fc .fc-list-sticky .fc-list-day > * {
          background: hsl(var(--muted)) !important;
        }
        @media print {
          .calendar-container {
            border: none;
            box-shadow: none;
          }
          .fc-header-toolbar {
            display: none !important;
          }
          .page-header, .page-subtitle, .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
