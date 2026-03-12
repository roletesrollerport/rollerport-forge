import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import {
  ArrowLeft, Printer, FileText, ShoppingCart, Factory,
  ChevronLeft, ChevronRight, Calendar
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { store } from '@/lib/store';
import { toast } from 'sonner';

/* ── helpers ─────────────────────────────────────────────────────── */
const fmt = (v: number) =>
  `R$ ${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace(/\.(\d{2})$/, ',$1')}`;

const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR');

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Parse any date string (ISO or DD/MM/YYYY) → Date or null */
function parseDocDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  if (raw.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  const parts = raw.split('/');
  if (parts.length === 3) {
    const d = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayKey(key: string): string {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

function elapsedTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  const d = parseDocDate(dateStr);
  if (!d) return '-';
  const diff = Date.now() - d.getTime();
  if (diff < 0) return '0m';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const parts = dateStr.split('/');
    if (parts.length === 3) return dateStr;
    return dateStr;
  }
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusColor(status: string) {
  switch (status) {
    case 'APROVADO': case 'CONCLUIDO': case 'CONCLUIDA': case 'ENTREGUE': return 'bg-success/10 text-success';
    case 'REPROVADO': case 'CANCELADO': return 'bg-destructive/10 text-destructive';
    case 'EM_PRODUCAO': case 'EM_ANDAMENTO': case 'CONFIRMADO': return 'bg-secondary/10 text-secondary';
    default: return 'bg-muted text-muted-foreground';
  }
}

const statusLabel = (s: string) => s?.replace(/_/g, ' ') || '-';

/* ── types ───────────────────────────────────────────────────────── */
interface VendorReportViewProps {
  vendorName: string;
  orcamentos: any[];
  pedidos: any[];
  ordensServico: any[];
  metas: any[];
  isMaster: boolean;
  isPrint?: boolean;
  onBack: () => void;
  onPrint: () => void;
}


/* ── calendar component ──────────────────────────────────────────── */
interface CalendarGridProps {
  year: number;
  month: number;
  dayActivity: Map<string, { orcs: number; peds: number; os: number }>;
  selectedDay: string | null;
  onDayClick: (dayKey: string | null) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onPrevYear: () => void;
  onNextYear: () => void;
}

function CalendarGrid({ year, month, dayActivity, selectedDay, onDayClick, onPrevMonth, onNextMonth, onPrevYear, onNextYear }: CalendarGridProps) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = isCurrentMonth ? today.getDate() : -1;

  const days: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <Card>
      <CardHeader className="pb-4 border-b">
        <div className="flex items-center justify-between px-1">
          {/* Controle de Mês */}
          <div className="flex items-center bg-muted/40 border border-border/50 rounded-lg p-0.5">
            <Button variant="ghost" size="sm" onClick={onPrevMonth} className="h-7 w-7 p-0 rounded-md hover:bg-background hover:shadow-sm transition-all text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="w-24 text-center text-[13px] font-semibold tracking-wide uppercase text-primary">{MONTHS[month]}</span>
            <Button variant="ghost" size="sm" onClick={onNextMonth} className="h-7 w-7 p-0 rounded-md hover:bg-background hover:shadow-sm transition-all text-muted-foreground hover:text-foreground">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Controle de Ano */}
          <div className="flex items-center bg-muted/40 border border-border/50 rounded-lg p-0.5">
            <Button variant="ghost" size="sm" onClick={onPrevYear} className="h-7 w-7 p-0 rounded-md hover:bg-background hover:shadow-sm transition-all text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="w-14 text-center text-[13px] font-bold text-foreground">{year}</span>
            <Button variant="ghost" size="sm" onClick={onNextYear} className="h-7 w-7 p-0 rounded-md hover:bg-background hover:shadow-sm transition-all text-muted-foreground hover:text-foreground">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS_SHORT.map(wd => (
            <div key={wd} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
              {wd}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, idx) => {
            if (d === null) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }
            const dayKey = toDayKey(new Date(year, month, d));
            const activity = dayActivity.get(dayKey);
            const isToday = d === todayDate;
            const isSelected = dayKey === selectedDay;
            const hasActivity = !!activity;

            return (
              <button
                key={d}
                onClick={() => onDayClick(dayKey)}
                className={`
                  aspect-square rounded-md text-xs font-medium transition-all relative
                  ${isSelected
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1'
                    : hasActivity
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted'
                  }
                  ${isToday && !isSelected ? 'ring-1 ring-primary/50' : ''}
                `}
              >
                <span className="absolute top-1 left-0 right-0 text-center">{d}</span>
                {hasActivity && (
                  <div className="absolute bottom-0.5 left-0 right-0 flex justify-center gap-0.5 text-[8px]">
                    {activity.orcs > 0 && <span className={`${isSelected ? 'text-primary-foreground/80' : 'text-primary/70'}`}>O</span>}
                    {activity.peds > 0 && <span className={`${isSelected ? 'text-primary-foreground/80' : 'text-secondary/80'}`}>P</span>}
                    {activity.os > 0 && <span className={`${isSelected ? 'text-primary-foreground/80' : 'text-accent/80'}`}>S</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 pt-3 border-t flex gap-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-primary/10 border border-primary/20" />
            <span>Atividade</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-primary">O</span>=Orçamento
          </div>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-secondary">P</span>=Pedido
          </div>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-accent">S</span>=O.S.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── table component ─────────────────────────────────────────────── */
function DocTable({ title, icon: Icon, iconColor, docs, emptyMsg, onItemClick }: {
  title: string; icon: any; iconColor: string; docs: any[]; emptyMsg: string;
  onItemClick?: (doc: any, type: 'orcamento' | 'pedido' | 'os') => void;
}) {
  const isOrc = title.startsWith('Orç');
  const isPed = title.startsWith('Ped');
  const typeStr = isOrc ? 'orcamento' : isPed ? 'pedido' : 'os';
  return (
    <div>
      <h3 className={`font-semibold text-sm mb-2 flex items-center gap-2`}>
        <Icon className={`h-4 w-4 ${iconColor}`} /> {title} ({docs.length})
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-2">Nº</th>
              <th className="text-left p-2">Cliente{!isOrc && !isPed ? '/Empresa' : ''}</th>
              {!isOrc && !isPed && <th className="text-left p-2">Pedido</th>}
              <th className="text-left p-2">Data</th>
              {(isOrc || isPed) && <th className="text-right p-2">Valor</th>}
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Tempo</th>
              <th className="text-left p-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d: any) => {
              const dateRaw = isOrc ? (d.dataOrcamento || d.createdAt)
                : isPed ? d.createdAt
                : (d.emissao || d.createdAt);
              return (
                <tr 
                  key={d.id} 
                  className={`border-b hover:bg-muted/30 ${onItemClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                  onClick={() => onItemClick && onItemClick(d, typeStr)}
                >
                  <td className="p-2 font-mono">{d.numero || d.id}</td>
                  <td className="p-2">{isOrc || isPed ? d.clienteNome : d.empresa}</td>
                  {!isOrc && !isPed && <td className="p-2 font-mono">{d.pedidoNumero}</td>}
                  <td className="p-2">{dateRaw}</td>
                  {(isOrc || isPed) && <td className="p-2 text-right font-mono">{fmt(d.valorTotal || 0)}</td>}
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor(d.status)}`}>
                      {statusLabel(d.status)}
                    </span>
                  </td>
                  <td className="p-2 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{elapsedTime(dateRaw)}</td>
                  <td className="p-2 text-[10px] max-w-[150px] truncate text-muted-foreground"
                    title={d.motivoCancelamento || ''}>
                    {d.motivoCancelamento ? (
                      <span className="text-destructive font-semibold">
                        {d.motivoCancelamento}
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              );
            })}
            {docs.length === 0 && (
              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">{emptyMsg}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function VendorReportView({
  vendorName, orcamentos, pedidos, ordensServico, metas,
  isMaster, isPrint, onBack, onPrint,
}: VendorReportViewProps) {
  const now = new Date();

  /* date filter state */
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // 'YYYY-MM-DD' or null

  const [calendarOpen, setCalendarOpen] = useState(false);

  /* Doc Detail state */
  const [selectedDocDetail, setSelectedDocDetail] = useState<{ doc: any; type: 'orcamento' | 'pedido' | 'os' } | null>(null);


  /* ── year list (from earliest doc date to now+1) ── */
  const years = useMemo(() => {
    const allDates: number[] = [];
    [...orcamentos, ...pedidos, ...ordensServico].forEach(doc => {
      const raw = doc.dataOrcamento || doc.emissao || doc.createdAt;
      const d = parseDocDate(raw);
      if (d) allDates.push(d.getFullYear());
    });
    const minYear = allDates.length > 0 ? Math.min(...allDates) : now.getFullYear();
    const arr: number[] = [];
    for (let y = minYear; y <= now.getFullYear() + 1; y++) arr.push(y);
    return arr;
  }, [orcamentos, pedidos, ordensServico]);

  /* ── filter by selected month/year ── */
  const filterByMonth = (docs: any[], primaryDate: string) =>
    docs.filter(doc => {
      const d = parseDocDate(doc[primaryDate] || doc.createdAt);
      return d && d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });

  const monthOrcs = useMemo(() => filterByMonth(orcamentos, 'dataOrcamento'), [orcamentos, selectedYear, selectedMonth]);
  const monthPeds = useMemo(() => filterByMonth(pedidos, 'createdAt'), [pedidos, selectedYear, selectedMonth]);
  const monthOS   = useMemo(() => filterByMonth(ordensServico, 'emissao'), [ordensServico, selectedYear, selectedMonth]);

  /* ── build day activity map ── */
  const dayActivity = useMemo(() => {
    type DayInfo = { orcs: number; peds: number; os: number };
    const map = new Map<string, DayInfo>();

    const add = (doc: any, primaryDate: string, field: keyof DayInfo) => {
      const d = parseDocDate(doc[primaryDate] || doc.createdAt);
      if (!d) return;
      const key = toDayKey(d);
      const prev = map.get(key) || { orcs: 0, peds: 0, os: 0 };
      (prev[field] as number)++;
      map.set(key, prev);
    };

    monthOrcs.forEach(d => { add(d, 'dataOrcamento', 'orcs'); });
    monthPeds.forEach(d => { add(d, 'createdAt', 'peds'); });
    monthOS.forEach(d => { add(d, 'emissao', 'os'); });

    return map;
  }, [monthOrcs, monthPeds, monthOS]);

  /* ── filter by selected day ── */
  const filterByDay = (docs: any[], primaryDate: string) => {
    if (!selectedDay) return docs;
    return docs.filter(doc => {
      const d = parseDocDate(doc[primaryDate] || doc.createdAt);
      return d && toDayKey(d) === selectedDay;
    });
  };

  const displayOrcs = useMemo(() => filterByDay(monthOrcs, 'dataOrcamento'), [monthOrcs, selectedDay]);
  const displayPeds = useMemo(() => filterByDay(monthPeds, 'createdAt'),      [monthPeds, selectedDay]);
  const displayOS   = useMemo(() => filterByDay(monthOS, 'emissao'),           [monthOS, selectedDay]);

  /* ── summary stats for selected period ── */
  const meta = metas.find(m => m.vendedor === vendorName);
  const totalVendido = displayPeds.reduce((s: number, p: any) => s + (p.valorTotal || 0), 0);
  const metaPct = meta && meta.metaMensal > 0 ? Math.min((totalVendido / meta.metaMensal) * 100, 100) : 0;
  const bateuMeta = meta && meta.metaMensal > 0 && totalVendido >= meta.metaMensal;



  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
    setSelectedDay(null);
  };

  /* ── render ── */
  return (
    <div className="space-y-4">

      {/* ── top action bar ── */}
      <div className="flex gap-2 flex-wrap items-center print:hidden">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        {!isPrint ? (
          <Button variant="outline" onClick={onPrint} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        ) : (
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </Button>
        )}

        {/* Controle do Calendário */}
        <div className="flex gap-2 ml-2 items-center">
          {selectedDay && (
            <button
              onClick={() => setSelectedDay(null)}
              className="text-xs text-muted-foreground underline hover:text-foreground mr-1"
            >
              Ver todo o mês
            </button>
          )}

          <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Ver Calendário
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md p-0 border-0 bg-transparent shadow-none">
              <CalendarGrid
                year={selectedYear}
                month={selectedMonth}
                dayActivity={dayActivity}
                selectedDay={selectedDay}
                onDayClick={(day) => {
                  setSelectedDay(day);
                  setCalendarOpen(false); // fecha o calendário ao selecionar um dia
                }}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onPrevYear={() => { setSelectedYear(y => y - 1); setSelectedDay(null); }}
                onNextYear={() => { setSelectedYear(y => y + 1); setSelectedDay(null); }}
              />
            </DialogContent>
          </Dialog>
        </div>

      </div>



      {/* ── report layout ── */}
      <div className="grid grid-cols-1 gap-4">
        {/* ── report tables ── */}
        <div className="col-span-1">
          <div className="bg-card border rounded-lg p-5 space-y-6 print:border-0 print:shadow-none print:p-0 max-w-6xl mx-auto">
            {/* Professional Print Header */}
            <div className="hidden print:flex flex-col border-b-2 border-primary pb-4 mb-6">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-2xl font-bold text-primary">Rollerport Industrial</h1>
                  <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Relatório de Desempenho Profissional</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Emitido em: {fmtDate(new Date())}</p>
                  <p>Sistema Rollerport Forge</p>
                </div>
              </div>
            </div>

            {/* header */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-foreground">{vendorName}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selectedDay ? `Atividade do dia ${formatDayKey(selectedDay)}` : `Referência: ${MONTHS[selectedMonth]} de ${selectedYear}`}
                </p>
              </div>
              <div className="hidden print:block text-right">
                <Badge variant="outline" className="text-[10px] h-5">{bateuMeta ? 'META ATINGIDA' : 'META EM ANDAMENTO'}</Badge>
              </div>
            </div>

            {/* summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="border rounded p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Orçamentos</p>
                <p className="text-xl font-bold">{displayOrcs.length}</p>
              </div>
              <div className="border rounded p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Pedidos</p>
                <p className="text-xl font-bold">{displayPeds.length}</p>
              </div>
              <div className="border rounded p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Total Vendido</p>
                <p className="text-base font-bold text-success">{fmt(totalVendido)}</p>
              </div>
              <div className="border rounded p-3 text-center">
                <p className="text-[11px] text-muted-foreground">Meta {MONTHS[selectedMonth]}</p>
                <p className={`text-xl font-bold ${bateuMeta ? 'text-success' : metaPct > 0 ? 'text-secondary' : 'text-muted-foreground'}`}>
                  {metaPct.toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Orçamentos */}
            <DocTable
              title="Orçamentos"
              icon={FileText}
              iconColor="text-primary"
              docs={displayOrcs}
              emptyMsg="Nenhum orçamento no período."
              onItemClick={(doc, type) => setSelectedDocDetail({ doc, type })}
            />

            {/* Pedidos */}
            <DocTable
              title="Pedidos"
              icon={ShoppingCart}
              iconColor="text-secondary"
              docs={displayPeds}
              emptyMsg="Nenhum pedido no período."
              onItemClick={(doc, type) => setSelectedDocDetail({ doc, type })}
            />

            {/* Ordens de Serviço */}
            <DocTable
              title="Ordens de Serviço"
              icon={Factory}
              iconColor="text-accent"
              docs={displayOS}
              emptyMsg="Nenhuma O.S. no período."
              onItemClick={(doc, type) => setSelectedDocDetail({ doc, type })}
            />
          </div>
        </div>
      </div>

      {/* ── Document Details Modal ── */}
      <Dialog open={!!selectedDocDetail} onOpenChange={(open) => !open && setSelectedDocDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedDocDetail && (
            <div className="space-y-4">
              <div className="border-b pb-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {selectedDocDetail.type === 'orcamento' && <FileText className="h-5 w-5 text-primary" />}
                  {selectedDocDetail.type === 'pedido' && <ShoppingCart className="h-5 w-5 text-secondary" />}
                  {selectedDocDetail.type === 'os' && <Factory className="h-5 w-5 text-accent" />}
                  {selectedDocDetail.type === 'orcamento' ? 'Orçamento' : selectedDocDetail.type === 'pedido' ? 'Pedido' : 'Ordem de Serviço'} 
                  <span className="text-muted-foreground ml-1 font-mono">#{selectedDocDetail.doc.numero}</span>
                </h2>
                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-sm text-muted-foreground">
                  <div><span className="font-semibold text-foreground">Cliente/Empresa:</span> {selectedDocDetail.doc.clienteNome || selectedDocDetail.doc.empresa}</div>
                  <div><span className="font-semibold text-foreground">Status:</span> <span className={`px-2 py-0.5 rounded text-xs font-medium ml-1 bg-muted ${statusColor(selectedDocDetail.doc.status)}`}>{statusLabel(selectedDocDetail.doc.status)}</span></div>
                  <div><span className="font-semibold text-foreground">Data:</span> {selectedDocDetail.doc.dataOrcamento || selectedDocDetail.doc.createdAt}</div>
                </div>
              </div>

              {/* Itens List */}
              {/* Itens List */}
              <div className="bg-card border rounded-lg overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-muted/50 text-primary uppercase text-[10px] font-bold">
                    <tr>
                      <th className="border p-2 text-center w-10">Item</th>
                      <th className="border p-2 text-left">Código</th>
                      <th className="border p-2 text-left">Descrição</th>
                      <th className="border p-2 text-center w-12">Qtd</th>
                      <th className="border p-2 text-right">V. Unit</th>
                      <th className="border p-2 text-right">V. Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let renderedItens = [];
                      if (selectedDocDetail.type === 'os') {
                        // A OS só grava campos de produção. Vamos pegar de onde ela originou para exibir valores
                        const peds = store.getPedidos();
                        const originPed = peds.find(p => p.id === selectedDocDetail.doc.pedidoId);
                        if (originPed) {
                          const orcs = store.getOrcamentos();
                          const originOrc = orcs.find(o => o.id === originPed.orcamentoId);
                          if (originOrc) {
                            const roletes = Array.isArray(originOrc.itensRolete) ? originOrc.itensRolete : [];
                            const produtos = Array.isArray(originOrc.itensProduto) ? originOrc.itensProduto : [];
                            renderedItens = [...produtos, ...roletes];
                          } else {
                            renderedItens = Array.isArray(selectedDocDetail.doc.itens) ? selectedDocDetail.doc.itens : [];
                          }
                        } else {
                          renderedItens = Array.isArray(selectedDocDetail.doc.itens) ? selectedDocDetail.doc.itens : [];
                        }
                      } else if (selectedDocDetail.type === 'pedido') {
                        // Pedidos puxam os itens do Orçamento de origem
                        const orcs = store.getOrcamentos();
                        const originOrc = orcs.find(o => o.id === selectedDocDetail.doc.orcamentoId);
                        if (originOrc) {
                          const roletes = Array.isArray(originOrc.itensRolete) ? originOrc.itensRolete : [];
                          const produtos = Array.isArray(originOrc.itensProduto) ? originOrc.itensProduto : [];
                          renderedItens = [...produtos, ...roletes];
                        }
                      } else {
                        // Orçamentos puxam direto de si mesmos
                        const roletes = Array.isArray(selectedDocDetail.doc.itensRolete) ? selectedDocDetail.doc.itensRolete : [];
                        const produtos = Array.isArray(selectedDocDetail.doc.itensProduto) ? selectedDocDetail.doc.itensProduto : [];
                        renderedItens = [...produtos, ...roletes];
                      }

                      if (renderedItens.length === 0) {
                        return <tr><td colSpan={selectedDocDetail.type === 'os' ? 4 : 14} className="border p-4 text-center text-muted-foreground">Nenhum item detalhado neste documento.</td></tr>;
                      }

                      return renderedItens.map((item: any, idx: number) => {
                        // Descrição condicional (Rolete vs Produto genérico) na OS o tipo é 'tipo', no Orçamento é 'tipoRolete'
                        const isProdutoGen = item.produtoNome !== undefined; 
                        const tipoArmazenado = item.tipoRolete || item.tipo;
                        const codigo = item.codigoProduto || tipoArmazenado || '-';
                        const descricao = item.descricao || (isProdutoGen ? item.produtoNome : `Rolete ${tipoArmazenado} - ø${item.diametroTubo} x ${item.comprimentoTubo}`);
                        const unitarioSemImp = item.valorLiquidoUnit || item.valorUnitario || item.precoUnitario || item.valorPorPeca || 0;
                        const qtd = item.quantidade || item.qtd || 1;
                        const vlrTotalBase = item.valorTotal || (unitarioSemImp * qtd); // Tenta usar o valor total nativo, senão fallback

                        // Para extrais os impostos de registros que já salvam no novo formato
                        const descImpostos = {
                          aliqPIS: item.aliqPIS || 0,
                          aliqCOFINS: item.aliqCOFINS || 0,
                          aliqICMS: item.aliqICMS || 0,
                          aliqIPI: item.aliqIPI || 0,
                          valorPIS: item.valorPIS || 0,
                          valorCOFINS: item.valorCOFINS || 0,
                          valorICMS: item.valorICMS || 0,
                          valorIPI: item.valorIPI || 0,
                        };

                        return (
                          <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="border p-2 text-center font-mono text-[10px] text-muted-foreground">{String(idx + 1).padStart(2, '0')}</td>
                            <td className="border p-2 font-medium font-mono text-[10px]">{codigo}</td>
                            <td className="border p-2 text-[11px] whitespace-pre-wrap">{descricao}</td>
                            <td className="border p-2 text-center font-bold text-xs">{qtd}</td>
                            
                            <td className="border p-2 text-right font-mono text-[10px]">{fmt(unitarioSemImp)}</td>
                            <td className="border p-2 text-right font-mono font-bold text-primary text-[11px]">{fmt(vlrTotalBase)}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Histórico / Eventos */}
              <div className="mt-4 pt-4 border-t">
                <h3 className="text-sm font-semibold mb-3">Histórico de Eventos</h3>
                <div className="space-y-3">
                  {/* Evento de Criação */}
                  <div className="flex gap-3 text-sm">
                    <div className="w-32 text-muted-foreground text-xs">{formatDateTime(selectedDocDetail.doc.dataOrcamento || selectedDocDetail.doc.createdAt)}</div>
                    <div className="flex flex-col">
                      <span className="font-medium">Criado</span>
                      <span className="text-xs text-muted-foreground">Documento gerado e salvo</span>
                    </div>
                  </div>

                  {/* Histórico de Status Registrado */}
                  {selectedDocDetail.doc.statusHistory && selectedDocDetail.doc.statusHistory.map((hist: any, idx: number) => (
                    <div key={idx} className="flex gap-3 text-sm">
                      <div className="w-32 text-muted-foreground text-xs">{formatDateTime(hist.date)}</div>
                      <div className="flex flex-col">
                        <span className="font-medium">Status <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ml-1 ${statusColor(hist.status)}`}>{statusLabel(hist.status)}</span></span>
                        <span className="text-xs text-muted-foreground">O status do documento foi atualizado</span>
                      </div>
                    </div>
                  ))}

                  {/* Evento de Cancelamento (se houver) */}
                  {selectedDocDetail.doc.motivoCancelamento && (
                    <div className="flex gap-3 text-sm">
                      <div className="w-32 text-muted-foreground text-xs">{formatDateTime(selectedDocDetail.doc.dataCancelamento || selectedDocDetail.doc.updatedAt || undefined)}</div>
                      <div className="flex flex-col">
                        <span className="font-medium text-destructive">Cancelado / Reprovado</span>
                        <span className="text-xs text-muted-foreground max-w-lg">Motivo: {selectedDocDetail.doc.motivoCancelamento}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 min-w-[300px]">
                  <div className="flex justify-between items-center text-sm font-bold whitespace-nowrap gap-4">
                    <span>Total do Documento:</span>
                    <span className="text-lg text-primary">
                      {selectedDocDetail.type === 'os' ? (() => {
                        // OS não tem valorTotal, então precisamos somar os itens ou pegar do pedido original
                        const p = store.getPedidos().find(ped => ped.id === selectedDocDetail.doc.pedidoId);
                        if (p && p.valorTotal) return fmt(p.valorTotal);
                        return fmt(0);
                      })() : fmt(selectedDocDetail.doc.valorTotal || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {isPrint && (
        <style>{`
          @media print {
            @page { 
              margin: 1.5cm; 
              size: auto;
            }
            body { 
              -webkit-print-color-adjust: exact; 
              background: white !important;
              color: black !important;
            }
            .print\\:hidden { 
              display: none !important; 
            }
            .print\\:block {
              display: block !important;
            }
            .print\\:flex {
              display: flex !important;
            }
            .bg-card {
              border: none !important;
              padding: 0 !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
            }
            th, td {
              border: 1px solid #e2e8f0 !important;
            }
            th {
              background-color: #f8fafc !important;
              color: #1e293b !important;
              font-weight: 700 !important;
            }
            .rounded-lg {
              border-radius: 0 !important;
            }
            .shadow-none {
              box-shadow: none !important;
            }
            /* Garantir que as cores de status apareçam */
            .bg-success\\/10 { background-color: rgba(34, 197, 94, 0.1) !important; color: #15803d !important; }
            .bg-destructive\\/10 { background-color: rgba(239, 68, 68, 0.1) !important; color: #b91c1c !important; }
            .bg-secondary\\/10 { background-color: rgba(249, 115, 22, 0.1) !important; color: #c2410c !important; }
          }
        `}</style>
      )}
    </div>
  );
}
