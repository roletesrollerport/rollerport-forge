import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import type { Tubo, Eixo, Conjunto, Revestimento, Encaixe } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save, Eye, Edit, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

type CustoTab = 'tubos' | 'eixos' | 'conjuntos' | 'revestimentos' | 'encaixes';

const tabs: { key: CustoTab; label: string }[] = [
  { key: 'tubos', label: 'Tubos' },
  { key: 'eixos', label: 'Eixos' },
  { key: 'conjuntos', label: 'Conjuntos' },
  { key: 'revestimentos', label: 'Revestimentos' },
  { key: 'encaixes', label: 'Encaixes' },
];

const fmt = (v: number) => `R$ ${v.toFixed(2)}`;

export default function CustosPage() {
  const [activeTab, setActiveTab] = useState<CustoTab>('tubos');
  const [tubos, setTubos] = useState<Tubo[]>([]);
  const [eixos, setEixos] = useState<Eixo[]>([]);
  const [conjuntos, setConjuntos] = useState<Conjunto[]>([]);
  const [revestimentos, setRevestimentos] = useState<Revestimento[]>([]);
  const [encaixes, setEncaixes] = useState<Encaixe[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<any>(null);

  useEffect(() => {
    setTubos(store.getTubos());
    setEixos(store.getEixos());
    setConjuntos(store.getConjuntos());
    setRevestimentos(store.getRevestimentos());
    setEncaixes(store.getEncaixes());
  }, []);

  const saveAll = () => {
    store.saveTubos(tubos);
    store.saveEixos(eixos);
    store.saveConjuntos(conjuntos);
    store.saveRevestimentos(revestimentos);
    store.saveEncaixes(encaixes);
    setEditingId(null);
    toast.success('Custos salvos com sucesso!');
  };

  const addTubo = () => { const id = store.nextId('tubo'); setTubos([...tubos, { id, diametro: 0, parede: 0, valorMetro: 0 }]); setEditingId(id); };
  const addEixo = () => { const id = store.nextId('eixo'); setEixos([...eixos, { id, diametro: '', valorMetro: 0 }]); setEditingId(id); };
  const addConjunto = () => { const id = store.nextId('conj'); setConjuntos([...conjuntos, { id, codigo: '', valor: 0 }]); setEditingId(id); };
  const addRevestimento = () => { const id = store.nextId('rev'); setRevestimentos([...revestimentos, { id, tipo: '', valorMetroOuPeca: 0 }]); setEditingId(id); };
  const addEncaixe = () => { const id = store.nextId('enc'); setEncaixes([...encaixes, { id, tipo: '', preco: 0 }]); setEditingId(id); };

  const deleteTubo = (id: string) => { setTubos(tubos.filter(t => t.id !== id)); toast.success('Removido!'); };
  const deleteEixo = (id: string) => { setEixos(eixos.filter(e => e.id !== id)); toast.success('Removido!'); };
  const deleteConjunto = (id: string) => { setConjuntos(conjuntos.filter(c => c.id !== id)); toast.success('Removido!'); };
  const deleteRevestimento = (id: string) => { setRevestimentos(revestimentos.filter(r => r.id !== id)); toast.success('Removido!'); };
  const deleteEncaixe = (id: string) => { setEncaixes(encaixes.filter(e => e.id !== id)); toast.success('Removido!'); };

  const ActionButtons = ({ id, item, onDelete }: { id: string; item: any; onDelete: (id: string) => void }) => (
    <div className="flex gap-1">
      <button onClick={() => setViewItem(item)} className="text-info hover:text-info/80"><Eye className="h-4 w-4" /></button>
      <button onClick={() => setEditingId(editingId === id ? null : id)} className="text-primary hover:text-primary/80"><Edit className="h-4 w-4" /></button>
      <button onClick={() => onDelete(id)} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Custos</h1>
          <p className="page-subtitle">Tabela de preços de matéria-prima</p>
        </div>
        <Button onClick={saveAll} className="gap-2"><Save className="h-4 w-4" /> Salvar</Button>
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-lg overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>{t.label}</button>
        ))}
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        {activeTab === 'tubos' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Diâmetro</th>
              <th className="text-left p-3 font-medium">Parede</th>
              <th className="text-left p-3 font-medium">Valor/metro</th>
              <th className="p-3 w-28"></th>
            </tr></thead>
            <tbody>
              {tubos.map((t, i) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                  {editingId === t.id ? (<>
                    <td className="p-2"><Input type="number" value={t.diametro} onChange={e => { const n = [...tubos]; n[i] = { ...t, diametro: +e.target.value }; setTubos(n); }} /></td>
                    <td className="p-2"><Input type="number" value={t.parede} onChange={e => { const n = [...tubos]; n[i] = { ...t, parede: +e.target.value }; setTubos(n); }} /></td>
                    <td className="p-2"><Input type="number" step="0.01" value={t.valorMetro} onChange={e => { const n = [...tubos]; n[i] = { ...t, valorMetro: +e.target.value }; setTubos(n); }} /></td>
                  </>) : (<>
                    <td className="p-3">{t.diametro}</td>
                    <td className="p-3">{t.parede}</td>
                    <td className="p-3 font-mono">{fmt(t.valorMetro)}</td>
                  </>)}
                  <td className="p-3"><ActionButtons id={t.id} item={t} onDelete={deleteTubo} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'eixos' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Diâmetro</th>
              <th className="text-left p-3 font-medium">Valor/metro</th>
              <th className="p-3 w-28"></th>
            </tr></thead>
            <tbody>
              {eixos.map((e, i) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                  {editingId === e.id ? (<>
                    <td className="p-2"><Input value={e.diametro} onChange={ev => { const n = [...eixos]; n[i] = { ...e, diametro: ev.target.value }; setEixos(n); }} /></td>
                    <td className="p-2"><Input type="number" step="0.01" value={e.valorMetro} onChange={ev => { const n = [...eixos]; n[i] = { ...e, valorMetro: +ev.target.value }; setEixos(n); }} /></td>
                  </>) : (<>
                    <td className="p-3">{e.diametro}</td>
                    <td className="p-3 font-mono">{fmt(e.valorMetro)}</td>
                  </>)}
                  <td className="p-3"><ActionButtons id={e.id} item={e} onDelete={deleteEixo} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'conjuntos' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50"><th className="text-left p-3 font-medium">Código</th><th className="text-left p-3 font-medium">Valor</th><th className="p-3 w-28"></th></tr></thead>
            <tbody>
              {conjuntos.map((c, i) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  {editingId === c.id ? (<>
                    <td className="p-2"><Input value={c.codigo} onChange={e => { const n = [...conjuntos]; n[i] = { ...c, codigo: e.target.value }; setConjuntos(n); }} /></td>
                    <td className="p-2"><Input type="number" step="0.01" value={c.valor} onChange={e => { const n = [...conjuntos]; n[i] = { ...c, valor: +e.target.value }; setConjuntos(n); }} /></td>
                  </>) : (<>
                    <td className="p-3">{c.codigo}</td>
                    <td className="p-3 font-mono">{fmt(c.valor)}</td>
                  </>)}
                  <td className="p-3"><ActionButtons id={c.id} item={c} onDelete={deleteConjunto} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'revestimentos' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50"><th className="text-left p-3 font-medium">Tipo</th><th className="text-left p-3 font-medium">Valor/metro ou peça</th><th className="p-3 w-28"></th></tr></thead>
            <tbody>
              {revestimentos.map((r, i) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  {editingId === r.id ? (<>
                    <td className="p-2"><Input value={r.tipo} onChange={e => { const n = [...revestimentos]; n[i] = { ...r, tipo: e.target.value }; setRevestimentos(n); }} /></td>
                    <td className="p-2"><Input type="number" step="0.01" value={r.valorMetroOuPeca} onChange={e => { const n = [...revestimentos]; n[i] = { ...r, valorMetroOuPeca: +e.target.value }; setRevestimentos(n); }} /></td>
                  </>) : (<>
                    <td className="p-3">{r.tipo}</td>
                    <td className="p-3 font-mono">{fmt(r.valorMetroOuPeca)}</td>
                  </>)}
                  <td className="p-3"><ActionButtons id={r.id} item={r} onDelete={deleteRevestimento} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'encaixes' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50"><th className="text-left p-3 font-medium">Tipo</th><th className="text-left p-3 font-medium">Preço</th><th className="p-3 w-28"></th></tr></thead>
            <tbody>
              {encaixes.map((enc, i) => (
                <tr key={enc.id} className="border-b last:border-0 hover:bg-muted/30">
                  {editingId === enc.id ? (<>
                    <td className="p-2"><Input value={enc.tipo} onChange={e => { const n = [...encaixes]; n[i] = { ...enc, tipo: e.target.value }; setEncaixes(n); }} /></td>
                    <td className="p-2"><Input type="number" step="0.01" value={enc.preco} onChange={e => { const n = [...encaixes]; n[i] = { ...enc, preco: +e.target.value }; setEncaixes(n); }} /></td>
                  </>) : (<>
                    <td className="p-3">{enc.tipo}</td>
                    <td className="p-3 font-mono">{fmt(enc.preco)}</td>
                  </>)}
                  <td className="p-3"><ActionButtons id={enc.id} item={enc} onDelete={deleteEncaixe} /></td>
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
        else if (activeTab === 'revestimentos') addRevestimento();
        else addEncaixe();
      }} className="gap-2"><Plus className="h-4 w-4" /> Adicionar</Button>

      {/* View Dialog */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes</DialogTitle></DialogHeader>
          {viewItem && (
            <div className="space-y-2 text-sm">
              {Object.entries(viewItem).filter(([k]) => k !== 'id').map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b last:border-0">
                  <span className="text-muted-foreground capitalize">{k}</span>
                  <span className="font-medium">{typeof v === 'number' ? fmt(v as number) : String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
