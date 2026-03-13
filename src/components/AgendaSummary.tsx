import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, ListTodo, Eye } from "lucide-react";
import { AgendaItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AgendaSummaryProps {
  items: AgendaItem[];
  currentFilter?: 'all' | 'pending' | 'completed';
  onFilter?: (filter: 'all' | 'pending' | 'completed') => void;
}

export function AgendaSummary({ items, currentFilter = 'all', onFilter }: AgendaSummaryProps) {
  const today = new Date().toISOString().split('T')[0];
  const todayItems = items.filter(item => item.data_inicio.startsWith(today));
  
  const total = todayItems.length;
  const completed = todayItems.filter(item => item.status).length;
  const pending = total - completed;

  const handleFilterClick = (filter: 'all' | 'pending' | 'completed') => {
    if (onFilter) {
      onFilter(currentFilter === filter ? 'all' : filter);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card className={cn(
        "transition-all duration-200 border-2",
        currentFilter === 'all' ? "bg-slate-50 border-slate-400 shadow-md" : "bg-slate-50/50 border-slate-100"
      )}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Total de tarefas hoje</CardTitle>
          <ListTodo className="h-4 w-4 text-slate-400" />
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold text-slate-800">{total}</div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-[10px] gap-1 text-slate-500 hover:text-slate-700 font-bold uppercase tracking-wider"
              onClick={() => handleFilterClick('all')}
            >
              <Eye className="h-3 w-3" /> Ver Todas
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className={cn(
        "transition-all duration-200 border-2",
        currentFilter === 'pending' ? "bg-orange-50 border-orange-400 shadow-md" : "bg-orange-50/50 border-orange-100"
      )}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-orange-600">Pendentes</CardTitle>
          <Clock className="h-4 w-4 text-orange-400" />
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold text-orange-700">{pending}</div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-[10px] gap-1 text-orange-600 hover:text-orange-800 font-bold uppercase tracking-wider"
              onClick={() => handleFilterClick('pending')}
            >
              <Eye className="h-3 w-3" /> Ver Lista
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className={cn(
        "transition-all duration-200 border-2",
        currentFilter === 'completed' ? "bg-emerald-50 border-emerald-400 shadow-md" : "bg-emerald-50/50 border-emerald-100"
      )}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-emerald-600">Concluídas</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold text-emerald-700">{completed}</div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-[10px] gap-1 text-emerald-600 hover:text-emerald-800 font-bold uppercase tracking-wider"
              onClick={() => handleFilterClick('completed')}
            >
              <Eye className="h-3 w-3" /> Ver Lista
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
