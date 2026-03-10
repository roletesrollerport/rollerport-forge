import { useState, useEffect } from 'react';
import { store } from '@/lib/store';
import type { ItemEstoque } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, AlertTriangle, Eye, Edit, Search, ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';

const emptyItem = (): ItemEstoque => ({
  id: '', nome: '', categoria: '', quantidade: '' as any, unidade: 'un', metragem: undefined,
  nivelCritico: '' as any, imagem: '', createdAt: new Date().toISOString().split('T')[0],
});

const CATEGORIAS_MATERIAIS = [
  'Tubo', 'Eixo', 'Caneca', 'Rolamento', 'Anéis de Borracha', 'Labirinto', 'Retentor',
  'Anel Elástico', 'Revest. Spiraflex', 'Revest. Borracha Vulcanizada', 'Bucha Nylon',
  'Tinta', 'Flanges', 'Engrenagens', 'Encaixe Faço', 'Porcas', 'Parafusos', 'Arruelas',
  'Conjuntos', 'Encaixes', 'Outros',
];

function buildDefaultEstoque(): ItemEstoque[] {
  const items: ItemEstoque[] = [];
  let idx = 1;
  const add = (nome: string, categoria: string, unidade = 'un') => {
    items.push({ id: String(idx++), nome, categoria, quantidade: 0, unidade, metragem: undefined, nivelCritico: 10, createdAt: new Date().toISOString().split('T')[0] });
  };
  // Add one placeholder per category
  CATEGORIAS_MATERIAIS.forEach(cat => add(`${cat} - estoque inicial`, cat));
  return items;
}

export default function EstoquePage() {
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ItemEstoque>(emptyItem());
  const [viewItem, setViewItem] = useState<ItemEstoque | null>(null);
  const [search, setSearch] = useState('');
  const [imgPreview, setImgPreview] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      let data = store.getEstoque();
      if (data.length === 0) {
        data = buildDefaultEstoque();
        store.saveEstoque(data);
      }
      setItens(data);
    };
    load();
    window.addEventListener('rp-data-synced', load);
    return () => window.removeEventListener('rp-data-synced', load);
  }, []);

  const filtered = itens.filter(i =>
    i.nome.toLowerCase().includes(search.toLowerCase()) ||
    i.categoria.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    let updated: ItemEstoque[];
    if (editing.id) {
      updated = itens.map(i => i.id === editing.id ? editing : i);
    } else {
      updated = [...itens, { ...editing, id: store.nextId('est') }];
    }
    store.saveEstoque(updated);
    setItens(updated);
    setOpen(false);
    toast.success('Item salvo!');
  };

  const handleDelete = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item do estoque?')) return;
    const updated = itens.filter(i => i.id !== id);
    store.saveEstoque(updated);
    setItens(updated);
    toast.success('Item removido!');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditing({ ...editing, imagem: reader.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-header">Estoque</h1>
          <p className="page-subtitle">Controle de matéria-prima</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(emptyItem())} className="gap-2"><Plus className="h-4 w-4" /> Novo Item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing.id ? 'Editar' : 'Novo'} Item</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-xs text-muted-foreground">Nome</label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Categoria</label>
                <select value={editing.categoria} onChange={e => setEditing({ ...editing, categoria: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="">Selecione...</option>
                  {CATEGORIAS_MATERIAIS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground">Unidade</label><Input value={editing.unidade} onChange={e => setEditing({ ...editing, unidade: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Quantidade</label><Input type="number" value={editing.quantidade || ''} onChange={e => setEditing({ ...editing, quantidade: e.target.value ? +e.target.value : '' as any })} /></div>
              <div><label className="text-xs text-muted-foreground">Metragem</label><Input type="number" value={editing.metragem || ''} onChange={e => setEditing({ ...editing, metragem: e.target.value ? +e.target.value : undefined })} /></div>
              <div><label className="text-xs text-muted-foreground">Nível Crítico</label><Input type="number" value={editing.nivelCritico || ''} onChange={e => setEditing({ ...editing, nivelCritico: e.target.value ? +e.target.value : '' as any })} /></div>
              <div>
                <label className="text-xs text-muted-foreground">Imagem</label>
                <div className="flex items-center gap-2 mt-1">
                  {editing.imagem ? (
                    <>
                      <img src={editing.imagem} alt="item" className="h-10 w-10 rounded object-cover border" />
                      <button onClick={() => setEditing({ ...editing, imagem: '' })} className="text-destructive text-xs">Remover</button>
                    </>
                  ) : (
                    <label className="cursor-pointer flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                      <ImagePlus className="h-4 w-4" /> Upload
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4"><Button onClick={handleSave}>Salvar</Button></div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar material..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* View item dialog */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes do Item</DialogTitle></DialogHeader>
          {viewItem && (
            <div className="space-y-2 text-sm">
              {viewItem.imagem && <img src={viewItem.imagem} alt="item" className="w-full max-h-48 object-contain rounded mb-3" />}
              <div><span className="text-muted-foreground">Nome:</span> <strong>{viewItem.nome}</strong></div>
              <div><span className="text-muted-foreground">Categoria:</span> <strong>{viewItem.categoria}</strong></div>
              <div><span className="text-muted-foreground">Quantidade:</span> <strong>{viewItem.quantidade} {viewItem.unidade}</strong></div>
              {viewItem.metragem !== undefined && <div><span className="text-muted-foreground">Metragem:</span> <strong>{viewItem.metragem}m</strong></div>}
              <div><span className="text-muted-foreground">Nível Crítico:</span> <strong>{viewItem.nivelCritico}</strong></div>
              <div><span className="text-muted-foreground">Cadastrado em:</span> <strong>{viewItem.createdAt}</strong></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image preview */}
      <Dialog open={!!imgPreview} onOpenChange={() => setImgPreview(null)}>
        <DialogContent className="max-w-lg">
          {imgPreview && <img src={imgPreview} alt="preview" className="w-full rounded" />}
        </DialogContent>
      </Dialog>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 w-12"></th>
              <th className="text-left p-3 font-medium">Material</th>
              <th className="text-left p-3 font-medium">Categoria</th>
              <th className="text-right p-3 font-medium">Quantidade</th>
              <th className="text-left p-3 font-medium">Unidade</th>
              <th className="text-right p-3 font-medium hidden md:table-cell">Metragem</th>
              <th className="text-right p-3 font-medium">Nível Crítico</th>
              <th className="p-3 w-28">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} className={`border-b last:border-0 hover:bg-muted/30 ${item.quantidade <= item.nivelCritico ? 'bg-destructive/5' : ''}`}>
                <td className="p-2">
                  {item.imagem ? (
                    <img src={item.imagem} alt={item.nome} className="h-8 w-8 rounded object-cover cursor-pointer border" onClick={() => setImgPreview(item.imagem!)} />
                  ) : (
                    <div className="h-8 w-8 rounded bg-muted/50 flex items-center justify-center">
                      <ImagePlus className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </td>
                <td className="p-3 font-medium flex items-center gap-2">
                  {item.quantidade <= item.nivelCritico && <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />}
                  {item.nome}
                </td>
                <td className="p-3">{item.categoria}</td>
                <td className="p-3 text-right font-mono">{item.quantidade}</td>
                <td className="p-3">{item.unidade}</td>
                <td className="p-3 text-right font-mono hidden md:table-cell">{item.metragem !== undefined ? `${item.metragem}m` : '-'}</td>
                <td className="p-3 text-right font-mono">{item.nivelCritico}</td>
                <td className="p-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => setViewItem(item)} className="p-1.5 rounded hover:bg-muted" title="Ver"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => { setEditing(item); setOpen(true); }} className="p-1.5 rounded hover:bg-muted" title="Editar"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-muted text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum item no estoque.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
