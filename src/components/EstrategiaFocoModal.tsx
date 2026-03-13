import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Target, Factory, Wheat, Settings, Package, Truck, Zap, Plus, Trash2, Briefcase, Wrench, Building2 } from 'lucide-react';

interface ScheduleItem {
  id: string;
  day: string;
  focus: string;
  reason: string;
  isCustom?: boolean;
}

interface EstrategiaFocoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultSchedule: ScheduleItem[] = [
  { id: '1', day: 'Segunda-feira', focus: 'Usinas e Sucroalcooleiras', reason: 'Alta demanda de carga', isCustom: false },
  { id: '2', day: 'Terça-feira', focus: 'Indústrias de Alimentos e Bebidas', reason: 'Flowrack e Esteiras', isCustom: false },
  { id: '3', day: 'Quarta-feira', focus: 'Setor Agrícola e Grãos', reason: 'Cavaletes e Roletes de Carga', isCustom: false },
  { id: '4', day: 'Quinta-feira', focus: 'Usinagens e Metalúrgicas', reason: 'Peças e Rolamentos', isCustom: false },
  { id: '5', day: 'Sexta-feira', focus: 'Logística e E-commerce', reason: 'Sistemas de Transportadores', isCustom: false }
];

const inferStyle = (text: string) => {
  const t = text.toLowerCase();
  if (t.includes('usina') || t.includes('indústria')) return { icon: <Factory className="w-5 h-5 text-orange-500" />, color: 'border-orange-200 bg-orange-50' };
  if (t.includes('alimento') || t.includes('bebida')) return { icon: <Package className="w-5 h-5 text-blue-500" />, color: 'border-blue-200 bg-blue-50' };
  if (t.includes('agrícola') || t.includes('grão') || t.includes('agro')) return { icon: <Wheat className="w-5 h-5 text-yellow-600" />, color: 'border-yellow-200 bg-yellow-50' };
  if (t.includes('usinagem') || t.includes('metal') || t.includes('peça')) return { icon: <Settings className="w-5 h-5 text-zinc-500" />, color: 'border-zinc-200 bg-zinc-50' };
  if (t.includes('logística') || t.includes('commerce') || t.includes('transporte')) return { icon: <Truck className="w-5 h-5 text-emerald-500" />, color: 'border-emerald-200 bg-emerald-50' };
  if (t.includes('manutenção') || t.includes('reparo')) return { icon: <Wrench className="w-5 h-5 text-cyan-500" />, color: 'border-cyan-200 bg-cyan-50' };
  if (t.includes('tecnologia') || t.includes('software')) return { icon: <Zap className="w-5 h-5 text-purple-500" />, color: 'border-purple-200 bg-purple-50' };
  
  // Default fallback
  return { icon: <Briefcase className="w-5 h-5 text-primary" />, color: 'border-primary/20 bg-primary/5' };
};

export function EstrategiaFocoModal({ isOpen, onOpenChange }: EstrategiaFocoModalProps) {
  const [schedule, setSchedule] = useState<ScheduleItem[]>(defaultSchedule);
  const [newDay, setNewDay] = useState('');
  const [newFocus, setNewFocus] = useState('');
  const [newReason, setNewReason] = useState('');

  // Load from local storage
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('rp_estrategia_foco');
      if (saved) {
        setSchedule(JSON.parse(saved));
      } else {
        setSchedule(defaultSchedule); // guarantee default if empty
      }
    }
  }, [isOpen]);

  const saveToStorage = (items: ScheduleItem[]) => {
    setSchedule(items);
    localStorage.setItem('rp_estrategia_foco', JSON.stringify(items));
  };

  const handleAddCustom = () => {
    if (!newDay || !newFocus || !newReason) return;
    const newItem: ScheduleItem = {
      id: crypto.randomUUID(),
      day: newDay,
      focus: newFocus,
      reason: newReason,
      isCustom: true
    };
    saveToStorage([...schedule, newItem]);
    setNewDay('');
    setNewFocus('');
    setNewReason('');
  };

  const handleDelete = (id: string) => {
    const updated = schedule.filter(s => s.id !== id);
    saveToStorage(updated);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-primary">
            <Target className="w-5 h-5" />
            Estratégia de Foco Semanal
          </DialogTitle>
          <DialogDescription>
            Cronograma sugerido para otimizar as prospecções por setor. 
            Você pode adicionar setores extras conforme a sua carteira local de clientes!
          </DialogDescription>
        </DialogHeader>
        
        {/* Custom Input Area */}
        <div className="bg-muted/30 border rounded-xl p-4 my-2 space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground/80">
            <Plus className="w-4 h-4" /> Adicionar Foco Personalizado
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input placeholder="Dia (Ex: Sábado)" value={newDay} onChange={(e) => setNewDay(e.target.value)} className="h-8 text-sm bg-background" />
            <Input placeholder="Setor Foco" value={newFocus} onChange={(e) => setNewFocus(e.target.value)} className="h-8 text-sm bg-background" />
            <Input placeholder="Motivo/Produto" value={newReason} onChange={(e) => setNewReason(e.target.value)} className="h-8 text-sm bg-background" />
          </div>
          <Button onClick={handleAddCustom} size="sm" className="w-full h-8 text-xs font-bold" disabled={!newDay || !newFocus || !newReason}>
            Incluir na Estratégia
          </Button>
        </div>

        <div className="space-y-3 mt-4">
          {schedule.map((item) => {
            const style = inferStyle(item.focus + ' ' + item.reason);
            return (
              <div 
                key={item.id} 
                className={`flex items-start justify-between gap-4 p-3 rounded-xl border ${style.color} transition-all hover:shadow-md group`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1 bg-white p-2 rounded-lg shadow-sm">
                    {style.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground mb-0.5 flex items-center gap-2">
                      {item.day}
                      {item.isCustom && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">EXTRA</span>}
                    </h4>
                    <p className="font-semibold text-foreground/90">{item.focus}</p>
                    <p className="text-xs text-muted-foreground mt-1">Foco: {item.reason}</p>
                  </div>
                </div>

                {item.isCustom && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
