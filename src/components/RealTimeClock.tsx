import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function RealTimeClock({ className = "" }: { className?: string }) {
  const [time, setTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

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
      navigate(`/agenda?data=${dateStr}`);
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
          className={`flex items-center gap-2 font-mono text-xs font-medium text-slate-500 bg-slate-100/50 px-3 py-1.5 rounded-full border border-slate-200/50 shadow-inner hover:bg-slate-200/70 transition-colors cursor-pointer active:scale-95 ${className}`}
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
        />
        <div className="p-2 border-t bg-muted/30 flex justify-center">
          <button 
            onClick={() => navigate('/agenda')}
            className="text-xs font-semibold text-primary hover:underline px-2 py-1"
          >
            Ver Agenda Completa
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
