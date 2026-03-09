import type { Cliente, Comprador } from '@/lib/types';
import { Phone, Mail, Building2, Cake, Calendar, Eye, Edit, Trash2 } from 'lucide-react';

interface Props {
  cliente: Cliente;
  labelContatos: string; // "Compradores" ou "Vendedores"
  ultimoOrcamento: string;
  ultimaCompra: string;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ClienteCard({ cliente: c, labelContatos, ultimoOrcamento, ultimaCompra, onView, onEdit, onDelete }: Props) {
  const anivCompradores = (c.compradores || []).filter(comp => comp.aniversario).map(comp => `${comp.nome}: ${comp.aniversario}`);

  return (
    <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm truncate">{c.nome}</h3>
          <p className="text-xs text-muted-foreground font-mono">{c.cnpj}</p>
        </div>
        <div className="flex gap-1 ml-2 flex-shrink-0">
          <button onClick={onView} className="p-1 rounded hover:bg-muted" title="Ver"><Eye className="h-3.5 w-3.5" /></button>
          <button onClick={onEdit} className="p-1 rounded hover:bg-muted text-primary" title="Editar"><Edit className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-muted text-destructive" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Phone className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{c.telefone || '-'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Mail className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{c.email || '-'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Building2 className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{c.cidade}/{c.estado}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Último Orçamento:</span>
          <span className="font-medium">{ultimoOrcamento}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Última Compra:</span>
          <span className="font-medium">{ultimaCompra}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t space-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <Cake className="h-3 w-3 text-primary flex-shrink-0" />
          <span className="text-muted-foreground">Empresa:</span>
          <span className="font-medium">{c.aniversarioEmpresa || '-'}</span>
        </div>
        {anivCompradores.length > 0 && (
          <div className="flex items-start gap-1.5">
            <Calendar className="h-3 w-3 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-muted-foreground">{labelContatos}:</span>
              {anivCompradores.map((a, i) => (
                <p key={i} className="font-medium">{a}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {(c.compradores || []).length > 0 && (
        <div className="mt-3 pt-3 border-t text-xs">
          <span className="text-muted-foreground font-medium">{labelContatos}:</span>
          {(c.compradores || []).map((comp, i) => (
            <p key={i} className="truncate mt-0.5">{comp.nome} {comp.telefone ? `• ${comp.telefone}` : ''}</p>
          ))}
        </div>
      )}
    </div>
  );
}
