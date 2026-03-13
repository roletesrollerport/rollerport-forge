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
  AlertCircle
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
import { isBefore, isPast, parseISO } from 'date-fns';

const TYPE_COLORS: Record<TipoCompromisso, string> = {
  'Visita Técnica': '#f59e0b', // Amber 500
  'Ligação': '#3b82f6', // Blue 500
  'Retorno de Orçamento': '#8b5cf6', // Violet 500
  'Entrega de Roletes': '#10b981', // Emerald 500
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
  const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null);
  const [editingItem, setEditingItem] = useState<AgendaItem | undefined>();
  const [initialDate, setInitialDate] = useState<Date | undefined>();
  const [filterTypes, setFilterTypes] = useState<TipoCompromisso[]>(['Visita Técnica', 'Ligação', 'Retorno de Orçamento', 'Entrega de Roletes']);
  const [agendaFilter, setAgendaFilter] = useState<'all' | 'pending' | 'completed'>('all');
  
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
      // Clear state so it doesn't reopen on refresh
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

  const overdueCount = useMemo(() => {
    return items.filter(item => !item.status && isPast(new Date(item.data_inicio))).length;
  }, [items]);

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="page-header">Agenda & CRM</h1>
            <p className="page-subtitle">Gestão de visitas e compromissos comerciais</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative mr-2">
            <Bell className={cn("h-5 w-5 text-muted-foreground", overdueCount > 0 && "text-destructive animate-pulse")} />
            {overdueCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white border-2 border-background">
                {overdueCount}
              </span>
            )}
          </div>

          {overdueCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive rounded-full text-xs font-bold mr-2 border border-destructive/20">
              <AlertCircle className="h-3.5 w-3.5" />
              {overdueCount} {overdueCount === 1 ? 'ATRASADO' : 'ATRASADOS'}
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" /> Filtros
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
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] }} />
                    {type}
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" onClick={() => window.print()} className="gap-2 no-print">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>

          <Button onClick={() => { setEditingItem(undefined); setInitialDate(new Date()); setModalOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Compromisso
          </Button>
        </div>
      </div>

      <AgendaSummary items={items} onFilter={setAgendaFilter} currentFilter={agendaFilter} />

      <div className="bg-card border rounded-xl p-4 shadow-sm calendar-container print:border-0 print:shadow-none print:p-0">
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

            return (
              <div className={cn(
                "px-1.5 py-1 text-[10px] sm:text-xs overflow-hidden truncate font-medium flex items-center gap-1.5",
                isCompleted && "line-through text-white/70"
              )}>
                <Icon className="h-3 w-3 flex-shrink-0" />
                <div className="truncate">
                  <span className="font-bold opacity-80 mr-1">{arg.timeText}</span>
                  {arg.event.title}
                </div>
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

      <style>{`
        .fc {
          --fc-button-bg-color: transparent;
          --fc-button-border-color: #e2e8f0;
          --fc-button-text-color: #64748b;
          --fc-button-hover-bg-color: #f1f5f9;
          --fc-button-hover-border-color: #cbd5e1;
          --fc-button-active-bg-color: #e2e8f0;
          --fc-button-active-border-color: #94a3b8;
          --fc-border-color: #f1f5f9;
          --fc-page-bg-color: transparent;
          --fc-today-bg-color: #f1f5f9;
          font-family: inherit;
        }
        .fc .fc-toolbar-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #1e293b;
        }
        .fc .fc-button {
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: capitalize;
          padding: 0.4rem 0.8rem;
          box-shadow: none !important;
        }
        .fc .fc-button-primary:not(:disabled).fc-button-active, 
        .fc .fc-button-primary:not(:disabled):active {
          background-color: #f1f5f9;
          color: #020617;
          border-color: #e2e8f0;
        }
        .fc-theme-standard td, .fc-theme-standard th {
          border: 1px solid #f1f5f9;
        }
        .fc-event {
          cursor: pointer;
          border-radius: 6px;
          margin-bottom: 1px;
          border: none !important;
          padding: 1px;
        }
        .fc-h-event .fc-event-main {
          color: white;
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
