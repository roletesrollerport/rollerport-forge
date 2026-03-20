import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AgendaItem, Cliente } from "@/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  MessageSquare, 
  History, 
  Trash2, 
  Edit, 
  CheckCircle2,
  ExternalLink,
  MapPin
} from "lucide-react";
import { store } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from '@/components/ConfirmDialog';

interface AgendaDetailsSheetProps {
  item: AgendaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (item: AgendaItem) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (item: AgendaItem) => void;
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  'Visita Técnica': { color: 'text-amber-500', bg: 'bg-amber-50', icon: Calendar },
  'Ligação': { color: 'text-blue-500', bg: 'bg-blue-50', icon: Phone },
  'Retorno de Orçamento': { color: 'text-violet-500', bg: 'bg-violet-50', icon: History },
  'Entrega de Roletes': { color: 'text-emerald-500', bg: 'bg-emerald-50', icon: Clock },
};

export function AgendaDetailsSheet({ 
  item, 
  open, 
  onOpenChange, 
  onEdit, 
  onDelete,
  onToggleComplete 
}: AgendaDetailsSheetProps) {
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  if (!item) return null;

  const safeDate = (v: string) => {
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date() : d;
  };
  const dataInicio = safeDate(item.data_inicio);
  const dataFim = safeDate(item.data_fim);

  const config = TYPE_CONFIG[item.tipo] || { color: 'text-amber-500', bg: 'bg-amber-50', icon: Calendar };
  const cliente = item.cliente_id ? store.getClientes().find(c => c.id === item.cliente_id) : null;

  const handleWhatsApp = () => {
    if (!cliente?.whatsapp && !cliente?.telefone) return;
    const num = (cliente.whatsapp || cliente.telefone || "").replace(/\D/g, "");
    if (!num) return;
    const text = encodeURIComponent(`Olá ${cliente.nome}, estou entrando em contato referente ao compromisso "${item.titulo}" agendado para ${format(new Date(item.data_inicio), "dd/MM 'às' HH:mm", { locale: ptBR })}.`);
    window.open(`https://wa.me/55${num}?text=${text}`, '_blank');
  };

  const handleViewHistory = () => {
    if (!cliente) return;
    navigate(`/orcamentos?cliente=${cliente.nome}`);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <div className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", config.bg, config.color)}>
              {item.tipo}
            </div>
            {item.status && (
              <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold uppercase">
                <CheckCircle2 className="h-3 w-3" /> Concluído
              </div>
            )}
          </div>
          <SheetTitle className="text-xl leading-tight">{item.titulo}</SheetTitle>
          <SheetDescription className="flex flex-col gap-2 pt-2">
            <div className="flex items-center gap-2 text-foreground">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(dataInicio, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{format(dataInicio, "HH:mm")} - {format(dataFim, "HH:mm")}</span>
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Descrição */}
          {item.descricao && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</h4>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground bg-muted/30 p-3 rounded-lg border">
                {item.descricao}
              </p>
            </div>
          )}

          {/* Cliente */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente Vinculado</h4>
            {cliente ? (
              <div className="border rounded-xl p-4 space-y-4 bg-card/50">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{cliente.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{cliente.cnpj}</p>
                  </div>
                </div>

                {cliente.endereco && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>{cliente.endereco}, {cliente.cidade}-{cliente.estado}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 text-xs h-8"
                    onClick={handleWhatsApp}
                    disabled={!cliente.whatsapp && !cliente.telefone}
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-500" /> WhatsApp
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 text-xs h-8"
                    onClick={handleViewHistory}
                  >
                    <History className="h-3.5 w-3.5 text-primary" /> Orçamentos
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Nenhum cliente vinculado a este compromisso.</p>
            )}
          </div>
        </div>

        <SheetFooter className="flex-col sm:flex-col gap-2">
          <div className="grid grid-cols-2 gap-2 w-full">
            <Button 
              variant={item.status ? "outline" : "default"} 
              className="gap-2"
              onClick={() => onToggleComplete(item)}
            >
              <CheckCircle2 className="h-4 w-4" /> 
              {item.status ? "Marcar Pendente" : "Concluir Tarefa"}
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => onEdit(item)}>
              <Edit className="h-4 w-4" /> Editar
            </Button>
          </div>
          <Button 
            variant="ghost" 
            className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4" /> Excluir Compromisso
          </Button>
        </SheetFooter>
        <ConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title="Confirmar Exclusão"
          description="Tem certeza que deseja excluir este compromisso? Esta ação não pode ser desfeita."
          confirmLabel="Confirmar Exclusão"
          onConfirm={() => { onDelete(item.id); onOpenChange(false); setShowDeleteConfirm(false); }}
        />
      </SheetContent>
    </Sheet>
  );
}
