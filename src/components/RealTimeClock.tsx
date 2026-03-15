import { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useNavigate } from "react-router-dom";
import { format, isSameDay, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { store } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { AgendaItem } from '@/lib/types';

export function RealTimeClock({ className = "" }: { className?: string }) {
  const [time, setTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const navigate = useNavigate();

  // Reload agenda data every time popover opens
  useEffect(() => {
    if (open) {
      setAgendaItems(store.getAgenda());
    }
  }, [open]);

  // Build sets of dates with real events and overdue events
  const eventDates = new Set<string>();
  const overdueDates = new Set<string>();
  const now = new Date();

  agendaItems.forEach(item => {
    if (!item.data_inicio) return;
    const d = new Date(item.data_inicio);
    const key = format(d, 'yyyy-MM-dd');
    eventDates.add(key);

    // Overdue: past date and not completed
    if (isPast(d) && !isSameDay(d, now) && !item.status) {
      overdueDates.add(key);
    }
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    setOpen(false);
    const dateStr = format(date, 'yyyy-MM-dd');

    // Check if there are real events on this date
    const hasEvents = eventDates.has(dateStr);

    if (hasEvents) {
      // Go directly to agenda list view filtered to that date
      navigate(`/agenda?data=${dateStr}&view=list`);
    } else {
      // No events: go to agenda and open create modal for that date
      navigate(`/agenda?data=${dateStr}&view=list&novo=1`);
    }
  }, [eventDates, navigate]);

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
