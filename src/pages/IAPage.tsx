import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Bot, Send, Upload, Trash2, FileText, Cpu, Key,
  BookOpen, Zap, History, X, RotateCcw, Ruler,
  Sparkles, Loader2, ShoppingCart, Layers, Eye,
  ChevronDown, ChevronUp, Settings, Package, AlertCircle
} from 'lucide-react';
import { useIASettings } from '@/hooks/useIASettings';
import * as THREE from 'three';

// ─── FAÇO Catalog ─────────────────────────────────────────────────────────────
const FACO_CATALOG: Record<string, Record<string, { A: number; B: number; C: number; D: number }>> = {
  '1724-A':  { '18"': { A:190, B:178, C:159, D:20 }, '20"': { A:215, B:203, C:184, D:20 }, '24"': { A:258, B:246, C:227, D:20 }, '30"': { A:320, B:308, C:289, D:20 }, '36"': { A:380, B:368, C:349, D:20 }, '42"': { A:440, B:428, C:409, D:20 }, '48"': { A:500, B:488, C:469, D:20 }, '54"': { A:560, B:548, C:529, D:20 }, '60"': { A:620, B:608, C:589, D:20 } },
  '2024-AD': { '18"': { A:190, B:178, C:159, D:25 }, '20"': { A:215, B:203, C:184, D:25 }, '24"': { A:258, B:246, C:227, D:25 }, '30"': { A:320, B:308, C:289, D:25 }, '36"': { A:380, B:368, C:349, D:25 }, '42"': { A:440, B:428, C:409, D:25 }, '48"': { A:500, B:488, C:469, D:25 }, '54"': { A:560, B:548, C:529, D:25 }, '60"': { A:620, B:608, C:589, D:25 } },
  '2525-AD': { '18"': { A:190, B:178, C:159, D:30 }, '20"': { A:215, B:203, C:184, D:30 }, '24"': { A:258, B:246, C:227, D:30 }, '30"': { A:320, B:308, C:289, D:30 }, '36"': { A:380, B:368, C:349, D:30 }, '42"': { A:440, B:428, C:409, D:30 }, '48"': { A:500, B:488, C:469, D:30 }, '54"': { A:560, B:548, C:529, D:30 }, '60"': { A:620, B:608, C:589, D:30 } },
  '3030-AD': { '18"': { A:190, B:178, C:159, D:35 }, '20"': { A:215, B:203, C:184, D:35 }, '24"': { A:258, B:246, C:227, D:35 }, '30"': { A:320, B:308, C:289, D:35 }, '36"': { A:380, B:368, C:349, D:35 }, '42"': { A:440, B:428, C:409, D:35 }, '48"': { A:500, B:488, C:469, D:35 }, '54"': { A:560, B:548, C:529, D:35 }, '60"': { A:620, B:608, C:589, D:35 } },
  '3535-AD': { '18"': { A:190, B:178, C:159, D:40 }, '20"': { A:215, B:203, C:184, D:40 }, '24"': { A:258, B:246, C:227, D:40 }, '30"': { A:320, B:308, C:289, D:40 }, '36"': { A:380, B:368, C:349, D:40 }, '42"': { A:440, B:428, C:409, D:40 }, '48"': { A:500, B:488, C:469, D:40 }, '54"': { A:560, B:548, C:529, D:40 }, '60"': { A:620, B:608, C:589, D:40 } },
};

const RELEVANT_TERMS = [/\d+\s*(mm|pol|"|polegada)/i, /[øØ]\s*\d+/i, /rolete/i, /tambor/i, /cavalete/i, /correia/i, /série|serie/i, /\d{4}-[a-z]+/i, /carga|retorno|impacto|guia/i, /transportador/i, /esteira/i];
const isRelevant = (text: string) => RELEVANT_TERMS.some(r => r.test(text));

interface Dims { A: number; B: number; C: number; D: number }
interface ExtractedData { serie?: string; largura?: string; dimensoes?: Dims; tipo?: string; quantidade?: number }
interface Message { role: 'user' | 'assistant'; content: string; extracted?: ExtractedData; ts: string }
interface HistoryEntry { id: string; ts: string; input: string; output: string; extracted?: ExtractedData }

function lookupFaco(text: string): ExtractedData | null {
  const sm = text.match(/s[eé]rie\s*([\w-]+)/i) || text.match(/(\d{4}-[A-Z]+)/i);
  if (!sm) return null;
  const key = sm[1].toUpperCase().replace(/\s/g, '');
  const cat = FACO_CATALOG[key];
  if (!cat) return null;
  const lm = text.match(/(\d{2,3})\s*["pol]/i) || text.match(/correia\s*(\d{2,3})["']/i);
  const largura = lm ? `${lm[1]}"` : Object.keys(cat)[0];
  const dims = cat[largura];
  if (!dims) return null;
  const tm = text.match(/rolete\s+de\s+(\w+)/i);
  const qm = text.match(/(\d+)\s*(un|pç|peça|rolete)/i);
  return { serie: key, largura, dimensoes: dims, tipo: tm ? `Rolete de ${tm[1]}` : 'Rolete de Carga', quantidade: qm ? parseInt(qm[1]) : 1 };
}

// ─── SVG Drawing ──────────────────────────────────────────────────────────────
function TechnicalSVG({ data }: { data: ExtractedData }) {
  const d = data.dimensoes;
  if (!d) return null;
  const sc = 0.55, W = d.A * sc, H = 70, cx = 40, cy = 40;
  return (
    <svg viewBox={`0 0 ${W + 100} ${H + 90}`} className="w-full bg-white rounded-lg border" style={{ fontFamily: 'monospace', maxHeight: 260 }}>
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3z" fill="#ef4444"/></marker>
        <marker id="arrB" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3z" fill="#2563eb"/></marker>
        <marker id="arrG" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3z" fill="#16a34a"/></marker>
        <marker id="arrRev" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse"><path d="M0,0 L0,6 L6,3z" fill="#ef4444"/></marker>
      </defs>
      {/* Title */}
      <text x="10" y="16" fontSize="9" fill="#1e3a5f" fontWeight="bold">FAÇO Série {data.serie} — Correia {data.largura}</text>
      {/* Shaft */}
      <rect x={cx - d.D * sc} y={cy + H * 0.28} width={d.D * sc} height={H * 0.44} rx="2" fill="#cbd5e1" stroke="#64748b" strokeWidth="1"/>
      <rect x={cx + W} y={cy + H * 0.28} width={d.D * sc} height={H * 0.44} rx="2" fill="#cbd5e1" stroke="#64748b" strokeWidth="1"/>
      {/* Tube */}
      <rect x={cx} y={cy} width={W} height={H} rx="3" fill="#dbeafe" stroke="#1e40af" strokeWidth="1.5"/>
      {/* Center line */}
      <line x1={cx - d.D * sc - 5} y1={cy + H / 2} x2={cx + W + d.D * sc + 5} y2={cy + H / 2} stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="4,3"/>
      {/* Dim A */}
      <line x1={cx - d.D * sc} y1={cy + H + 22} x2={cx + W + d.D * sc} y2={cy + H + 22} stroke="#ef4444" strokeWidth="1" markerEnd="url(#arr)" markerStart="url(#arrRev)"/>
      <line x1={cx - d.D * sc} y1={cy + H + 14} x2={cx - d.D * sc} y2={cy + H + 28} stroke="#ef4444" strokeWidth="0.8"/>
      <line x1={cx + W + d.D * sc} y1={cy + H + 14} x2={cx + W + d.D * sc} y2={cy + H + 28} stroke="#ef4444" strokeWidth="0.8"/>
      <text x={(cx - d.D * sc + cx + W + d.D * sc) / 2} y={cy + H + 36} fontSize="9" fill="#ef4444" textAnchor="middle" fontWeight="bold">A = {d.A} mm</text>
      {/* Dim B */}
      <line x1={cx} y1={cy + H + 8} x2={cx + W} y2={cy + H + 8} stroke="#2563eb" strokeWidth="1" markerEnd="url(#arrB)" markerStart="url(#arrB)"/>
      <text x={cx + W / 2} y={cy + H + 18} fontSize="8" fill="#2563eb" textAnchor="middle">B = {d.B} mm</text>
      {/* Dim C */}
      <line x1={cx + (W - d.C * sc) / 2} y1={cy - 10} x2={cx + (W + d.C * sc) / 2} y2={cy - 10} stroke="#16a34a" strokeWidth="1" markerEnd="url(#arrG)" markerStart="url(#arrG)"/>
      <text x={cx + W / 2} y={cy - 14} fontSize="8" fill="#16a34a" textAnchor="middle">C = {d.C} mm</text>
      {/* Dim D */}
      <text x={cx - d.D * sc - 4} y={cy + H * 0.52} fontSize="8" fill="#7c3aed" textAnchor="end">Ø{d.D}</text>
    </svg>
  );
}

// ─── 3D Viewer ────────────────────────────────────────────────────────────────
function RollerViewer3D({ data }: { data: ExtractedData }) {
  const mountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mountRef.current || !data.dimensoes) return;
    const { A, D } = data.dimensoes;
    const el = mountRef.current;
    const W = el.clientWidth || 380, H = 220;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 500);
    camera.position.set(0, 1.8, 4.5);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1.2);
    dl.position.set(4, 6, 4); dl.castShadow = true; scene.add(dl);
    scene.add(new THREE.PointLight(0x3b82f6, 0.6, 15));
    const tLen = A / 100, sR = (D / 2) / 100, tR = 0.36;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(tR, tR, tLen, 48), new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.55, roughness: 0.35 }));
    tube.rotation.z = Math.PI / 2; tube.castShadow = true; scene.add(tube);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(sR, sR, tLen + 0.55, 24), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 }));
    shaft.rotation.z = Math.PI / 2; scene.add(shaft);
    [-tLen / 2, tLen / 2].forEach(x => {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(tR, tR, 0.035, 48), new THREE.MeshStandardMaterial({ color: 0x1e40af, metalness: 0.7, roughness: 0.2 }));
      cap.rotation.z = Math.PI / 2; cap.position.x = x; scene.add(cap);
    });
    const grid = new THREE.GridHelper(8, 18, 0x1e3a5f, 0x1e3a5f);
    grid.position.y = -tR - 0.04; scene.add(grid);
    let angle = 0, frame = 0;
    const animate = () => { frame = requestAnimationFrame(animate); angle += 0.007; tube.rotation.x = angle; shaft.rotation.x = angle; renderer.render(scene, camera); };
    animate();
    return () => { cancelAnimationFrame(frame); renderer.dispose(); if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement); };
  }, [data]);
  return <div ref={mountRef} className="w-full rounded-lg overflow-hidden border border-slate-700" style={{ height: 220 }} />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IAPage() {
  const navigate = useNavigate();
  const { settings } = useIASettings();

  // Config
  const [model, setModel] = useState('claude-3-5-sonnet-20240620');
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('Você é especialista em transportadores de correia e roletes industriais da Rollerport. Use o catálogo FAÇO para dimensionamento. Identifique séries, larguras de correia e retorne dimensões A, B, C, D. Reconheça Ø como diâmetro. Filtre apenas conteúdo técnico de transporte de carga.');
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string }[]>([]);
  const [showConfig, setShowConfig] = useState(false);

  // FAÇO lookup
  const [serie, setSerie] = useState('');
  const [largura, setLargura] = useState('');
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [showProject, setShowProject] = useState(false);

  // Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>(() => { try { return JSON.parse(localStorage.getItem('rp_ia_history') || '[]'); } catch { return []; } });
  const [showHistory, setShowHistory] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (settings.anthropic_key) setApiKey(settings.anthropic_key); else if (settings.openai_key) setApiKey(settings.openai_key); if (settings.modelo_padrao) setModel(settings.modelo_padrao); }, [settings]);

  const saveHistory = useCallback((entry: HistoryEntry) => {
    setHistory(prev => { const u = [entry, ...prev].slice(0, 40); localStorage.setItem('rp_ia_history', JSON.stringify(u)); return u; });
  }, []);

  const handleLookup = () => {
    if (!serie || !largura) { toast.warning('Selecione série e largura.'); return; }
    const dims = FACO_CATALOG[serie]?.[largura];
    if (!dims) { toast.error('Combinação não encontrada.'); return; }
    setExtracted({ serie, largura, dimensoes: dims, tipo: 'Rolete de Carga', quantidade: 1 });
    setShowProject(false);
    toast.success(`Série ${serie} — ${largura} carregada`);
  };

  const callAI = async (text: string): Promise<string> => {
    const key = apiKey || settings.anthropic_key || settings.openai_key;
    if (!key) throw new Error('Configure uma API Key nas configurações.');
    const catalogCtx = Object.entries(FACO_CATALOG).map(([s, largs]) =>
      `Série ${s}:\n` + Object.entries(largs).map(([l, d]) => `  ${l}: A=${d.A} B=${d.B} C=${d.C} D=${d.D}`).join('\n')
    ).join('\n\n');
    const fullPrompt = `${systemPrompt}\n\n=== CATÁLOGO FAÇO ===\n${catalogCtx}\n\n=== MENSAGEM ===\n${text}`;
    if (model.includes('claude')) {
      const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content: fullPrompt }] }) });
      if (!res.ok) throw new Error(`Anthropic ${res.status}`);
      const data = await res.json(); return data.content?.[0]?.text || 'Sem resposta.';
    } else {
      const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: fullPrompt }], max_tokens: 1024 }) });
      if (!res.ok) throw new Error(`OpenAI ${res.status}`);
      const data = await res.json(); return data.choices?.[0]?.message?.content || 'Sem resposta.';
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!isRelevant(input)) { toast.warning('Use termos técnicos: Rolete, Correia, mm, Ø, Série...'); return; }
    const local = lookupFaco(input);
    const userMsg: Message = { role: 'user', content: input, ts: new Date().toISOString() };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const reply = await callAI(input);
      const aMsg: Message = { role: 'assistant', content: reply, extracted: local || undefined, ts: new Date().toISOString() };
      setMessages(p => [...p, aMsg]);
      if (local) setExtracted(local);
      saveHistory({ id: Date.now().toString(), ts: new Date().toISOString(), input, output: reply, extracted: local || undefined });
    } catch (e: any) {
      toast.error(e.message);
      setMessages(p => [...p, { role: 'assistant', content: `Erro: ${e.message}`, ts: new Date().toISOString() }]);
    } finally { setLoading(false); }
  };

  const handleGerarOrcamento = () => {
    if (!extracted) { toast.warning('Nenhum dado extraído.'); return; }
    const p = new URLSearchParams({ ia_serie: extracted.serie || '', ia_largura: extracted.largura || '', ia_tipo: extracted.tipo || 'Rolete de Carga', ia_qtd: String(extracted.quantidade || 1), ia_dimA: String(extracted.dimensoes?.A || ''), ia_dimB: String(extracted.dimensoes?.B || ''), ia_dimC: String(extracted.dimensoes?.C || ''), ia_dimD: String(extracted.dimensoes?.D || '') });
    navigate(`/orcamentos?${p.toString()}`);
    toast.success('Dados enviados para Orçamentos');
  };

  return (
    <div className="space-y-6">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header">IA Técnica</h1>
          <p className="page-subtitle">Análise multimodal · Catálogo FAÇO · Geração de projetos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowHistory(true)} className="gap-2">
            <History className="h-4 w-4" /> Histórico
            {history.length > 0 && <Badge className="ml-1 bg-primary text-white text-[10px] px-1.5 py-0">{history.length}</Badge>}
          </Button>
          <Button variant="outline" onClick={() => setShowConfig(true)} className="gap-2">
            <Settings className="h-4 w-4" /> Configurações
          </Button>
        </div>
      </div>

      {/* ── FAÇO Lookup Card ── */}
      <div className="bg-card rounded-lg border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Consulta Catálogo FAÇO</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setSerie(''); setLargura(''); setExtracted(null); setShowProject(false); }} className="gap-1 text-muted-foreground hover:text-destructive h-7 text-xs">
            <RotateCcw className="h-3 w-3" /> Limpar
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Série</label>
            <Select value={serie} onValueChange={v => { setSerie(v); setLargura(''); }}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{Object.keys(FACO_CATALOG).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Largura da Correia</label>
            <Select value={largura} onValueChange={setLargura} disabled={!serie}>
              <SelectTrigger className="w-28 h-9"><SelectValue placeholder="Largura..." /></SelectTrigger>
              <SelectContent>{serie && Object.keys(FACO_CATALOG[serie] || {}).map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleLookup} className="gap-2 h-9"><Zap className="h-4 w-4" /> Buscar Dimensões</Button>
        </div>

        {/* Results */}
        {extracted?.dimensoes && (
          <div className="mt-5 space-y-4">
            {/* Dimension table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="px-4 py-2.5 text-left rounded-tl-lg font-medium">Série</th>
                    <th className="px-4 py-2.5 text-left font-medium">Correia</th>
                    <th className="px-4 py-2.5 text-center font-medium">A (mm)</th>
                    <th className="px-4 py-2.5 text-center font-medium">B (mm)</th>
                    <th className="px-4 py-2.5 text-center font-medium">C (mm)</th>
                    <th className="px-4 py-2.5 text-center rounded-tr-lg font-medium">Ø D (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-blue-50 border border-blue-200">
                    <td className="px-4 py-3 font-bold text-primary">{extracted.serie}</td>
                    <td className="px-4 py-3 text-muted-foreground">{extracted.largura}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-red-600 text-base">{extracted.dimensoes.A}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-blue-600 text-base">{extracted.dimensoes.B}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-green-600 text-base">{extracted.dimensoes.C}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-purple-600 text-base">{extracted.dimensoes.D}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleGerarOrcamento} className="gap-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                <ShoppingCart className="h-4 w-4" /> Gerar Orçamento
              </Button>
              <Button onClick={() => setShowProject(p => !p)} variant="outline" className="gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                <Layers className="h-4 w-4" /> {showProject ? 'Ocultar Projeto' : 'Gerar Projeto'}
              </Button>
            </div>

            {/* Technical Project */}
            {showProject && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Eye className="h-3 w-3" /> Desenho Técnico — Cotas A, B, C, D</p>
                  <TechnicalSVG data={extracted} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Package className="h-3 w-3" /> Modelo 3D — Three.js</p>
                  <RollerViewer3D data={extracted} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Full Catalog Table ── */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="p-4 border-b bg-muted/20 flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Catálogo Completo FAÇO</span>
          <span className="text-xs text-muted-foreground ml-1">— todas as séries e dimensões</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Série</th>
                <th className="text-left p-3 font-medium">Correia</th>
                <th className="text-center p-3 font-medium text-red-600">A (mm)</th>
                <th className="text-center p-3 font-medium text-blue-600">B (mm)</th>
                <th className="text-center p-3 font-medium text-green-600">C (mm)</th>
                <th className="text-center p-3 font-medium text-purple-600">Ø D (mm)</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(FACO_CATALOG).flatMap(([s, largs]) =>
                Object.entries(largs).map(([l, d], i) => (
                  <tr key={`${s}-${l}`} className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer ${extracted?.serie === s && extracted?.largura === l ? 'bg-blue-50' : ''}`}
                    onClick={() => { setSerie(s); setLargura(l); setExtracted({ serie: s, largura: l, dimensoes: d, tipo: 'Rolete de Carga', quantidade: 1 }); setShowProject(false); }}>
                    <td className="p-3 font-medium text-primary">{i === 0 ? s : ''}</td>
                    <td className="p-3 text-muted-foreground">{l}</td>
                    <td className="p-3 text-center font-mono font-semibold text-red-600">{d.A}</td>
                    <td className="p-3 text-center font-mono font-semibold text-blue-600">{d.B}</td>
                    <td className="p-3 text-center font-mono font-semibold text-green-600">{d.C}</td>
                    <td className="p-3 text-center font-mono font-semibold text-purple-600">{d.D}</td>
                    <td className="p-3 text-center">
                      <button className="text-xs text-primary hover:underline" onClick={e => { e.stopPropagation(); setSerie(s); setLargura(l); setExtracted({ serie: s, largura: l, dimensoes: d, tipo: 'Rolete de Carga', quantidade: 1 }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Selecionar</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── AI Chat Card ── */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Análise por IA</span>
            <Badge variant="outline" className="text-[10px] px-1.5">{model.includes('claude') ? 'Claude' : 'GPT'}</Badge>
          </div>
          <button onClick={() => { setMessages([]); setExtracted(null); setShowProject(false); }} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
            <RotateCcw className="h-3 w-3" /> Limpar
          </button>
        </div>

        {/* Messages */}
        <div className="p-4 space-y-3 overflow-y-auto" style={{ minHeight: 200, maxHeight: 380 }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bot className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">Descreva o rolete ou cole dados técnicos aqui.</p>
              <p className="text-xs mt-1 opacity-60">Ex: "Rolete de Carga Série 2024-AD, correia 24", Ø76mm, 10 peças"</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.extracted?.dimensoes && (
                  <div className="mt-2 pt-2 border-t border-white/20 text-xs font-mono opacity-75">
                    A={m.extracted.dimensoes.A} · B={m.extracted.dimensoes.B} · C={m.extracted.dimensoes.C} · Ø{m.extracted.dimensoes.D}
                  </div>
                )}
                <p className="text-[10px] opacity-40 mt-1">{new Date(m.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-muted/10">
          <div className="flex gap-2">
            <Input
              placeholder='Ex: "Série 2024-AD, correia 24", Ø76mm, 10 roletes de carga"'
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={loading}
              className="text-sm"
            />
            <Button onClick={handleSend} disabled={loading || !input.trim()} className="shrink-0 gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Filtro ativo: apenas conteúdo técnico de transporte de carga é processado.
          </p>
        </div>
      </div>

      {/* ── Config Dialog ── */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings className="h-4 w-4" /> Configurações da IA</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5" /> Modelo</label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-3-5-sonnet-20240620">Claude 3.5 Sonnet</SelectItem>
                  <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5"><Key className="h-3.5 w-3.5" /> API Key</label>
              <Input type="password" placeholder="sk-... ou sk-ant-..." value={apiKey} onChange={e => setApiKey(e.target.value)} className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground">Anthropic: sk-ant-... · OpenAI: sk-...</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Instruções de Sistema</label>
              <Textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} className="text-sm resize-none h-24" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Upload de Padrões</label>
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 text-sm text-primary border border-dashed border-primary/40 rounded-lg px-4 py-3 w-full justify-center hover:bg-primary/5 transition-colors">
                <Upload className="h-4 w-4" /> Carregar PDF, Excel ou Imagem
              </button>
              <input ref={fileRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg" className="hidden" onChange={e => { Array.from(e.target.files || []).forEach(f => setUploadedFiles(p => [...p, { name: f.name }])); toast.success('Arquivo(s) carregado(s)'); e.target.value = ''; }} />
              {uploadedFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-muted rounded px-3 py-1.5">
                  <span className="flex items-center gap-1.5"><FileText className="h-3 w-3" />{f.name}</span>
                  <button onClick={() => setUploadedFiles(p => p.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setApiKey(''); setSystemPrompt(''); }} className="gap-1 text-xs"><RotateCcw className="h-3 w-3" /> Limpar</Button>
              <Button onClick={() => { setShowConfig(false); toast.success('Configurações salvas'); }}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── History Dialog ── */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><History className="h-4 w-4" /> Histórico de Análises</span>
              <Button variant="ghost" size="sm" onClick={() => { setHistory([]); localStorage.removeItem('rp_ia_history'); }} className="text-destructive hover:text-destructive gap-1 text-xs h-7">
                <Trash2 className="h-3 w-3" /> Limpar tudo
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {history.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum histórico ainda.</p>}
            {history.map(h => (
              <div key={h.id} className="border rounded-lg p-3 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => { setMessages([{ role: 'user', content: h.input, ts: h.ts }, { role: 'assistant', content: h.output, extracted: h.extracted, ts: h.ts }]); if (h.extracted) setExtracted(h.extracted); setShowHistory(false); }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium truncate">{h.input}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">{new Date(h.ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{h.output}</p>
                {h.extracted?.serie && <Badge className="mt-2 text-[10px] bg-primary/10 text-primary border-0">{h.extracted.serie} · {h.extracted.largura}</Badge>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
