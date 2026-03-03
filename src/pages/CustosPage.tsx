import { useState, useRef } from 'react';
import { useCustos } from '@/hooks/useCustos';
import type { Tubo, Eixo, Conjunto, Revestimento, Encaixe } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save, Eye, Edit, X, ImagePlus, Download, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

type CustoTab = 'tubos' | 'eixos' | 'conjuntos' | 'spiraflex' | 'aneis' | 'encaixes';

const tabs: { key: CustoTab; label: string }[] = [
  { key: 'tubos', label: 'Tubos' },
  { key: 'eixos', label: 'Eixos' },
  { key: 'conjuntos', label: 'Conjuntos' },
  { key: 'spiraflex', label: 'Revest. Spiraflex' },
  { key: 'aneis', label: 'Revest. Anéis' },
  { key: 'encaixes', label: 'Encaixes' },
];

const fmt = (v: number) => v ? `R$ ${v.toFixed(2).replace('.', ',')}` : '';

function ImageCell({ src, onUpload, onRemove }: { src?: string; onUpload: (url: string) => void; onRemove: () => void }) {
  const [preview, setPreview] = useState(false);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onUpload(reader.result as string);
    reader.readAsDataURL(file);
  };
  return (
    <div className="flex items-center gap-1">
      {src ? (
        <>
          <img src={src} alt="item" className="h-8 w-8 object-cover rounded cursor-pointer border" onClick={() => setPreview(true)} />
          <button onClick={onRemove} className="text-destructive hover:text-destructive/80 p-0.5"><X className="h-3 w-3" /></button>
          <Dialog open={preview} onOpenChange={setPreview}><DialogContent className="max-w-lg"><img src={src} alt="preview" className="w-full rounded" /></DialogContent></Dialog>
        </>
      ) : (
        <label className="cursor-pointer text-muted-foreground hover:text-primary p-1">
          <ImagePlus className="h-4 w-4" />
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
      )}
    </div>
  );
}

export default function CustosPage() {
  const [activeTab, setActiveTab] = useState<CustoTab>('tubos');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const custos = useCustos();
  const { tubos, eixos, conjuntos, revestimentos, encaixes, loading,
    setTubos, setEixos, setConjuntos, setRevestimentos, setEncaixes } = custos;

  const spiraflex = revestimentos.filter(r => r.tipo.toUpperCase().includes('SPIRAFLEX'));
  const aneis = revestimentos.filter(r => r.tipo.toUpperCase().includes('ABI'));

  const saveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        custos.saveAllTubos(tubos),
        custos.saveAllEixos(eixos),
        custos.saveAllConjuntos(conjuntos),
        custos.saveAllRevestimentos(revestimentos),
        custos.saveAllEncaixes(encaixes),
      ]);
      await custos.reload();
      setEditingId(null);
      toast.success('Custos salvos com sucesso!');
    } catch {
      toast.error('Erro ao salvar custos');
    }
    setSaving(false);
  };

  const handleDeleteAll = async () => {
    if (!confirm('Tem certeza que deseja excluir TODOS os itens desta aba?')) return;
    setSaving(true);
    try {
      if (activeTab === 'tubos') { await custos.deleteAllTubos(); setTubos([]); }
      else if (activeTab === 'eixos') { await custos.deleteAllEixos(); setEixos([]); }
      else if (activeTab === 'conjuntos') { await custos.deleteAllConjuntos(); setConjuntos([]); }
      else if (activeTab === 'spiraflex') { await custos.deleteAllRevestimentos('spiraflex'); setRevestimentos(prev => prev.filter(r => !r.tipo.toUpperCase().includes('SPIRAFLEX'))); }
      else if (activeTab === 'aneis') { await custos.deleteAllRevestimentos('aneis'); setRevestimentos(prev => prev.filter(r => !r.tipo.toUpperCase().includes('ABI'))); }
      else if (activeTab === 'encaixes') { await custos.deleteAllEncaixes(); setEncaixes([]); }
      toast.success('Todos os itens foram excluídos!');
    } catch { toast.error('Erro ao excluir'); }
    setSaving(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tubos.map(t => ({ Diâmetro: t.diametro, Parede: t.parede, 'Valor/Metro': t.valorMetro }))), 'Tubos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eixos.map(e => ({ Diâmetro: e.diametro, 'Valor/Metro': e.valorMetro }))), 'Eixos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(conjuntos.map(c => ({ Código: c.codigo, Valor: c.valor }))), 'Conjuntos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(spiraflex.map(r => ({ Tipo: r.tipo, 'Valor/Metro': r.valorMetroOuPeca }))), 'Spiraflex');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aneis.map(r => ({ Modelo: r.tipo, 'Valor/Peça': r.valorMetroOuPeca }))), 'Anéis');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(encaixes.map(e => ({ Tipo: e.tipo, Preço: e.preco }))), 'Encaixes');
    XLSX.writeFile(wb, 'Custos_Rollerport.xlsx');
    toast.success('Arquivo exportado!');
  };

  const exportModelo = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Diâmetro: '', Parede: '', 'Valor/Metro': '' }]), 'Tubos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Diâmetro: '', 'Valor/Metro': '' }]), 'Eixos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Código: '', Valor: '' }]), 'Conjuntos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Tipo: '', 'Valor/Metro': '' }]), 'Spiraflex');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Modelo: '', 'Valor/Peça': '' }]), 'Anéis');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Tipo: '', Preço: '' }]), 'Encaixes');
    XLSX.writeFile(wb, 'Modelo_Custos_Rollerport.xlsx');
    toast.success('Modelo exportado!');
  };

  const importExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' });
      const tWs = wb.Sheets['Tubos'];
      if (tWs) {
        const rows: any[] = XLSX.utils.sheet_to_json(tWs);
        const newItems: Tubo[] = rows.filter(r => r['Diâmetro'] || r['Diametro']).map(r => ({
          id: 'new_' + crypto.randomUUID(), diametro: +(r['Diâmetro'] || r['Diametro'] || 0), parede: +(r['Parede'] || 0), valorMetro: +(r['Valor/Metro'] || r['ValorMetro'] || 0),
        }));
        if (newItems.length) setTubos(prev => [...prev, ...newItems]);
      }
      const eWs = wb.Sheets['Eixos'];
      if (eWs) {
        const rows: any[] = XLSX.utils.sheet_to_json(eWs);
        const newItems: Eixo[] = rows.filter(r => r['Diâmetro'] || r['Diametro']).map(r => ({
          id: 'new_' + crypto.randomUUID(), diametro: String(r['Diâmetro'] || r['Diametro'] || ''), valorMetro: +(r['Valor/Metro'] || r['ValorMetro'] || 0),
        }));
        if (newItems.length) setEixos(prev => [...prev, ...newItems]);
      }
      const cWs = wb.Sheets['Conjuntos'];
      if (cWs) {
        const rows: any[] = XLSX.utils.sheet_to_json(cWs);
        const newItems: Conjunto[] = rows.filter(r => r['Código'] || r['Codigo']).map(r => ({
          id: 'new_' + crypto.randomUUID(), codigo: String(r['Código'] || r['Codigo'] || ''), valor: +(r['Valor'] || 0),
        }));
        if (newItems.length) setConjuntos(prev => [...prev, ...newItems]);
      }
      const sWs = wb.Sheets['Spiraflex'];
      if (sWs) {
        const rows: any[] = XLSX.utils.sheet_to_json(sWs);
        const newItems: Revestimento[] = rows.filter(r => r['Tipo']).map(r => ({
          id: 'new_' + crypto.randomUUID(), tipo: String(r['Tipo'] || ''), valorMetroOuPeca: +(r['Valor/Metro'] || r['ValorMetro'] || 0),
        }));
        if (newItems.length) setRevestimentos(prev => [...prev, ...newItems]);
      }
      const aWs = wb.Sheets['Anéis'] || wb.Sheets['Aneis'];
      if (aWs) {
        const rows: any[] = XLSX.utils.sheet_to_json(aWs);
        const newItems: Revestimento[] = rows.filter(r => r['Modelo']).map(r => ({
          id: 'new_' + crypto.randomUUID(), tipo: String(r['Modelo'] || ''), valorMetroOuPeca: +(r['Valor/Peça'] || r['ValorPeca'] || 0),
        }));
        if (newItems.length) setRevestimentos(prev => [...prev, ...newItems]);
      }
      const encWs = wb.Sheets['Encaixes'];
      if (encWs) {
        const rows: any[] = XLSX.utils.sheet_to_json(encWs);
        const newItems: Encaixe[] = rows.filter(r => r['Tipo']).map(r => ({
          id: 'new_' + crypto.randomUUID(), tipo: String(r['Tipo'] || ''), preco: +(r['Preço'] || r['Preco'] || 0),
        }));
        if (newItems.length) setEncaixes(prev => [...prev, ...newItems]);
      }
      toast.success('Dados importados! Clique em Salvar para confirmar.');
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addTubo = () => { const id = 'new_' + crypto.randomUUID(); setTubos([...tubos, { id, diametro: '' as any, parede: '' as any, valorMetro: '' as any }]); setEditingId(id); };
  const addEixo = () => { const id = 'new_' + crypto.randomUUID(); setEixos([...eixos, { id, diametro: '', valorMetro: '' as any }]); setEditingId(id); };
  const addConjunto = () => { const id = 'new_' + crypto.randomUUID(); setConjuntos([...conjuntos, { id, codigo: '', valor: '' as any }]); setEditingId(id); };
  const addRevestimento = (isSpiraflex: boolean) => { const id = 'new_' + crypto.randomUUID(); setRevestimentos([...revestimentos, { id, tipo: isSpiraflex ? 'SPIRAFLEX ' : 'ABI-', valorMetroOuPeca: '' as any }]); setEditingId(id); };
  const addEncaixe = () => { const id = 'new_' + crypto.randomUUID(); setEncaixes([...encaixes, { id, tipo: '', preco: '' as any }]); setEditingId(id); };

  const handleDeleteTubo = async (id: string) => { if (!id.startsWith('new_')) await custos.deleteTubo(id); setTubos(tubos.filter(t => t.id !== id)); toast.success('Removido!'); };
  const handleDeleteEixo = async (id: string) => { if (!id.startsWith('new_')) await custos.deleteEixo(id); setEixos(eixos.filter(e => e.id !== id)); toast.success('Removido!'); };
  const handleDeleteConjunto = async (id: string) => { if (!id.startsWith('new_')) await custos.deleteConjunto(id); setConjuntos(conjuntos.filter(c => c.id !== id)); toast.success('Removido!'); };
  const handleDeleteRevestimento = async (id: string) => { if (!id.startsWith('new_')) await custos.deleteRevestimento(id); setRevestimentos(revestimentos.filter(r => r.id !== id)); toast.success('Removido!'); };
  const handleDeleteEncaixe = async (id: string) => { if (!id.startsWith('new_')) await custos.deleteEncaixe(id); setEncaixes(encaixes.filter(e => e.id !== id)); toast.success('Removido!'); };

  const ActionButtons = ({ id, item, onDelete }: { id: string; item: any; onDelete: (id: string) => void }) => (
    <div className="flex gap-1">
      <button onClick={() => setViewItem(item)} className="text-info hover:text-info/80"><Eye className="h-4 w-4" /></button>
      <button onClick={() => setEditingId(editingId === id ? null : id)} className="text-primary hover:text-primary/80"><Edit className="h-4 w-4" /></button>
      <button onClick={() => onDelete(id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button>
    </div>
  );

  const updateTuboImg = (id: string, img: string) => setTubos(tubos.map(t => t.id === id ? { ...t, imagem: img } : t));
  const updateEixoImg = (id: string, img: string) => setEixos(eixos.map(e => e.id === id ? { ...e, imagem: img } : e));
  const updateConjImg = (id: string, img: string) => setConjuntos(conjuntos.map(c => c.id === id ? { ...c, imagem: img } : c));
  const updateRevImg = (id: string, img: string) => setRevestimentos(revestimentos.map(r => r.id === id ? { ...r, imagem: img } : r));
  const updateEncImg = (id: string, img: string) => setEncaixes(encaixes.map(e => e.id === id ? { ...e, imagem: img } : e));

  if (loading) return <div className="flex items-center justify-center p-12 text-muted-foreground">Carregando custos...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header">Custos</h1>
          <p className="page-subtitle">Tabela de preços de matéria-prima</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={exportModelo} className="gap-2"><Download className="h-4 w-4" /> Modelo Excel</Button>
          <Button variant="outline" onClick={exportExcel} className="gap-2"><Download className="h-4 w-4" /> Exportar Excel</Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> Importar Excel</Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importExcel} />
          <Button onClick={saveAll} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-lg overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Delete All button */}
      <div className="flex justify-end">
        <Button variant="destructive" size="sm" onClick={handleDeleteAll} disabled={saving} className="gap-2">
          <Trash2 className="h-4 w-4" /> Excluir Tudo ({tabs.find(t => t.key === activeTab)?.label})
        </Button>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        {activeTab === 'tubos' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="p-3 w-12"></th>
              <th className="text-left p-3 font-medium">Diâmetro</th>
              <th className="text-left p-3 font-medium">Parede</th>
              <th className="text-left p-3 font-medium">Valor/metro</th>
              <th className="p-3 w-28">Ações</th>
            </tr></thead>
            <tbody>
              {tubos.map((t, i) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-2"><ImageCell src={t.imagem} onUpload={(url) => updateTuboImg(t.id, url)} onRemove={() => updateTuboImg(t.id, '')} /></td>
                  {editingId === t.id ? (<>
                    <td className="p-2"><Input type="number" value={t.diametro || ''} placeholder="Diâmetro" onChange={e => { const n = [...tubos]; n[i] = { ...t, diametro: e.target.value ? +e.target.value : '' as any }; setTubos(n); }} /></td>
                    <td className="p-2"><Input type="number" value={t.parede || ''} placeholder="Parede" onChange={e => { const n = [...tubos]; n[i] = { ...t, parede: e.target.value ? +e.target.value : '' as any }; setTubos(n); }} /></td>
                    <td className="p-2"><Input type="number" step="0.01" value={t.valorMetro || ''} placeholder="R$ 0,00" onChange={e => { const n = [...tubos]; n[i] = { ...t, valorMetro: e.target.value ? +e.target.value : '' as any }; setTubos(n); }} /></td>
                  </>) : (<>
                    <td className="p-3">{t.diametro || ''}</td>
                    <td className="p-3">{t.parede || ''}</td>
                    <td className="p-3 font-mono">{fmt(t.valorMetro)}</td>
                  </>)}
                  <td className="p-3"><ActionButtons id={t.id} item={t} onDelete={handleDeleteTubo} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'eixos' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="p-3 w-12"></th>
              <th className="text-left p-3 font-medium">Diâmetro</th>
              <th className="text-left p-3 font-medium">Valor/metro</th>
              <th className="p-3 w-28">Ações</th>
            </tr></thead>
            <tbody>
              {eixos.map((e, i) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-2"><ImageCell src={e.imagem} onUpload={(url) => updateEixoImg(e.id, url)} onRemove={() => updateEixoImg(e.id, '')} /></td>
                  {editingId === e.id ? (<>
                    <td className="p-2"><Input value={e.diametro} placeholder="Diâmetro" onChange={ev => { const n = [...eixos]; n[i] = { ...e, diametro: ev.target.value }; setEixos(n); }} /></td>
                    <td className="p-2"><Input type="number" step="0.01" value={e.valorMetro || ''} placeholder="R$ 0,00" onChange={ev => { const n = [...eixos]; n[i] = { ...e, valorMetro: ev.target.value ? +ev.target.value : '' as any }; setEixos(n); }} /></td>
                  </>) : (<>
                    <td className="p-3">{e.diametro}</td>
                    <td className="p-3 font-mono">{fmt(e.valorMetro)}</td>
                  </>)}
                  <td className="p-3"><ActionButtons id={e.id} item={e} onDelete={handleDeleteEixo} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'conjuntos' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="p-3 w-12"></th>
              <th className="text-left p-3 font-medium">Código</th>
              <th className="text-left p-3 font-medium">Valor</th>
              <th className="p-3 w-28">Ações</th>
            </tr></thead>
            <tbody>
              {conjuntos.map((c, i) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-2"><ImageCell src={c.imagem} onUpload={(url) => updateConjImg(c.id, url)} onRemove={() => updateConjImg(c.id, '')} /></td>
                  {editingId === c.id ? (<>
                    <td className="p-2"><Input value={c.codigo} placeholder="Código" onChange={e => { const n = [...conjuntos]; n[i] = { ...c, codigo: e.target.value }; setConjuntos(n); }} /></td>
                    <td className="p-2"><Input type="number" step="0.01" value={c.valor || ''} placeholder="R$ 0,00" onChange={e => { const n = [...conjuntos]; n[i] = { ...c, valor: e.target.value ? +e.target.value : '' as any }; setConjuntos(n); }} /></td>
                  </>) : (<>
                    <td className="p-3">{c.codigo}</td>
                    <td className="p-3 font-mono">{fmt(c.valor)}</td>
                  </>)}
                  <td className="p-3"><ActionButtons id={c.id} item={c} onDelete={handleDeleteConjunto} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'spiraflex' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="p-3 w-12"></th>
              <th className="text-left p-3 font-medium">Tipo</th>
              <th className="text-left p-3 font-medium">Valor/metro</th>
              <th className="p-3 w-28">Ações</th>
            </tr></thead>
            <tbody>
              {spiraflex.map((r) => {
                const i = revestimentos.findIndex(x => x.id === r.id);
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-2"><ImageCell src={r.imagem} onUpload={(url) => updateRevImg(r.id, url)} onRemove={() => updateRevImg(r.id, '')} /></td>
                    {editingId === r.id ? (<>
                      <td className="p-2"><Input value={r.tipo} placeholder="Tipo" onChange={e => { const n = [...revestimentos]; n[i] = { ...r, tipo: e.target.value }; setRevestimentos(n); }} /></td>
                      <td className="p-2"><Input type="number" step="0.01" value={r.valorMetroOuPeca || ''} placeholder="R$ 0,00" onChange={e => { const n = [...revestimentos]; n[i] = { ...r, valorMetroOuPeca: e.target.value ? +e.target.value : '' as any }; setRevestimentos(n); }} /></td>
                    </>) : (<>
                      <td className="p-3">{r.tipo}</td>
                      <td className="p-3 font-mono">{fmt(r.valorMetroOuPeca)}</td>
                    </>)}
                    <td className="p-3"><ActionButtons id={r.id} item={r} onDelete={handleDeleteRevestimento} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeTab === 'aneis' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="p-3 w-12"></th>
              <th className="text-left p-3 font-medium">Modelo</th>
              <th className="text-left p-3 font-medium">Valor/peça</th>
              <th className="p-3 w-28">Ações</th>
            </tr></thead>
            <tbody>
              {aneis.map((r) => {
                const i = revestimentos.findIndex(x => x.id === r.id);
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-2"><ImageCell src={r.imagem} onUpload={(url) => updateRevImg(r.id, url)} onRemove={() => updateRevImg(r.id, '')} /></td>
                    {editingId === r.id ? (<>
                      <td className="p-2"><Input value={r.tipo} placeholder="Modelo ABI" onChange={e => { const n = [...revestimentos]; n[i] = { ...r, tipo: e.target.value }; setRevestimentos(n); }} /></td>
                      <td className="p-2"><Input type="number" step="0.01" value={r.valorMetroOuPeca || ''} placeholder="R$ 0,00" onChange={e => { const n = [...revestimentos]; n[i] = { ...r, valorMetroOuPeca: e.target.value ? +e.target.value : '' as any }; setRevestimentos(n); }} /></td>
                    </>) : (<>
                      <td className="p-3">{r.tipo}</td>
                      <td className="p-3 font-mono">{fmt(r.valorMetroOuPeca)}</td>
                    </>)}
                    <td className="p-3"><ActionButtons id={r.id} item={r} onDelete={handleDeleteRevestimento} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeTab === 'encaixes' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="p-3 w-12"></th>
              <th className="text-left p-3 font-medium">Tipo</th>
              <th className="text-left p-3 font-medium">Preço</th>
              <th className="p-3 w-28">Ações</th>
            </tr></thead>
            <tbody>
              {encaixes.map((enc, i) => (
                <tr key={enc.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-2"><ImageCell src={enc.imagem} onUpload={(url) => updateEncImg(enc.id, url)} onRemove={() => updateEncImg(enc.id, '')} /></td>
                  {editingId === enc.id ? (<>
                    <td className="p-2"><Input value={enc.tipo} placeholder="Tipo" onChange={e => { const n = [...encaixes]; n[i] = { ...enc, tipo: e.target.value }; setEncaixes(n); }} /></td>
                    <td className="p-2"><Input type="number" step="0.01" value={enc.preco || ''} placeholder="R$ 0,00" onChange={e => { const n = [...encaixes]; n[i] = { ...enc, preco: e.target.value ? +e.target.value : '' as any }; setEncaixes(n); }} /></td>
                  </>) : (<>
                    <td className="p-3">{enc.tipo}</td>
                    <td className="p-3 font-mono">{fmt(enc.preco)}</td>
                  </>)}
                  <td className="p-3"><ActionButtons id={enc.id} item={enc} onDelete={handleDeleteEncaixe} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Button variant="outline" onClick={() => {
        if (activeTab === 'tubos') addTubo();
        else if (activeTab === 'eixos') addEixo();
        else if (activeTab === 'conjuntos') addConjunto();
        else if (activeTab === 'spiraflex') addRevestimento(true);
        else if (activeTab === 'aneis') addRevestimento(false);
        else addEncaixe();
      }} className="gap-2"><Plus className="h-4 w-4" /> Adicionar</Button>

      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes</DialogTitle></DialogHeader>
          {viewItem && (
            <div className="space-y-2 text-sm">
              {viewItem.imagem && <img src={viewItem.imagem} alt="item" className="w-full max-h-48 object-contain rounded mb-3" />}
              {Object.entries(viewItem).filter(([k]) => k !== 'id' && k !== 'imagem').map(([k, v]) => (
                <div key={k}><span className="text-muted-foreground capitalize">{k}:</span> <strong>{String(v)}</strong></div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
