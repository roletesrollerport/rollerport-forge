import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Search, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { store } from '@/lib/store';
import { AgendaItem, TipoCompromisso, Cliente } from '@/lib/types';
import { toast } from 'sonner';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface AgendaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: AgendaItem;
  initialDate?: Date;
  onSave: (item: AgendaItem) => void;
}

const TIPOS: TipoCompromisso[] = ['Visita', 'Ligação', 'Retorno de Orçamento', 'Entrega de Roletes'];

export function AgendaModal({ open, onOpenChange, item, initialDate, onSave }: AgendaModalProps) {
  const [formData, setFormData] = useState<Partial<AgendaItem>>({
    titulo: '',
    descricao: '',
    data_inicio: initialDate ? initialDate.toISOString() : new Date().toISOString(),
    data_fim: initialDate ? initialDate.toISOString() : new Date().toISOString(),
    tipo: 'Ligação',
    status: false,
    cliente_id: '',
    clienteNome: '',
  });

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);

  useEffect(() => {
    if (open) {
      const allClientes = store.getClientes();
      setClientes(allClientes);
      if (item) {
        const data = { ...item };
        if (data.cliente_id && !data.clienteNome) {
          const cli = allClientes.find(c => c.id === data.cliente_id);
          if (cli) data.clienteNome = cli.nome;
        }
        setFormData(data);
      } else if (initialDate) {
        const start = new Date(initialDate);
        // Se a data inicial for hoje, usa o horário atual arredondado
        const isToday = start.toDateString() === new Date().toDateString();
        if (isToday) {
          start.setHours(new Date().getHours() + 1, 0, 0, 0);
        } else {
          start.setHours(9, 0, 0, 0);
        }
        
        const end = new Date(start);
        end.setHours(start.getHours() + 1, 0, 0, 0);
        
        setFormData({
          titulo: '',
          descricao: '',
          data_inicio: start.toISOString(),
          data_fim: end.toISOString(),
          tipo: 'Ligação',
          status: false,
          cliente_id: '',
          clienteNome: '',
        });
      }
    }
  }, [open, item, initialDate]);

  const handleSave = () => {
    if (!formData.titulo || !formData.data_inicio || !formData.data_fim || !formData.tipo) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const newItem: AgendaItem = {
      id: item?.id || store.nextId('age'),
      titulo: formData.titulo!,
      descricao: formData.descricao || '',
      data_inicio: formData.data_inicio!,
      data_fim: formData.data_fim!,
      tipo: formData.tipo!,
      cliente_id: formData.cliente_id,
      clienteNome: formData.clienteNome,
      status: formData.status || false,
      createdAt: item?.createdAt || new Date().toISOString(),
    };

    onSave(newItem);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar Compromisso' : 'Novo Compromisso'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input 
              id="titulo" 
              value={formData.titulo} 
              onChange={e => setFormData({ ...formData, titulo: e.target.value })} 
              placeholder="Ex: Reunião com Cliente"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Tipo *</Label>
              <Select 
                value={formData.tipo} 
                onValueChange={(v: TipoCompromisso) => setFormData({ ...formData, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label>Cliente</Label>
              <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientSearchOpen}
                    className="justify-between font-normal"
                  >
                    {formData.clienteNome || "Selecione..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandList>
                      <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                      <CommandGroup>
                        {clientes.map((cliente) => (
                          <CommandItem
                            key={cliente.id}
                            value={cliente.nome}
                            onSelect={() => {
                              setFormData({ 
                                ...formData, 
                                cliente_id: cliente.id, 
                                clienteNome: cliente.nome 
                              });
                              setClientSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.cliente_id === cliente.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {cliente.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Início *</Label>
              <Input 
                type="datetime-local" 
                value={formData.data_inicio ? formData.data_inicio.slice(0, 16) : ''} 
                onChange={e => setFormData({ ...formData, data_inicio: new Date(e.target.value).toISOString() })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Fim *</Label>
              <Input 
                type="datetime-local" 
                value={formData.data_fim ? formData.data_fim.slice(0, 16) : ''} 
                onChange={e => setFormData({ ...formData, data_fim: new Date(e.target.value).toISOString() })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea 
              id="descricao" 
              value={formData.descricao} 
              onChange={e => setFormData({ ...formData, descricao: e.target.value })} 
              placeholder="Detalhes do compromisso..."
              className="resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="status" 
              checked={formData.status} 
              onChange={e => setFormData({ ...formData, status: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="status" className="cursor-pointer">Marcar como concluído</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
