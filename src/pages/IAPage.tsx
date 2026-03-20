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
  Settings, Package, AlertCircle, Download, Printer, MessageCircle
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

// ─── SVG Drawing (modelo FAÇO com vista frontal e lateral) ────────────────────
function buildSVGContent(data: ExtractedData): string {
  const d = data.dimensoes!;
  const sc = 0.52;
  const W = d.A * sc;
  const H = 80;          // altura do tubo
  const cx = 60;         // margem esquerda (espaço para label Ø D)
  const cy = 90;         // topo do tubo — espaço suficiente para título + cota C acima
  const shaftW = Math.max(d.D * sc, 10);

  // Largura total do viewBox: cx + W + shaftW + margem direita
  const vw = cx + W + shaftW + 30;
  // Altura total: cy (topo) + H (tubo) + espaço para cotas B e A abaixo + legenda 4 linhas
  const vh = cy + H + 130;

  // Posições das cotas abaixo do tubo
  const cotaB_y = cy + H + 18;   // linha da cota B
  const cotaB_txt = cy + H + 30; // texto da cota B
  const cotaA_y = cy + H + 46;   // linha da cota A
  const cotaA_txt = cy + H + 58; // texto da cota A

  // Cota C acima do tubo
  const cotaC_y = cy - 22;       // linha da cota C
  const cotaC_txt = cy - 26;     // texto da cota C

  // Legenda no rodapé — 4 linhas empilhadas, sem colunas
  const leg_y = vh - 58;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" style="font-family:monospace;background:#fff">
  <defs>
    <marker id="arr"   markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3z" fill="#ef4444"/></marker>
    <marker id="arrRv" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse"><path d="M0,0 L0,6 L6,3z" fill="#ef4444"/></marker>
    <marker id="arrB"  markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3z" fill="#2563eb"/></marker>
    <marker id="arrBR" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse"><path d="M0,0 L0,6 L6,3z" fill="#2563eb"/></marker>
    <marker id="arrG"  markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3z" fill="#16a34a"/></marker>
    <marker id="arrGR" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse"><path d="M0,0 L0,6 L6,3z" fill="#16a34a"/></marker>
  </defs>

  <!-- ── Título ── -->
  <text x="${vw / 2}" y="16" font-size="10" fill="#1e3a5f" font-weight="bold" text-anchor="middle">FAÇO Série ${data.serie} — Correia ${data.largura}</text>
  <text x="${vw / 2}" y="28" font-size="8" fill="#64748b" text-anchor="middle">Desenho Técnico · Vista Frontal</text>

  <!-- ── Cota C acima (entre furos) ── -->
  <line x1="${cx + (W - d.C * sc) / 2}" y1="${cotaC_y}" x2="${cx + (W + d.C * sc) / 2}" y2="${cotaC_y}" stroke="#16a34a" stroke-width="1" marker-end="url(#arrG)" marker-start="url(#arrGR)"/>
  <line x1="${cx + (W - d.C * sc) / 2}" y1="${cy - 4}" x2="${cx + (W - d.C * sc) / 2}" y2="${cotaC_y - 4}" stroke="#16a34a" stroke-width="0.8"/>
  <line x1="${cx + (W + d.C * sc) / 2}" y1="${cy - 4}" x2="${cx + (W + d.C * sc) / 2}" y2="${cotaC_y - 4}" stroke="#16a34a" stroke-width="0.8"/>
  <text x="${cx + W / 2}" y="${cotaC_txt}" font-size="9" fill="#16a34a" text-anchor="middle" font-weight="bold">C = ${d.C} mm</text>

  <!-- ── Eixo esquerdo ── -->
  <rect x="${cx - shaftW}" y="${cy + H * 0.28}" width="${shaftW}" height="${H * 0.44}" rx="2" fill="#cbd5e1" stroke="#64748b" stroke-width="1"/>
  <!-- ── Eixo direito ── -->
  <rect x="${cx + W}" y="${cy + H * 0.28}" width="${shaftW}" height="${H * 0.44}" rx="2" fill="#cbd5e1" stroke="#64748b" stroke-width="1"/>
  <!-- ── Tubo principal ── -->
  <rect x="${cx}" y="${cy}" width="${W}" height="${H}" rx="3" fill="#dbeafe" stroke="#1e40af" stroke-width="1.5"/>
  <!-- ── Tampas ── -->
  <rect x="${cx}" y="${cy}" width="7" height="${H}" fill="#93c5fd" stroke="#1e40af" stroke-width="1"/>
  <rect x="${cx + W - 7}" y="${cy}" width="7" height="${H}" fill="#93c5fd" stroke="#1e40af" stroke-width="1"/>
  <!-- ── Linha de centro ── -->
  <line x1="${cx - shaftW - 10}" y1="${cy + H / 2}" x2="${cx + W + shaftW + 10}" y2="${cy + H / 2}" stroke="#94a3b8" stroke-width="0.6" stroke-dasharray="5,3"/>

  <!-- ── Label Ø D (lado esquerdo) ── -->
  <line x1="${cx - shaftW - 4}" y1="${cy + H * 0.28}" x2="${cx - shaftW - 4}" y2="${cy + H * 0.72}" stroke="#7c3aed" stroke-width="0.8" marker-end="url(#arrG)" marker-start="url(#arrGR)" style="marker-end:none;marker-start:none"/>
  <text x="${cx - shaftW - 8}" y="${cy + H * 0.52}" font-size="9" fill="#7c3aed" text-anchor="end" dominant-baseline="middle" font-weight="bold">Ø ${d.D}</text>

  <!-- ── Cota B abaixo (comprimento do tubo) ── -->
  <line x1="${cx}" y1="${cotaB_y}" x2="${cx + W}" y2="${cotaB_y}" stroke="#2563eb" stroke-width="1" marker-end="url(#arrB)" marker-start="url(#arrBR)"/>
  <line x1="${cx}" y1="${cy + H + 4}" x2="${cx}" y2="${cotaB_y + 6}" stroke="#2563eb" stroke-width="0.8"/>
  <line x1="${cx + W}" y1="${cy + H + 4}" x2="${cx + W}" y2="${cotaB_y + 6}" stroke="#2563eb" stroke-width="0.8"/>
  <text x="${cx + W / 2}" y="${cotaB_txt}" font-size="9" fill="#2563eb" text-anchor="middle" font-weight="bold">B = ${d.B} mm</text>

  <!-- ── Cota A abaixo (comprimento total) ── -->
  <line x1="${cx - shaftW}" y1="${cotaA_y}" x2="${cx + W + shaftW}" y2="${cotaA_y}" stroke="#ef4444" stroke-width="1.2" marker-end="url(#arr)" marker-start="url(#arrRv)"/>
  <line x1="${cx - shaftW}" y1="${cotaB_y + 8}" x2="${cx - shaftW}" y2="${cotaA_y + 6}" stroke="#ef4444" stroke-width="0.8"/>
  <line x1="${cx + W + shaftW}" y1="${cotaB_y + 8}" x2="${cx + W + shaftW}" y2="${cotaA_y + 6}" stroke="#ef4444" stroke-width="0.8"/>
  <text x="${cx + W / 2}" y="${cotaA_txt}" font-size="9" fill="#ef4444" text-anchor="middle" font-weight="bold">A = ${d.A} mm</text>

  <!-- ── Legenda ── -->
  <rect x="8" y="${leg_y}" width="${vw - 16}" height="52" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.8" rx="4"/>
  <text x="18" y="${leg_y + 13}" font-size="8" fill="#ef4444" font-weight="bold">■  A = Comprimento Total = ${d.A} mm</text>
  <text x="18" y="${leg_y + 25}" font-size="8" fill="#2563eb" font-weight="bold">■  B = Comprimento do Tubo = ${d.B} mm</text>
  <text x="18" y="${leg_y + 37}" font-size="8" fill="#16a34a" font-weight="bold">■  C = Entre Furos = ${d.C} mm</text>
  <text x="18" y="${leg_y + 49}" font-size="8" fill="#7c3aed" font-weight="bold">■  D = Diâmetro do Eixo = Ø ${d.D} mm</text>
</svg>`;
}

// SVG simplificado para preview — só o rolete com eixos, sem cotas nem legenda
function buildSVGPreview(data: ExtractedData): string {
  const d = data.dimensoes!;
  const sc = 0.7;
  const W = d.A * sc;
  const H = 60;
  const shaftW = Math.max(d.D * sc, 12);
  const pad = 20;
  const vw = W + shaftW * 2 + pad * 2;
  const vh = H + pad * 2;
  const cx = pad + shaftW;
  const cy = pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" style="font-family:monospace;background:#fff">
  <rect x="${cx - shaftW}" y="${cy + H * 0.28}" width="${shaftW}" height="${H * 0.44}" rx="2" fill="#cbd5e1" stroke="#64748b" stroke-width="1"/>
  <rect x="${cx + W}" y="${cy + H * 0.28}" width="${shaftW}" height="${H * 0.44}" rx="2" fill="#cbd5e1" stroke="#64748b" stroke-width="1"/>
  <rect x="${cx}" y="${cy}" width="${W}" height="${H}" rx="3" fill="#dbeafe" stroke="#1e40af" stroke-width="1.5"/>
  <rect x="${cx}" y="${cy}" width="8" height="${H}" fill="#93c5fd" stroke="#1e40af" stroke-width="1"/>
  <rect x="${cx + W - 8}" y="${cy}" width="8" height="${H}" fill="#93c5fd" stroke="#1e40af" stroke-width="1"/>
  <line x1="${cx - shaftW - 6}" y1="${cy + H / 2}" x2="${cx + W + shaftW + 6}" y2="${cy + H / 2}" stroke="#94a3b8" stroke-width="0.6" stroke-dasharray="5,3"/>
  <text x="${vw / 2}" y="${vh - 4}" font-size="8" fill="#64748b" text-anchor="middle">${data.serie} · ${data.largura} · A=${d.A} B=${d.B} C=${d.C} Ø${d.D}</text>
</svg>`;
}

function TechnicalSVG({ data, onClick }: { data: ExtractedData; onClick?: () => void }) {
  const d = data.dimensoes;
  if (!d) return null;
  return (
    <div
      className="w-full rounded-lg border overflow-hidden cursor-zoom-in hover:ring-2 hover:ring-primary/40 transition-all bg-white"
      title="Clique para ampliar com cotas completas"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: buildSVGPreview(data) }}
    />
  );
}

// ─── SVG Popup Modal ──────────────────────────────────────────────────────────
function TechnicalDrawingModal({ data, open, onClose }: { data: ExtractedData; open: boolean; onClose: () => void }) {
  if (!data.dimensoes) return null;
  const svgStr = buildSVGContent(data);

  const handleDownload = () => {
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `desenho-tecnico-${data.serie}-${data.largura?.replace('"', 'pol')}.svg`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('SVG baixado');
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Desenho Técnico ${data.serie}</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff}svg{max-width:90vw;max-height:90vh}</style></head><body>${svgStr}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const handlePDF = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Desenho Técnico ${data.serie}</title><style>@page{size:A4 landscape;margin:10mm}body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff}svg{width:100%;max-height:90vh}</style></head><body>${svgStr}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
    toast.info('Use "Salvar como PDF" na janela de impressão');
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`Desenho Técnico FAÇO\nSérie: ${data.serie}\nCorreia: ${data.largura}\nA=${data.dimensoes?.A}mm | B=${data.dimensoes?.B}mm | C=${data.dimensoes?.C}mm | Ø${data.dimensoes?.D}mm`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" /> Desenho Técnico — FAÇO {data.serie} · {data.largura}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-auto max-h-[60vh] rounded-lg border bg-white p-2" dangerouslySetInnerHTML={{ __html: svgStr }} />
        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={handleDownload} variant="outline" className="gap-2"><Download className="h-4 w-4" /> Baixar SVG</Button>
          <Button onClick={handlePDF} variant="outline" className="gap-2"><FileText className="h-4 w-4" /> Gerar PDF</Button>
          <Button onClick={handlePrint} variant="outline" className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
          <Button onClick={handleWhatsApp} variant="outline" className="gap-2 text-green-600 border-green-300 hover:bg-green-50"><MessageCircle className="h-4 w-4" /> Enviar por Zap</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 3D Viewer com OrbitControls manual ───────────────────────────────────────
function RollerViewer3D({ data, height = 240 }: { data: ExtractedData; height?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer | null;
    frame: number;
    isDragging: boolean;
    lastX: number;
    lastY: number;
    rotX: number;
    rotY: number;
    autoRotate: boolean;
  }>({ renderer: null, frame: 0, isDragging: false, lastX: 0, lastY: 0, rotX: 0, rotY: 0, autoRotate: true });

  useEffect(() => {
    if (!mountRef.current || !data.dimensoes) return;
    const { A, D } = data.dimensoes;
    const el = mountRef.current;
    const W = el.clientWidth || 380, H = height;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 500);
    camera.position.set(0, 1.8, 4.5);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);
    stateRef.current.renderer = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1.2);
    dl.position.set(4, 6, 4); dl.castShadow = true; scene.add(dl);
    scene.add(new THREE.PointLight(0x3b82f6, 0.6, 15));

    const tLen = A / 100, sR = (D / 2) / 100, tR = 0.36;
    const group = new THREE.Group();

    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(tR, tR, tLen, 48),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.55, roughness: 0.35 })
    );
    tube.rotation.z = Math.PI / 2; tube.castShadow = true; group.add(tube);

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(sR, sR, tLen + 0.55, 24),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 })
    );
    shaft.rotation.z = Math.PI / 2; group.add(shaft);

    [-tLen / 2, tLen / 2].forEach(x => {
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(tR, tR, 0.04, 48),
        new THREE.MeshStandardMaterial({ color: 0x1e40af, metalness: 0.7, roughness: 0.2 })
      );
      cap.rotation.z = Math.PI / 2; cap.position.x = x; group.add(cap);
    });

    scene.add(group);
    const grid = new THREE.GridHelper(8, 18, 0x1e3a5f, 0x1e3a5f);
    grid.position.y = -tR - 0.04; scene.add(grid);

    const s = stateRef.current;
    const animate = () => {
      s.frame = requestAnimationFrame(animate);
      if (s.autoRotate && !s.isDragging) s.rotY += 0.007;
      group.rotation.x = s.rotX;
      group.rotation.y = s.rotY;
      renderer.render(scene, camera);
    };
    animate();

    // Mouse events
    const onDown = (e: MouseEvent) => { s.isDragging = true; s.lastX = e.clientX; s.lastY = e.clientY; s.autoRotate = false; };
    const onMove = (e: MouseEvent) => {
      if (!s.isDragging) return;
      s.rotY += (e.clientX - s.lastX) * 0.01;
      s.rotX += (e.clientY - s.lastY) * 0.01;
      s.lastX = e.clientX; s.lastY = e.clientY;
    };
    const onUp = () => { s.isDragging = false; };

    // Touch events
    const onTouchStart = (e: TouchEvent) => { s.isDragging = true; s.lastX = e.touches[0].clientX; s.lastY = e.touches[0].clientY; s.autoRotate = false; };
    const onTouchMove = (e: TouchEvent) => {
      if (!s.isDragging) return;
      s.rotY += (e.touches[0].clientX - s.lastX) * 0.01;
      s.rotX += (e.touches[0].clientY - s.lastY) * 0.01;
      s.lastX = e.touches[0].clientX; s.lastY = e.touches[0].clientY;
    };

    renderer.domElement.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    renderer.domElement.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onUp);

    return () => {
      cancelAnimationFrame(s.frame);
      renderer.domElement.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      stateRef.current.renderer = null;
    };
  }, [data]);

  return (
    <div className="relative">
      <div ref={mountRef} className="w-full rounded-lg overflow-hidden border border-slate-700 cursor-grab active:cursor-grabbing" style={{ height }} />
      <p className="text-[10px] text-muted-foreground mt-1 text-center">Arraste para rotacionar · Auto-rotação ao soltar</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IAPage() {
  const navigate = useNavigate();
  const { settings } = useIASettings();

  const [model, setModel] = useState(() => localStorage.getItem('rp_ia_model') || 'llama-3.3-70b-versatile');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('rp_ia_key') || '');
  const [usePaid, setUsePaid] = useState(() => {
    const m = localStorage.getItem('rp_ia_model') || '';
    return m.includes('claude') || m.includes('gpt');
  });
  const [systemPrompt, setSystemPrompt] = useState('Você é especialista em transportadores de correia e roletes industriais da Rollerport. Use o catálogo FAÇO para dimensionamento. Identifique séries, larguras de correia e retorne dimensões A, B, C, D. Reconheça Ø como diâmetro. Filtre apenas conteúdo técnico de transporte de carga.');
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string }[]>([]);
  const [showConfig, setShowConfig] = useState(false);

  // Tabelas FAÇO carregadas pelo usuário (imagens base64)
  const [facoTables, setFacoTables] = useState<{ name: string; base64: string; mediaType: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('rp_faco_tables') || '[]'); } catch { return []; }
  });
  const facoTableRef = useRef<HTMLInputElement>(null);
  const [loadingLookup, setLoadingLookup] = useState(false);

  const [serie, setSerie] = useState('');
  const [largura, setLargura] = useState('');
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [showProject, setShowProject] = useState(false);
  const [showDrawingModal, setShowDrawingModal] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('rp_ia_history') || '[]'); } catch { return []; }
  });
  const [showHistory, setShowHistory] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    // Só preenche key se não tiver nada salvo localmente e vier do settings (OpenAI/Anthropic)
    if (!apiKey) {
      if (settings.anthropic_key && model.includes('claude')) setApiKey(settings.anthropic_key);
      else if (settings.openai_key && model.includes('gpt')) setApiKey(settings.openai_key);
    }
    if (settings.modelo_padrao && !localStorage.getItem('rp_ia_model')) setModel(settings.modelo_padrao);
  }, [settings]);

  const saveHistory = useCallback((entry: HistoryEntry) => {
    setHistory(prev => {
      const u = [entry, ...prev].slice(0, 40);
      localStorage.setItem('rp_ia_history', JSON.stringify(u));
      return u;
    });
  }, []);

  // Carrega imagens das tabelas FAÇO como base64
  const handleFacoTableUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        // result = "data:image/png;base64,XXXX"
        const [header, base64] = result.split(',');
        const mediaType = header.replace('data:', '').replace(';base64', '');
        setFacoTables(prev => {
          const updated = [...prev, { name: file.name, base64, mediaType }];
          localStorage.setItem('rp_faco_tables', JSON.stringify(updated));
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
    toast.success(`${files.length} tabela(s) FAÇO carregada(s)`);
  };

  const removeFacoTable = (i: number) => {
    setFacoTables(prev => {
      const updated = prev.filter((_, j) => j !== i);
      localStorage.setItem('rp_faco_tables', JSON.stringify(updated));
      return updated;
    });
  };

  // Busca dimensões: se há tabelas carregadas, usa IA com visão; senão usa catálogo local
  const handleLookup = async () => {
    if (!serie || !largura) { toast.warning('Selecione série e largura.'); return; }

    // Sem tabelas: usa catálogo hardcoded
    if (facoTables.length === 0) {
      const dims = FACO_CATALOG[serie]?.[largura];
      if (!dims) { toast.error('Combinação não encontrada no catálogo local. Carregue as tabelas FAÇO nas Configurações.'); return; }
      const result: ExtractedData = { serie, largura, dimensoes: dims, tipo: 'Rolete de Carga', quantidade: 1 };
      setExtracted(result);
      setShowProject(false);
      saveHistory({ id: Date.now().toString(), ts: new Date().toISOString(), input: `Consulta catálogo: Série ${serie} — ${largura}`, output: `A=${dims.A}mm | B=${dims.B}mm | C=${dims.C}mm | Ø${dims.D}mm`, extracted: result });
      toast.success(`Série ${serie} — ${largura} carregada`);
      return;
    }

    // Com tabelas: envia para IA com visão
    const key = localStorage.getItem('rp_ia_key') || apiKey;
    if (!key) { toast.error('Configure a API Key nas Configurações.'); return; }
    setLoadingLookup(true);
    try {
      const prompt = `Analise as tabelas FAÇO nas imagens e retorne APENAS um JSON com as dimensões do rolete para:\n- Série: ${serie}\n- Largura da correia: ${largura}\n\nFormato esperado (somente JSON, sem texto extra):\n{"A": 320, "B": 308, "C": 289, "D": 25}\n\nSe não encontrar, retorne: {"erro": "não encontrado"}`;

      let dimsResult: Dims | null = null;

      if (model.includes('claude')) {
        // Claude — visão nativa
        const imageContent = facoTables.map(t => ({
          type: 'image',
          source: { type: 'base64', media_type: t.mediaType, data: t.base64 }
        }));
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model, max_tokens: 256, messages: [{ role: 'user', content: [...imageContent, { type: 'text', text: prompt }] }] })
        });
        if (!res.ok) throw new Error(`Anthropic ${res.status}`);
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) dimsResult = JSON.parse(match[0]);

      } else if (model.includes('gpt')) {
        // GPT-4o — visão nativa
        const imageContent = facoTables.map(t => ({
          type: 'image_url',
          image_url: { url: `data:${t.mediaType};base64,${t.base64}` }
        }));
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: [...imageContent, { type: 'text', text: prompt }] }], max_tokens: 256 })
        });
        if (!res.ok) throw new Error(`OpenAI ${res.status}`);
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) dimsResult = JSON.parse(match[0]);

      } else if (model.includes('gemini')) {
        // Gemini — visão nativa
        const imageParts = facoTables.map(t => ({ inline_data: { mime_type: t.mediaType, data: t.base64 } }));
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [...imageParts, { text: prompt }] }], generationConfig: { maxOutputTokens: 256 } })
        });
        if (!res.ok) throw new Error(`Gemini ${res.status}`);
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) dimsResult = JSON.parse(match[0]);

      } else {
        // Groq (Llama/Mixtral/Gemma) — sem visão, usa catálogo embutido via texto
        const catalogCtx = Object.entries(FACO_CATALOG).map(([s, largs]) =>
          `Série ${s}:\n` + Object.entries(largs).map(([l, d]) => `  ${l}: A=${d.A} B=${d.B} C=${d.C} D=${d.D}`).join('\n')
        ).join('\n\n');
        const textPrompt = `Você é especialista em roletes FAÇO. Com base no catálogo abaixo, retorne APENAS um JSON com as dimensões para Série: ${serie}, Largura: ${largura}.\n\nFormato: {"A": 320, "B": 308, "C": 289, "D": 25}\n\nCATÁLOGO:\n${catalogCtx}`;
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: textPrompt }], max_tokens: 128 })
        });
        if (!res.ok) throw new Error(`Groq ${res.status}`);
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) dimsResult = JSON.parse(match[0]);
      }

      if (!dimsResult || (dimsResult as any).erro) {
        toast.error('IA não encontrou as dimensões nas tabelas. Verifique a imagem ou use o catálogo local.');
        return;
      }

      const result: ExtractedData = { serie, largura, dimensoes: dimsResult, tipo: 'Rolete de Carga', quantidade: 1 };
      setExtracted(result);
      setShowProject(false);
      saveHistory({ id: Date.now().toString(), ts: new Date().toISOString(), input: `Consulta IA (tabela): Série ${serie} — ${largura}`, output: `A=${dimsResult.A}mm | B=${dimsResult.B}mm | C=${dimsResult.C}mm | Ø${dimsResult.D}mm`, extracted: result });
      toast.success(`Dimensões extraídas pela IA das tabelas FAÇO`);
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('401')) toast.error('API Key inválida ou expirada. Verifique nas Configurações.');
      else if (msg.includes('429')) toast.error('Limite de requisições atingido. Aguarde um momento.');
      else toast.error(`Erro: ${msg}`);
    } finally {
      setLoadingLookup(false);
    }
  };

  const callAI = async (text: string): Promise<string> => {
    // Lê direto do localStorage para evitar closure stale
    const key = localStorage.getItem('rp_ia_key') || apiKey;
    const currentModel = localStorage.getItem('rp_ia_model') || model;
    if (!key) throw new Error('Configure a API Key nas Configurações.');

    const catalogCtx = Object.entries(FACO_CATALOG).map(([s, largs]) =>
      `Série ${s}: ` + Object.entries(largs).map(([l, d]) => `${l}→A=${d.A} B=${d.B} C=${d.C} D=${d.D}`).join(' | ')
    ).join('\n');

    const userMsg = `${text}\n\nCATÁLOGO FAÇO:\n${catalogCtx}`;

    // ── Groq (gratuito) ──
    if (currentModel.includes('llama') || currentModel.includes('mixtral') || currentModel.includes('gemma')) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: currentModel, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }], max_tokens: 1024 })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Groq ${res.status}: ${(e as any)?.error?.message || ''}`); }
      const data = await res.json(); return data.choices?.[0]?.message?.content || 'Sem resposta.';
    }

    // ── Gemini (gratuito) ──
    if (currentModel.includes('gemini')) {
      const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.3 }
      };
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Gemini ${res.status}: ${(e as any)?.error?.message || ''}`); }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta.';
    }

    // ── Claude (pago) ──
    if (currentModel.includes('claude')) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: currentModel, max_tokens: 1024, system: systemPrompt, messages: [{ role: 'user', content: userMsg }] })
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}`);
      const data = await res.json(); return data.content?.[0]?.text || 'Sem resposta.';
    }

    // ── OpenAI (pago) ──
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: currentModel, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }], max_tokens: 1024 })
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json(); return data.choices?.[0]?.message?.content || 'Sem resposta.';
  };

  // Análise local sem API key — extrai dados do texto usando catálogo + regex
  const analyzeLocal = (text: string): string => {
    const local = lookupFaco(text);
    if (local?.dimensoes) {
      const d = local.dimensoes;
      return `Dados encontrados no catálogo FAÇO:\n\n` +
        `• Série: ${local.serie}\n` +
        `• Correia: ${local.largura}\n` +
        `• Tipo: ${local.tipo}\n` +
        `• Quantidade: ${local.quantidade}\n\n` +
        `Dimensões:\n` +
        `  A (comprimento total) = ${d.A} mm\n` +
        `  B (comprimento tubo)  = ${d.B} mm\n` +
        `  C (entre furos)       = ${d.C} mm\n` +
        `  Ø D (diâmetro eixo)   = ${d.D} mm\n\n` +
        `Use "Gerar Projeto" para ver o desenho técnico e modelo 3D, ou "Gerar Orçamento" para criar um orçamento com esses dados.`;
    }
    // Tenta extrair dimensões brutas do texto
    const dimA = text.match(/A\s*[=:]\s*(\d+)/i)?.[1];
    const dimB = text.match(/B\s*[=:]\s*(\d+)/i)?.[1];
    const dimC = text.match(/C\s*[=:]\s*(\d+)/i)?.[1];
    const dimD = text.match(/[ØøD]\s*[=:×x]?\s*(\d+)/i)?.[1];
    if (dimA || dimB) {
      return `Dimensões identificadas no texto:\n` +
        `${dimA ? `  A = ${dimA} mm\n` : ''}` +
        `${dimB ? `  B = ${dimB} mm\n` : ''}` +
        `${dimC ? `  C = ${dimC} mm\n` : ''}` +
        `${dimD ? `  Ø D = ${dimD} mm\n` : ''}` +
        `\nPara análise completa com IA, configure uma API Key gratuita nas Configurações (Groq ou Gemini).`;
    }
    return `Análise local: nenhuma série FAÇO identificada no texto.\n\nTente informar a série (ex: 2024-AD) e a largura da correia (ex: 30"), ou use a seção "Consulta Catálogo FAÇO" acima.\n\nPara análise por IA, configure uma API Key gratuita nas Configurações.`;
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!isRelevant(input)) { toast.warning('Use termos técnicos: Rolete, Correia, mm, Ø, Série...'); return; }
    const local = lookupFaco(input);
    const userMsg: Message = { role: 'user', content: input, ts: new Date().toISOString() };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setLoading(true);

    const key = localStorage.getItem('rp_ia_key') || apiKey;

    // Sem key: processa localmente
    if (!key) {
      const reply = analyzeLocal(input);
      const aMsg: Message = { role: 'assistant', content: reply, extracted: local || undefined, ts: new Date().toISOString() };
      setMessages(p => [...p, aMsg]);
      if (local) setExtracted(local);
      saveHistory({ id: Date.now().toString(), ts: new Date().toISOString(), input, output: reply, extracted: local || undefined });
      setLoading(false);
      return;
    }

    try {
      const reply = await callAI(input);
      const aMsg: Message = { role: 'assistant', content: reply, extracted: local || undefined, ts: new Date().toISOString() };
      setMessages(p => [...p, aMsg]);
      if (local) setExtracted(local);
      saveHistory({ id: Date.now().toString(), ts: new Date().toISOString(), input, output: reply, extracted: local || undefined });
    } catch (e: any) {
      const msg = e.message || '';
      const friendly = msg.includes('401') ? 'API Key inválida. Verifique nas Configurações.'
        : msg.includes('429') ? 'Limite de requisições atingido. Aguarde um momento.'
        : msg.includes('400') ? `Erro na requisição: ${msg}`
        : msg;
      toast.error(friendly);
      // Fallback local ao falhar
      const fallback = analyzeLocal(input);
      setMessages(p => [...p, { role: 'assistant', content: `${fallback}\n\n_(Erro IA: ${friendly})_`, ts: new Date().toISOString() }]);
    } finally { setLoading(false); }
  };

  const handleGerarOrcamento = () => {
    if (!extracted) { toast.warning('Nenhum dado extraído.'); return; }
    const p = new URLSearchParams({
      ia_serie: extracted.serie || '',
      ia_largura: extracted.largura || '',
      ia_tipo: extracted.tipo || 'Rolete de Carga',
      ia_qtd: String(extracted.quantidade || 1),
      ia_dimA: String(extracted.dimensoes?.A || ''),
      ia_dimB: String(extracted.dimensoes?.B || ''),
      ia_dimC: String(extracted.dimensoes?.C || ''),
      ia_dimD: String(extracted.dimensoes?.D || ''),
    });
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
            {facoTables.length > 0 && <Badge className="ml-1 bg-green-500 text-white text-[10px] px-1.5 py-0">{facoTables.length} tabela{facoTables.length > 1 ? 's' : ''}</Badge>}
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
          <button onClick={() => { setSerie(''); setLargura(''); setExtracted(null); setShowProject(false); }} className="gap-1 text-muted-foreground hover:bg-destructive hover:text-white active:bg-destructive active:text-white h-7 text-xs flex items-center rounded px-2 py-1 transition-colors">
            <RotateCcw className="h-3 w-3" /> Limpar
          </button>
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
          <Button onClick={handleLookup} disabled={loadingLookup} className="gap-2 h-9">
            {loadingLookup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {loadingLookup ? 'Consultando IA...' : facoTables.length > 0 ? 'Buscar via IA' : 'Buscar Dimensões'}
          </Button>
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
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Desenho Técnico — clique para ampliar
                  </p>
                  <TechnicalSVG data={extracted} onClick={() => setShowDrawingModal(true)} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Package className="h-3 w-3" /> Modelo 3D — arraste para rotacionar
                  </p>
                  <RollerViewer3D data={extracted} height={180} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── AI Chat Card ── */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Análise por IA</span>
            <Badge variant="outline" className="text-[10px] px-1.5">{model.includes('claude') ? 'Claude' : model.includes('gemini') ? 'Gemini' : model.includes('llama') ? 'Llama' : model.includes('mixtral') ? 'Mixtral' : model.includes('gemma') ? 'Gemma' : 'GPT'}</Badge>
          </div>
          <button onClick={() => { setMessages([]); setExtracted(null); setShowProject(false); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:bg-destructive hover:text-white active:bg-destructive active:text-white rounded px-2 py-1 transition-colors">
            <RotateCcw className="h-3 w-3" /> Limpar
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto" style={{ minHeight: 200, maxHeight: 380 }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bot className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">Descreva o rolete ou cole dados técnicos aqui.</p>
              <p className="text-xs mt-1 opacity-60">Ex: "Rolete de Carga Série 2024-AD, correia 24", Ø76mm, 10 peças"</p>
              <p className="text-xs mt-1 opacity-40">Funciona sem API Key — com key usa IA para análise avançada</p>
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

      {/* ── Drawing Modal ── */}
      {extracted && (
        <TechnicalDrawingModal data={extracted} open={showDrawingModal} onClose={() => setShowDrawingModal(false)} />
      )}

      {/* ── Config Dialog ── */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings className="h-4 w-4" /> Configurações da IA</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">

            {/* ── Toggle Gratuito / Pago ── */}
            <div className="flex rounded-lg border overflow-hidden text-sm font-medium">
              <button
                onClick={() => { setUsePaid(false); setModel('llama-3.3-70b-versatile'); localStorage.setItem('rp_ia_model', 'llama-3.3-70b-versatile'); }}
                className={`flex-1 py-2 flex items-center justify-center gap-2 transition-colors ${!usePaid ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                <Sparkles className="h-3.5 w-3.5" /> Gratuito
              </button>
              <button
                onClick={() => { setUsePaid(true); setModel('claude-3-5-sonnet-20240620'); localStorage.setItem('rp_ia_model', 'claude-3-5-sonnet-20240620'); }}
                className={`flex-1 py-2 flex items-center justify-center gap-2 transition-colors ${usePaid ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                <Key className="h-3.5 w-3.5" /> Pago
              </button>
            </div>

            {/* ── Modelos ── */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5" /> Modelo</label>
              {!usePaid ? (
                <div className="space-y-2">
                  <Select value={model} onValueChange={v => { setModel(v); localStorage.setItem('rp_ia_model', v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="llama-3.3-70b-versatile">Llama 3.3 70B — Groq (gratuito)</SelectItem>
                      <SelectItem value="llama-3.1-8b-instant">Llama 3.1 8B Instant — Groq (gratuito)</SelectItem>
                      <SelectItem value="mixtral-8x7b-32768">Mixtral 8x7B — Groq (gratuito)</SelectItem>
                      <SelectItem value="gemma2-9b-it">Gemma 2 9B — Groq (gratuito)</SelectItem>
                      <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash — Google (gratuito)</SelectItem>
                      <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro — Google (gratuito)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 space-y-1.5 text-xs text-green-800">
                    <p className="font-semibold">Como obter a API Key gratuita:</p>
                    {(model.includes('llama') || model.includes('mixtral') || model.includes('gemma')) && (
                      <p>• <strong>Groq:</strong> acesse <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="underline">console.groq.com</a> → crie conta → API Keys → Create API Key</p>
                    )}
                    {model.includes('gemini') && (
                      <p>• <strong>Google AI Studio:</strong> acesse <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline">aistudio.google.com</a> → Get API Key</p>
                    )}
                    <p className="text-green-600">Ambos são gratuitos sem cartão de crédito.</p>
                  </div>
                </div>
              ) : (
                <Select value={model} onValueChange={v => { setModel(v); localStorage.setItem('rp_ia_model', v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-3-5-sonnet-20240620">Claude 3.5 Sonnet — Anthropic</SelectItem>
                    <SelectItem value="claude-3-opus-20240229">Claude 3 Opus — Anthropic</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o — OpenAI</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini — OpenAI</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* ── API Key ── */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" /> API Key
                {!usePaid && <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0">Gratuita</Badge>}
                {apiKey && <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">✓ salva ···{apiKey.slice(-4)}</Badge>}
              </label>
              <Input type="password" placeholder={!usePaid ? (model.includes('gemini') ? 'AIza...' : 'gsk_...') : 'sk-... ou sk-ant-...'} value={apiKey} onChange={e => { setApiKey(e.target.value); localStorage.setItem('rp_ia_key', e.target.value); }} className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground">
                {!usePaid
                  ? model.includes('gemini') ? 'Google AI Studio: AIza...' : 'Groq: gsk_...'
                  : 'Anthropic: sk-ant-... · OpenAI: sk-...'}
              </p>
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

            {/* ── Tabelas FAÇO para IA ── */}
            <div className="space-y-2 border rounded-lg p-3 bg-green-50/50 border-green-200">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-1.5 text-green-800">
                  <Package className="h-3.5 w-3.5" /> Tabelas FAÇO para IA
                  {facoTables.length > 0 && (
                    <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0">{facoTables.length} carregada{facoTables.length > 1 ? 's' : ''}</Badge>
                  )}
                </label>
                {facoTables.length > 0 && (
                  <button onClick={() => { setFacoTables([]); localStorage.removeItem('rp_faco_tables'); }} className="text-[11px] text-destructive hover:underline">Remover todas</button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Carregue imagens (PNG/JPG) das tabelas do catálogo FAÇO. Ao clicar em <span className="font-semibold text-green-700">"Buscar via IA"</span>, a IA lê as tabelas e extrai as dimensões reais da série e largura selecionadas.
              </p>
              <button
                onClick={() => facoTableRef.current?.click()}
                className="flex items-center gap-2 text-sm text-green-700 border border-dashed border-green-400 rounded-lg px-4 py-2.5 w-full justify-center hover:bg-green-100 transition-colors"
              >
                <Upload className="h-4 w-4" /> Carregar tabelas FAÇO (PNG / JPG)
              </button>
              <input
                ref={facoTableRef}
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={e => { handleFacoTableUpload(e.target.files); e.target.value = ''; }}
              />
              {facoTables.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-white border border-green-200 rounded px-3 py-1.5">
                  <span className="flex items-center gap-1.5 text-green-800">
                    <FileText className="h-3 w-3" /> {t.name}
                  </span>
                  <button onClick={() => removeFacoTable(i)} className="text-destructive hover:text-destructive/80"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setApiKey(''); setSystemPrompt(''); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:bg-destructive hover:text-white active:bg-destructive active:text-white rounded px-2 py-1 transition-colors"><RotateCcw className="h-3 w-3" /> Limpar</button>
              <Button onClick={() => { localStorage.setItem('rp_ia_model', model); localStorage.setItem('rp_ia_key', apiKey); setShowConfig(false); toast.success('Configurações salvas'); }}>Salvar</Button>
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
              <button onClick={() => { setHistory([]); localStorage.removeItem('rp_ia_history'); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:bg-destructive hover:text-white active:bg-destructive active:text-white rounded px-2 py-1 transition-colors">
                <Trash2 className="h-3 w-3" /> Limpar tudo
              </button>
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
