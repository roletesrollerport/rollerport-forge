import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import type { Tubo, Eixo, Conjunto, Revestimento, Encaixe } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

type CustoTab = 'tubos' | 'eixos' | 'conjuntos' | 'revestimentos' | 'encaixes';

const tabs: { key: CustoTab; label: string }[] = [
  { key: 'tubos', label: 'Tubos' },
  { key: 'eixos', label: 'Eixos' },
  { key: 'conjuntos', label: 'Conjuntos' },
  { key: 'revestimentos', label: 'Revestimentos' },
  { key: 'encaixes', label: 'Encaixes' },
];

export default function CustosPage() {
  const [activeTab, setActiveTab] = useState<CustoTab>('tubos');
  const [tubos, setTubos] = useState<Tubo[]>([]);
  const [eixos, setEixos] = useState<Eixo[]>([]);
  const [conjuntos, setConjuntos] = useState<Conjunto[]>([]);
  const [revestimentos, setRevestimentos] = useState<Revestimento[]>([]);
  const [encaixes, setEncaixes] = useState<Encaixe[]>([]);

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
    toast.success('Custos salvos com sucesso!');
  };

  const addTubo = () => setTubos([...tubos, { id: store.nextId('tubo'), diametro: 0, parede: 0, valorKg: 0, valorMetro: 0 }]);
  const addEixo = () => setEixos([...eixos, { id: store.nextId('eixo'), diametro: '', valorKg: 0, valorMetro: 0 }]);
  const addConjunto = () => setConjuntos([...conjuntos, { id: store.nextId('conj'), codigo: '', valor: 0 }]);
  const addRevestimento = () => setRevestimentos([...revestimentos, { id: store.nextId('rev'), tipo: '', valorMetroOuPeca: 0 }]);
  const addEncaixe = () => setEncaixes([...encaixes, { id: store.nextId('enc'), tipo: '', preco: 0 }]);

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Custos</h1>
          <p className="page-subtitle">Tabela de preços de matéria-prima</p>
        </div>
        <Button onClick={saveAll} className="gap-2">
          <Save className="h-4 w-4" /> Salvar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-card rounded-lg border overflow-x-auto">
        {activeTab === 'tubos' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Diâmetro</th>
                <th className="text-left p-3 font-medium">Parede</th>
                <th className="text-left p-3 font-medium">Valor/kg</th>
                <th className="text-left p-3 font-medium">Valor/metro</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {tubos.map((t, i) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="p-2"><Input type="number" value={t.diametro} onChange={e => { const n = [...tubos]; n[i] = { ...t, diametro: +e.target.value }; setTubos(n); }} /></td>
                  <td className="p-2"><Input type="number" value={t.parede} onChange={e => { const n = [...tubos]; n[i] = { ...t, parede: +e.target.value }; setTubos(n); }} /></td>
                  <td className="p-2"><Input type="number" step="0.01" value={t.valorKg} onChange={e => { const n = [...tubos]; n[i] = { ...t, valorKg: +e.target.value }; setTubos(n); }} /></td>
                  <td className="p-2"><Input type="number" step="0.01" value={t.valorMetro} onChange={e => { const n = [...tubos]; n[i] = { ...t, valorMetro: +e.target.value }; setTubos(n); }} /></td>
                  <td className="p-2"><button onClick={() => setTubos(tubos.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'eixos' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Diâmetro</th>
                <th className="text-left p-3 font-medium">Valor/kg</th>
                <th className="text-left p-3 font-medium">Valor/metro</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {eixos.map((e, i) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="p-2"><Input value={e.diametro} onChange={ev => { const n = [...eixos]; n[i] = { ...e, diametro: ev.target.value }; setEixos(n); }} /></td>
                  <td className="p-2"><Input type="number" step="0.01" value={e.valorKg} onChange={ev => { const n = [...eixos]; n[i] = { ...e, valorKg: +ev.target.value }; setEixos(n); }} /></td>
                  <td className="p-2"><Input type="number" step="0.01" value={e.valorMetro} onChange={ev => { const n = [...eixos]; n[i] = { ...e, valorMetro: +ev.target.value }; setEixos(n); }} /></td>
                  <td className="p-2"><button onClick={() => setEixos(eixos.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'conjuntos' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50"><th className="text-left p-3 font-medium">Código</th><th className="text-left p-3 font-medium">Valor</th><th className="p-3 w-10"></th></tr></thead>
            <tbody>
              {conjuntos.map((c, i) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-2"><Input value={c.codigo} onChange={e => { const n = [...conjuntos]; n[i] = { ...c, codigo: e.target.value }; setConjuntos(n); }} /></td>
                  <td className="p-2"><Input type="number" step="0.01" value={c.valor} onChange={e => { const n = [...conjuntos]; n[i] = { ...c, valor: +e.target.value }; setConjuntos(n); }} /></td>
                  <td className="p-2"><button onClick={() => setConjuntos(conjuntos.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'revestimentos' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50"><th className="text-left p-3 font-medium">Tipo</th><th className="text-left p-3 font-medium">Valor/metro ou peça</th><th className="p-3 w-10"></th></tr></thead>
            <tbody>
              {revestimentos.map((r, i) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="p-2"><Input value={r.tipo} onChange={e => { const n = [...revestimentos]; n[i] = { ...r, tipo: e.target.value }; setRevestimentos(n); }} /></td>
                  <td className="p-2"><Input type="number" step="0.01" value={r.valorMetroOuPeca} onChange={e => { const n = [...revestimentos]; n[i] = { ...r, valorMetroOuPeca: +e.target.value }; setRevestimentos(n); }} /></td>
                  <td className="p-2"><button onClick={() => setRevestimentos(revestimentos.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'encaixes' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50"><th className="text-left p-3 font-medium">Tipo</th><th className="text-left p-3 font-medium">Preço</th><th className="p-3 w-10"></th></tr></thead>
            <tbody>
              {encaixes.map((enc, i) => (
                <tr key={enc.id} className="border-b last:border-0">
                  <td className="p-2"><Input value={enc.tipo} onChange={e => { const n = [...encaixes]; n[i] = { ...enc, tipo: e.target.value }; setEncaixes(n); }} /></td>
                  <td className="p-2"><Input type="number" step="0.01" value={enc.preco} onChange={e => { const n = [...encaixes]; n[i] = { ...enc, preco: +e.target.value }; setEncaixes(n); }} /></td>
                  <td className="p-2"><button onClick={() => setEncaixes(encaixes.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button></td>
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
      }} className="gap-2">
        <Plus className="h-4 w-4" /> Adicionar
      </Button>
    </div>
  );
}
