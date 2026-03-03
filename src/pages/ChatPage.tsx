import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Users, ArrowLeft, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';
import { store } from '@/lib/store';
import type { Usuario } from '@/lib/types';
import { toast } from 'sonner';

type Msg = { role: 'user' | 'assistant'; content: string; timestamp: string; from?: string; to?: string; fileName?: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export default function ChatPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [allMessages, setAllMessages] = useState<Record<string, Msg[]>>(() => {
    try {
      const saved = localStorage.getItem('rp_chat_all');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setUsuarios(store.getUsuarios()); }, []);

  const loggedUserId = localStorage.getItem('rp_logged_user');
  const currentUser = usuarios.find(u => u.id === loggedUserId) || usuarios[0];
  const chatKey = selectedUser ? [currentUser?.id, selectedUser.id].sort().join('_') : '';
  const messages = allMessages[chatKey] || [];

  useEffect(() => {
    localStorage.setItem('rp_chat_all', JSON.stringify(allMessages));
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages]);

  const setMessages = (msgs: Msg[]) => {
    if (!chatKey) return;
    setAllMessages(prev => ({ ...prev, [chatKey]: msgs }));
  };

  // All active users except the current one (master sees everyone, others see everyone except master)
  const otherUsers = usuarios.filter(u => {
    if (u.id === currentUser?.id) return false;
    if (!u.ativo) return false;
    return true;
  });

  const getUnread = (userId: string) => {
    const key = `${currentUser?.id}_${userId}`;
    const msgs = allMessages[key] || [];
    return msgs.filter(m => m.role === 'assistant').length % 2 === 1 ? 1 : 0;
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !selectedUser) return;
    const userMsg: Msg = { role: 'user', content: input.trim(), timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), from: currentUser?.nome, to: selectedUser.nome };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // notification
    const notifs = store.getNotificacoes();
    notifs.push({ id: store.nextId('notif'), tipo: 'chat', titulo: `Nova mensagem de ${currentUser?.nome}`, mensagem: input.trim().slice(0, 50), lida: false, createdAt: new Date().toISOString() });
    store.saveNotificacoes(notifs);

    let assistantContent = '';
    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages([...newMessages, { role: 'assistant', content: assistantContent, timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), from: selectedUser.nome }]);
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })), mode: 'chat' }),
      });
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: 'Erro de conexão' }));
        toast.error(err.error || 'Erro ao enviar mensagem');
        setIsLoading(false);
        return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ') || line.trim() === '') continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) updateAssistant(content);
          } catch {}
        }
      }
    } catch {
      toast.error('Erro de conexão com o servidor');
    }
    setIsLoading(false);
  };

  // User list view (no user selected)
  if (!selectedUser) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="mb-4">
          <h1 className="page-header">Bate-Papo</h1>
          <p className="page-subtitle">Escolha um usuário para conversar</p>
        </div>
        <div className="flex-1 bg-card border rounded-lg overflow-hidden">
          <div className="p-3 border-b bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" /> Contatos
            </div>
          </div>
          <div className="divide-y">
            {otherUsers.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhum outro usuário cadastrado. Cadastre mais usuários em Usuários.
              </div>
            )}
            {otherUsers.map(u => {
              const userPhoto = (u as any).foto;
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {userPhoto ? (
                      <img src={userPhoto} alt={u.nome} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{u.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary capitalize">{u.nivel}</span>
                    {getUnread(u.id) > 0 && (
                      <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">{getUnread(u.id)}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Chat view with selected user
  const userPhoto = (selectedUser as any).foto;
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-2 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
          {userPhoto ? (
            <img src={userPhoto} alt={selectedUser.nome} className="h-full w-full object-cover" />
          ) : (
            <User className="h-4 w-4 text-primary" />
          )}
        </div>
        <div>
          <h1 className="text-sm font-semibold">{selectedUser.nome}</h1>
          <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
        </div>
      </div>

      <div className="flex-1 bg-card border rounded-lg flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Conversa com {selectedUser.nome}</p>
                <p className="text-sm">Envie uma mensagem para começar</p>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                  {userPhoto ? <img src={userPhoto} alt="" className="h-full w-full object-cover" /> : <Bot className="h-4 w-4 text-primary" />}
                </div>
              )}
              <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'}`}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
                <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{msg.timestamp}</p>
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-secondary/20 flex items-center justify-center">
                  <User className="h-4 w-4 text-secondary" />
                </div>
              )}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t p-3">
          <div className="flex gap-2">
            <label className="cursor-pointer flex items-center">
              <Paperclip className="h-4 w-4 text-muted-foreground hover:text-primary" />
              <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (file) toast.info(`Arquivo "${file.name}" selecionado`);
              }} />
            </label>
            <Input
              placeholder="Digite sua mensagem..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={isLoading || !input.trim()} size="icon">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex justify-between mt-2">
            <p className="text-[10px] text-muted-foreground">Pressione Enter para enviar</p>
            <button onClick={() => { setMessages([]); }} className="text-[10px] text-muted-foreground hover:text-destructive">Limpar histórico</button>
          </div>
        </div>
      </div>
    </div>
  );
}
