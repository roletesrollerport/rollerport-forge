import { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, Printer, FileText, ShoppingCart, Factory, Brain,
  Loader2, Save, Edit, Sparkles, ChevronLeft, ChevronRight, Calendar
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

/* ── helpers ─────────────────────────────────────────────────────── */
const fmt = (v: number) =>
  `R$ ${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace(/\.(\d{2})$/, ',$1')}`;

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

/** Elapsed time from dateStr to now */
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
  masterPrompt?: string;
  onSaveMasterPrompt?: (prompt: string) => void;
}

const DEFAULT_AI_PROMPT = `Você é um consultor de vendas sênior da Rollerport. Analise o relatório do vendedor e:
1. Avalie o desempenho geral (bateu a meta? por quê?)
2. Identifique padrões de cancelamentos e dê dicas para evitar perdas
3. Dê dicas motivacionais personalizadas
4. Sugira como melhorar os textos de e-mail/orçamento para fechar mais vendas
5. Busque na internet e sugira 3 potenciais clientes que consomem roletes para correias transportadoras (inclua nome da empresa, telefone e e-mail se possível)
6. Se o vendedor bateu a meta, parabenize com entusiasmo mas incentive a ir mais alto
Responda em português do Brasil, de forma clara e motivadora.`;

/* ── calendar component ──────────────────────────────────────────── */
interface CalendarGridProps {
  year: number;
  month: number;
  dayActivity: Map<string, { orcs: number; peds: number; os: number }>;
  selectedDay: string | null;
  onDayClick: (dayKey: string | null) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

function CalendarGrid({ year, month, dayActivity, selectedDay, onDayClick, onPrevMonth, onNextMonth }: CalendarGridProps) {
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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            {MONTHS[month]} {year}
          </h3>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={onPrevMonth} className="h-7 w-7 p-0">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={onNextMonth} className="h-7 w-7 p-0">
              <ChevronRight className="h-3.5 w-3.5" />
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
function DocTable({ title, icon: Icon, iconColor, docs, emptyMsg }: {
  title: string; icon: any; iconColor: string; docs: any[]; emptyMsg: string;
}) {
  const isOrc = title.startsWith('Orç');
  const isPed = title.startsWith('Ped');
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
                <tr key={d.id} className="border-b hover:bg-muted/30">
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
                  <td className="p-2 font-mono text-[10px] text-muted-foreground">{elapsedTime(dateRaw)}</td>
                  <td className="p-2 text-[10px] max-w-[180px] truncate text-muted-foreground"
                    title={d.motivoCancelamento || ''}>
                    {d.motivoCancelamento ? d.motivoCancelamento : '-'}
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

/* ── main component ──────────────────────────────────────────────── */
export default function VendorReportView({
  vendorName, orcamentos, pedidos, ordensServico, metas,
  isMaster, isPrint, onBack, onPrint, masterPrompt, onSaveMasterPrompt,
}: VendorReportViewProps) {
  const now = new Date();

  /* date filter state */
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // 'YYYY-MM-DD' or null

  /* AI state */
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptText, setPromptText] = useState(masterPrompt || DEFAULT_AI_PROMPT);
  const abortRef = useRef<AbortController | null>(null);

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

  /* ── AI report builder ── */
  const buildReportText = () => {
    const period = selectedDay
      ? `Dia ${formatDayKey(selectedDay)}`
      : `${MONTHS[selectedMonth]}/${selectedYear}`;
    let text = `## Relatório do Vendedor: ${vendorName}\n`;
    text += `**Período:** ${period}\n`;
    text += `**Meta Mensal:** ${meta ? fmt(meta.metaMensal) : 'Não definida'}\n`;
    text += `**Total Vendido no período:** ${fmt(totalVendido)}\n`;
    text += `**Atingimento:** ${metaPct.toFixed(1)}%\n`;
    text += `**Bateu a meta:** ${bateuMeta ? 'SIM ✅' : 'NÃO ❌'}\n\n`;

    text += `### Orçamentos (${displayOrcs.length})\n`;
    displayOrcs.forEach(o => {
      text += `- Nº ${o.numero} | ${o.clienteNome} | ${fmt(o.valorTotal || 0)} | Status: ${o.status} | Tempo: ${elapsedTime(o.dataOrcamento || o.createdAt)}`;
      if (o.status === 'REPROVADO' && o.motivoCancelamento) text += ` | Motivo: ${o.motivoCancelamento}`;
      text += '\n';
    });

    text += `\n### Pedidos (${displayPeds.length})\n`;
    displayPeds.forEach(p => {
      text += `- Nº ${p.numero} | ${p.clienteNome} | ${fmt(p.valorTotal || 0)} | Status: ${p.status} | Tempo: ${elapsedTime(p.createdAt)}`;
      if (p.motivoCancelamento) text += ` | Motivo: ${p.motivoCancelamento}`;
      text += '\n';
    });

    text += `\n### Ordens de Serviço (${displayOS.length})\n`;
    displayOS.forEach(os => {
      text += `- O.S. ${os.numero} | ${os.empresa} | Pedido: ${os.pedidoNumero} | Status: ${os.status} | Tempo: ${elapsedTime(os.createdAt)}`;
      if (os.motivoCancelamento) text += ` | Motivo: ${os.motivoCancelamento}`;
      text += '\n';
    });

    return text;
  };

  const runAiAnalysis = async () => {
    setAiLoading(true);
    setAiResponse('');
    const sessionToken = localStorage.getItem('rp_session_token');
    if (!sessionToken) { toast.error('Sessão expirada'); setAiLoading(false); return; }

    try {
      abortRef.current = new AbortController();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `${promptText}\n\n---\n\n${buildReportText()}` }],
          mode: 'ia',
          sessionToken,
        }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error('Limite de requisições. Tente novamente em instantes.');
        else if (resp.status === 402) toast.error('Créditos insuficientes.');
        else toast.error('Erro ao analisar relatório.');
        setAiLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) { full += content; setAiResponse(full); }
          } catch { /* partial chunk */ }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') { toast.error('Erro na análise de IA.'); console.error(e); }
    } finally {
      setAiLoading(false);
    }
  };

  const handleSavePrompt = () => {
    setEditingPrompt(false);
    onSaveMasterPrompt?.(promptText);
    toast.success('Prompt da IA salvo!');
  };

  const periodLabel = selectedDay
    ? formatDayKey(selectedDay)
    : `${MONTHS[selectedMonth]}/${selectedYear}`;

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

        {/* Year selector */}
        <div className="flex gap-2 ml-2 items-center">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <select
            value={selectedYear}
            onChange={e => { setSelectedYear(+e.target.value); setSelectedDay(null); }}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {selectedDay && (
            <button
              onClick={() => setSelectedDay(null)}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Ver todo o mês
            </button>
          )}
        </div>

        {/* AI button (right-aligned) */}
        {isMaster ? (
          <Button
            variant="outline"
            onClick={() => setEditingPrompt(!editingPrompt)}
            className="gap-2 ml-auto border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <Edit className="h-4 w-4" />
            {editingPrompt ? 'Fechar Editor IA' : 'Editar Prompt IA'}
          </Button>
        ) : (
          <Button
            onClick={runAiAnalysis}
            disabled={aiLoading}
            className="gap-2 ml-auto bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90"
          >
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiLoading ? 'Analisando...' : 'Análise IA'}
          </Button>
        )}
      </div>

      {/* ── master prompt editor ── */}
      {isMaster && editingPrompt && (
        <Card className="print:hidden">
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> Prompt de Treinamento da IA
            </h3>
            <p className="text-xs text-muted-foreground">
              Edite o texto abaixo para treinar como a IA avalia e motiva os vendedores.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              rows={10}
              className="text-xs font-mono"
            />
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={handleSavePrompt} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> Salvar Prompt
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPromptText(DEFAULT_AI_PROMPT)} className="gap-1.5">
                Restaurar Padrão
              </Button>
              <Button size="sm" variant="secondary" onClick={runAiAnalysis} disabled={aiLoading} className="gap-1.5 ml-auto">
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Testar Análise
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── AI response ── */}
      {aiResponse && (
        <Card className="border-primary/30 print:hidden">
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Análise da IA — {periodLabel}
            </h3>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
              <ReactMarkdown>{aiResponse}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── calendar + report layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── calendar (left column) ── */}
        <div className="lg:col-span-1 print:hidden">
          <CalendarGrid
            year={selectedYear}
            month={selectedMonth}
            dayActivity={dayActivity}
            selectedDay={selectedDay}
            onDayClick={setSelectedDay}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
          />
        </div>

        {/* ── report tables (right column) ── */}
        <div className="lg:col-span-2">
          <div className="bg-card border rounded-lg p-5 space-y-6 print:border-0 print:shadow-none print:p-0">
            {/* header */}
            <div>
              <h2 className="text-lg font-bold">{vendorName}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedDay ? `Relatório do dia ${formatDayKey(selectedDay)}` : `Relatório de ${MONTHS[selectedMonth]}/${selectedYear}`}
              </p>
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
            />

            {/* Pedidos */}
            <DocTable
              title="Pedidos"
              icon={ShoppingCart}
              iconColor="text-secondary"
              docs={displayPeds}
              emptyMsg="Nenhum pedido no período."
            />

            {/* Ordens de Serviço */}
            <DocTable
              title="Ordens de Serviço"
              icon={Factory}
              iconColor="text-accent"
              docs={displayOS}
              emptyMsg="Nenhuma O.S. no período."
            />
          </div>
        </div>
      </div>

      {isPrint && (
        <style>{`@media print { @page { margin: 0.5cm; } body { -webkit-print-color-adjust: exact; } .print\\:hidden { display: none !important; } }`}</style>
      )}
    </div>
  );
}
