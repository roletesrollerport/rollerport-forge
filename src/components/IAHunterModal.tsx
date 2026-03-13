import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Sparkles, Building2, MapPin, ExternalLink, CalendarPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Lead {
  id: string;
  empresa: string;
  setor: string;
  localizacao: string;
  contato: string;
}

interface IAHunterModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAgendar: (lead: Lead, dayOfWeek: number) => void;
}

export function IAHunterModal({ isOpen, onOpenChange, onAgendar }: IAHunterModalProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Lead[]>([]);
  const [sectorFilter, setSectorFilter] = useState<string>('todos');

  // Mapeamento de dias da semana para o agendamento (0=Domingo, 1=Segunda, etc)
  const strategyDays: Record<string, number> = {
    'Indústrias de Alimentos e Bebidas': 2, // Terça
    'Usinas e Sucroalcooleiras': 1, // Segunda
    'Usinagens e Metalúrgicas': 4, // Quinta
    'Setor Agrícola e Grãos': 3, // Quarta
    'Logística e E-commerce': 5, // Sexta
  };

  const handleSearch = () => {
    setIsSearching(true);
    setResults([]);
    
    // Simulate AI Search Delay and WebScraping payload
    setTimeout(() => {
      let simulatedLeads: Lead[] = [];
      
      const allPossibleLeads: Lead[] = [
        { id: 'l1', empresa: 'AgroSul Implementos', setor: 'Setor Agrícola e Grãos', localizacao: 'Ribeirão Preto, SP', contato: 'linkedin.com/in/compras-agrosul' },
        { id: 'l2', empresa: 'Usinas Santa Clara', setor: 'Usinas e Sucroalcooleiras', localizacao: 'Sertãozinho, SP', contato: 'linkedin.com/in/manutencao-santaclara' },
        { id: 'l3', empresa: 'Metalúrgica Apex', setor: 'Usinagens e Metalúrgicas', localizacao: 'Campinas, SP', contato: 'linkedin.com/in/suprimentos-apex' },
        { id: 'l4', empresa: 'Bebidas Premium SA', setor: 'Indústrias de Alimentos e Bebidas', localizacao: 'Jundiaí, SP', contato: 'linkedin.com/in/engenharia-premium' },
        { id: 'l5', empresa: 'Logística Total', setor: 'Logística e E-commerce', localizacao: 'Guarulhos, SP', contato: 'linkedin.com/in/frota-logtotal' },
        { id: 'l6', empresa: 'CanaFlex Açúcar', setor: 'Usinas e Sucroalcooleiras', localizacao: 'Piracicaba, SP', contato: 'linkedin.com/in/gestao-canaflex' },
        { id: 'l7', empresa: 'FarmTech Grãos', setor: 'Setor Agrícola e Grãos', localizacao: 'Rio Verde, GO', contato: 'linkedin.com/in/compradores-farmtech' }
      ];

      if (sectorFilter === 'todos') {
        simulatedLeads = allPossibleLeads.sort(() => 0.5 - Math.random()).slice(0, 4);
      } else {
        const filtered = allPossibleLeads.filter(l => l.setor === sectorFilter);
        simulatedLeads = filtered.concat(allPossibleLeads).slice(0, 4); // Always guarantee some results for the demo
      }

      setResults(simulatedLeads);
      setIsSearching(false);
      toast.success('Agente IA encontrou novos leads com potencial!');
    }, 2500);
  };

  const handleAgendar = (lead: Lead) => {
    const targetDay = strategyDays[lead.setor] || 1; // Default to Segunda if missing
    onAgendar(lead, targetDay);
    toast.success(`${lead.empresa} adicionada à sua agenda!`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl text-primary">
            <Sparkles className="w-6 h-6" />
            Agente de Prospecção IA
          </DialogTitle>
          <DialogDescription>
            Nossa IA analisa a web, redes setoriais e LinkedIn para encontrar empresas 
            com alta propensão de compra de Roletes, Esteiras e Flowracks.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 items-end bg-primary/5 p-4 rounded-xl border border-primary/20 mt-2">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-semibold text-primary/80">Filtro de Setor</label>
            <Select value={sectorFilter} onValueChange={setSectorFilter} disabled={isSearching}>
              <SelectTrigger className="bg-white border-primary/30">
                <SelectValue placeholder="Selecione um Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Setores (Automático)</SelectItem>
                <SelectItem value="Usinas e Sucroalcooleiras">Usinas e Sucroalcooleiras</SelectItem>
                <SelectItem value="Setor Agrícola e Grãos">Setor Agrícola e Grãos</SelectItem>
                <SelectItem value="Usinagens e Metalúrgicas">Usinagens e Metalúrgicas</SelectItem>
                <SelectItem value="Indústrias de Alimentos e Bebidas">Indústrias de Alimentos e Bebidas</SelectItem>
                <SelectItem value="Logística e E-commerce">Logística e E-commerce</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleSearch} 
            disabled={isSearching}
            className="gap-2 h-10 px-6"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar Leads
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-4 mt-6">
            <h3 className="font-bold text-lg border-b pb-2">Leads Encontrados (Top 4)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((lead) => (
                <div key={lead.id} className="border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div className="space-y-2 mb-4">
                    <h4 className="font-bold text-[15px] flex items-center gap-2 text-primary">
                      <Building2 className="w-4 h-4" />
                      {lead.empresa}
                    </h4>
                    <span className="inline-block px-2 py-1 rounded bg-muted text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {lead.setor}
                    </span>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" /> {lead.localizacao}
                    </p>
                    <a 
                      href={`https://${lead.contato}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 flex items-center gap-1 hover:underline cursor-pointer mt-1"
                    >
                      <ExternalLink className="w-3 h-3" /> LinkedIn da Empresa
                    </a>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors"
                    onClick={() => handleAgendar(lead)}
                  >
                    <CalendarPlus className="w-4 h-4" /> Agendar Contato
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {isSearching && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 text-primary">
            <Sparkles className="w-8 h-8 animate-pulse" />
            <p className="text-sm font-medium animate-pulse">Cruzando dados de indústrias e decisores...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
