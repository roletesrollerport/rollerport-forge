import { useState, useEffect } from 'react';
import { Users, ArrowLeft, Eye, Download, Printer, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useUsuarios, type UsuarioDB } from '@/hooks/useUsuarios';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSearchParams } from 'react-router-dom';

import ChatWindow from '@/components/ChatWindow';

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const { usuarios: dbUsuarios, loading: loadingUsers } = useUsuarios();
  const [selectedUser, setSelectedUser] = useState<UsuarioDB | null>(null);
  const [masterViewDialog, setMasterViewDialog] = useState(false);
  const [masterViewUsers, setMasterViewUsers] = useState<{ u1: UsuarioDB; u2: UsuarioDB } | null>(null);
  const [masterMessages, setMasterMessages] = useState<any[]>([]);

  const loggedUserId = localStorage.getItem('rp_logged_user');
  const sessionToken = localStorage.getItem('rp_session_token');

  const usuarios = dbUsuarios;
  const currentUser = usuarios.find(u => u.id === loggedUserId);
  const isMaster = currentUser?.nivel === 'master';
  const otherUsers = usuarios.filter(u => u.id !== loggedUserId);

  // Select user from query param if provided
  useEffect(() => {
    if (!selectedUser && !loadingUsers && usuarios.length > 0) {
      const userId = searchParams.get('u');
      if (userId) {
        const user = usuarios.find(u => u.id === userId);
        if (user) setSelectedUser(user);
      }
    }
  }, [searchParams, usuarios, loadingUsers, selectedUser]);

  // Master: view conversation between two users
  const masterViewConversation = async (u1: UsuarioDB, u2: UsuarioDB) => {
    const { data } = await supabase
      .from('chat_messages' as any)
      .select('*')
      .or(`and(sender_id.eq.${u1.id},receiver_id.eq.${u2.id}),and(sender_id.eq.${u2.id},receiver_id.eq.${u1.id})`)
      .order('created_at', { ascending: true });
    setMasterMessages((data as unknown as any[]) || []);
    setMasterViewUsers({ u1, u2 });
    setMasterViewDialog(true);
  };

  const getUserName = (id: string) => usuarios.find(u => u.id === id)?.nome || 'Desconhecido';

  if (!selectedUser) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="mb-4">
          <h1 className="page-header">Bate-Papo</h1>
          <p className="page-subtitle">Comunicação interna entre usuários</p>
        </div>
        <div className="flex-1 bg-card border rounded-lg overflow-hidden flex flex-col">
          <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" /> Contatos
            </div>
            {isMaster && (
              <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded font-medium">
                Master — Acesso total
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {otherUsers.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                <button onClick={() => setSelectedUser(u)} className="flex-1 flex items-center gap-3 text-left">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {u.foto ? <img src={u.foto} alt={u.nome} className="h-full w-full object-cover" /> : <User className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{u.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary capitalize">{u.nivel}</span>
                </button>
                {isMaster && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded hover:bg-muted"><Eye className="h-4 w-4 text-muted-foreground" /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <p className="px-2 py-1 text-xs text-muted-foreground font-medium">Ver conversa com:</p>
                      {otherUsers.filter(ou => ou.id !== u.id).map(ou => (
                        <DropdownMenuItem key={ou.id} onClick={() => masterViewConversation(u, ou)}>
                          {ou.nome}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        </div>

        <Dialog open={masterViewDialog} onOpenChange={setMasterViewDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto text-left">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center justify-between">
                <span>Conversa: {masterViewUsers?.u1.nome} ↔ {masterViewUsers?.u2.nome}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              {masterMessages.map(msg => (
                <div key={msg.id} className="flex flex-col opacity-70">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold">{getUserName(msg.sender_id)}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(msg.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm max-w-[80%] text-left">
                    <p>{msg.content || `[${msg.message_type}]`}</p>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-2 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
          {selectedUser.foto ? <img src={selectedUser.foto} alt={selectedUser.nome} className="h-full w-full object-cover" /> : <User className="h-4 w-4 text-primary" />}
        </div>
        <div>
          <h1 className="text-sm font-semibold">{selectedUser.nome}</h1>
          <p className="text-xs text-muted-foreground capitalize">{selectedUser.nivel}</p>
        </div>
      </div>
      <div className="flex-1 bg-card border rounded-lg flex flex-col overflow-hidden">
        {currentUser && <ChatWindow selectedUser={selectedUser} currentUser={currentUser} isMaster={isMaster} />}
      </div>
    </div>
  );
}
