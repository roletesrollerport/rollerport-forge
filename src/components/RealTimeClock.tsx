import { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useNavigate } from "react-router-dom";
import { format, isSameDay, isPast, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { store } from '@/lib/store';
import { cn } from '@/lib/utils';

export function RealTimeClock({ className = "" }: { className?: string }) {
  const [time, setTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Load agenda items when popover opens
  const agendaItems = useMemo(() => {
    if (!open) return [];
    return store.getAgenda();
  }, [open]);

  // Build sets of dates with events and overdue events
  const { eventDates, overdueDates } = useMemo(() => {
    const evDates = new Set<string>();
    const odDates = new Set<string>();
    const now = new Date();

    agendaItems.forEach(item => {
      if (!item.data_inicio) return;
      const d = new Date(item.data_inicio);
      const key = format(d, 'yyyy-MM-dd');
      evDates.add(key);

      // Overdue: past date and not completed
      if (isPast(d) && !isSameDay(d, now) && !item.status) {
        odDates.add(key);
      }
    });

    return { eventDates: evDates, overdueDates: odDates };
  }, [agendaItems]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setOpen(false);
      const dateStr = format(date, 'yyyy-MM-dd');

      // Check if there are events on this date
      const hasEvents = agendaItems.some(item => {
        if (!item.data_inicio) return false;
        return isSameDay(new Date(item.data_inicio), date);
      });

      if (hasEvents) {
        // Go to agenda list view for that date
        navigate(`/agenda?data=${dateStr}&view=list`);
      } else {
        // No events: go to agenda and open create modal
        navigate(`/agenda?data=${dateStr}&view=list&novo=1`);
      }
    }
  };

  const formattedTime = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(time);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button 
          className={`flex items-center gap-2 font-mono text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border/50 shadow-inner hover:bg-muted/70 transition-colors cursor-pointer active:scale-95 ${className}`}
        >
          <CalendarIcon className="h-3 w-3 text-primary/70" />
          <span>{formattedTime}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          locale={ptBR}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
          modifiers={{
            hasEvent: (date) => {
              const key = format(date, 'yyyy-MM-dd');
              return eventDates.has(key) && !overdueDates.has(key);
            },
            overdue: (date) => {
              const key = format(date, 'yyyy-MM-dd');
              return overdueDates.has(key);
            },
          }}
          modifiersClassNames={{
            hasEvent: 'rp-cal-event',
            overdue: 'rp-cal-overdue',
          }}
        />
        <div className="p-2 border-t bg-muted/30 flex justify-center">
          <button 
            onClick={() => { setOpen(false); navigate('/agenda'); }}
            className="text-xs font-semibold text-primary hover:underline px-2 py-1"
          >
            Ver Agenda Completa
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
