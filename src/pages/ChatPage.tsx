import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Users, ArrowLeft, Paperclip, Mic, MicOff, User, Trash2, FileText, File, Play, Pause, MoreVertical, Eye, Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useUsuarios, type UsuarioDB } from '@/hooks/useUsuarios';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { getAuthHeaders } from '@/lib/auth';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  audio_duration: number | null;
  deleted_for_sender: boolean;
  deleted_for_all: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
}

export default function ChatPage() {
  const { usuarios: dbUsuarios, loading: loadingUsers } = useUsuarios();
  const [selectedUser, setSelectedUser] = useState<UsuarioDB | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [masterViewDialog, setMasterViewDialog] = useState(false);
  const [masterViewUsers, setMasterViewUsers] = useState<{ u1: UsuarioDB; u2: UsuarioDB } | null>(null);
  const [masterMessages, setMasterMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  const loggedUserId = useCurrentUserId();

  const usuarios = dbUsuarios;

  const currentUser = usuarios.find(u => u.id === loggedUserId);
  const isMaster = currentUser?.nivel === 'master';
  const otherUsers = usuarios.filter(u => u.id !== loggedUserId);

  // Signed URL cache
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const resolveFileUrl = useCallback(async (fileUrl: string | null): Promise<string> => {
    if (!fileUrl) return '';
    if (fileUrl.startsWith('http')) return fileUrl;
    if (signedUrls[fileUrl]) return signedUrls[fileUrl];
    try {
      const headers = await getAuthHeaders();
      const { data } = await supabase.functions.invoke('chat-api', {
        body: { action: 'get_signed_url', file_path: fileUrl },
        headers,
      });
      if (data?.url) {
        setSignedUrls(prev => ({ ...prev, [fileUrl]: data.url }));
        return data.url;
      }
    } catch {}
    return fileUrl;
  }, [signedUrls]);

  // Resolve URLs for visible messages
  useEffect(() => {
    const toResolve = messages.filter(m => 
      (m.message_type === 'file' || m.message_type === 'audio') && 
      m.file_url && !m.file_url.startsWith('http') && !signedUrls[m.file_url]
    );
    toResolve.forEach(m => resolveFileUrl(m.file_url));
  }, [messages, signedUrls, resolveFileUrl]);

  const getFileUrl = (fileUrl: string | null): string => {
    if (!fileUrl) return '';
    if (fileUrl.startsWith('http')) return fileUrl;
    return signedUrls[fileUrl] || '#';
  };

  // Load messages for conversation
  const loadMessages = useCallback(async () => {
    if (!selectedUser || !currentUser) return;
    const { data, error } = await supabase
      .from('chat_messages' as any)
      .select('id, data, created_at')
      .filter('data->>sender_id', 'in', `(${[currentUser.id, selectedUser.id].join(',')})`)
      .filter('data->>receiver_id', 'in', `(${[currentUser.id, selectedUser.id].join(',')})`)
      .order('created_at', { ascending: true });
    
    if (!error && data) {
      const msgs = (data as any[]).map(r => ({
        id: r.id,
        created_at: r.created_at,
        ...(r.data || {})
      })) as ChatMessage[];
      
      // Filter manually to ensure it's specifically between these two (PostgREST in filter is OR-like for members)
      const filtered = msgs.filter(m => 
        (m.sender_id === currentUser.id && m.receiver_id === selectedUser.id) ||
        (m.sender_id === selectedUser.id && m.receiver_id === currentUser.id)
      );
      setMessages(filtered);
    }
  }, [selectedUser, currentUser]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedUser || !currentUser) return;
    const channel = supabase
      .channel(`chat-${[currentUser.id, selectedUser.id].sort().join('-')}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_messages',
      }, () => {
        loadMessages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedUser, currentUser, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send text message (via edge function - server enforces sender_id)
  const sendTextMessage = async () => {
    if (!input.trim() || !selectedUser || !currentUser) return;
    
    const messageData = {
      sender_id: currentUser.id,
      receiver_id: selectedUser.id,
      content: input.trim(),
      message_type: 'text',
      created_at: new Date().toISOString()
    };

    try {
      // Try Edge Function first
      if (sessionToken) {
        const { error } = await supabase.functions.invoke('chat-api', {
          body: {
            action: 'send_message',
            sessionToken,
            receiver_id: selectedUser.id,
            content: input.trim(),
            message_type: 'text',
          },
        });
        if (!error) { setInput(''); return; }
      }
      
      // Fallback: Direct DB insert
      const { error } = await supabase.from('chat_messages' as any).insert({ 
        data: messageData 
      });
      if (error) throw error;
      setInput('');
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Erro ao enviar mensagem');
    }
  };

  // Send file
  const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'csv', 'zip', 'rar'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const sanitizeFilename = (name: string): string => {
    return name.replace(/[^a-zA-Z0-9._\-\s]/g, '_').substring(0, 255);
  };

  const sendFile = async (file: globalThis.File) => {
    if (!selectedUser || !currentUser) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error('Tipo de arquivo não permitido');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Arquivo muito grande (máx 10MB)');
      return;
    }
    const safeName = sanitizeFilename(file.name);
    const path = `${currentUser.id}/${Date.now()}_${safeName}`;
    toast.info(`Enviando ${safeName}...`);

    try {
      // Try upload via edge function
      if (sessionToken) {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const { error: uploadError } = await supabase.functions.invoke('chat-api', {
          body: {
            action: 'upload_file',
            sessionToken,
            file_base64: base64,
            file_path: path,
            content_type: file.type,
          },
        });
        
        if (!uploadError) {
          // Send message record via edge function
          const { error } = await supabase.functions.invoke('chat-api', {
            body: {
              action: 'send_message',
              sessionToken,
              receiver_id: selectedUser.id,
              message_type: 'file',
              file_url: path,
              file_name: safeName,
              file_size: file.size,
            },
          });
          if (!error) { toast.success('Arquivo enviado!'); return; }
        }
      }

      // Fallback: Direct Storage and DB
      const { error: directUploadError } = await supabase.storage
        .from('chat-files')
        .upload(path, file);
      
      if (directUploadError) throw directUploadError;

      const { error: directInsertError } = await supabase.from('chat_messages' as any).insert({
        data: {
          sender_id: currentUser.id,
          receiver_id: selectedUser.id,
          message_type: 'file',
          file_url: path,
          file_name: safeName,
          file_size: file.size,
          created_at: new Date().toISOString()
        }
      });
      
      if (directInsertError) throw directInsertError;
      toast.success('Arquivo enviado!');
    } catch (err) {
      console.error('File upload error:', err);
      toast.error('Erro ao enviar arquivo');
    }
  };

  // Audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);

      mediaRecorder.ondataavailable = (e) => { audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) return; // too short
        const path = `${currentUser!.id}/audio_${Date.now()}.webm`;
        // Convert blob to base64 for edge function upload
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const { error: uploadError } = await supabase.functions.invoke('chat-api', {
          body: {
            action: 'upload_file',
            sessionToken,
            file_base64: base64,
            file_path: path,
            content_type: 'audio/webm',
          },
        });
        if (uploadError) { toast.error('Erro ao enviar áudio'); return; }
        // Use edge function for insert (server enforces sender_id)
        await supabase.functions.invoke('chat-api', {
          body: {
            action: 'send_message',
            sessionToken,
            receiver_id: selectedUser!.id,
            message_type: 'audio',
            file_url: path,
            audio_duration: recordingTime,
          },
        });
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  // Delete message (via edge function)
  const deleteMessage = async (msg: ChatMessage, forAll: boolean) => {
    if (!currentUser || !sessionToken) return;
    const { error } = await supabase.functions.invoke('chat-api', {
      body: {
        action: 'delete_message',
        sessionToken,
        message_id: msg.id,
        for_all: forAll,
      },
    });
    if (error) { toast.error('Erro ao apagar mensagem'); return; }
    loadMessages();
  };

  // Master: view conversation between two users
  const masterViewConversation = async (u1: UsuarioDB, u2: UsuarioDB) => {
    const { data } = await supabase
      .from('chat_messages' as any)
      .select('id, data, created_at')
      .filter('data->>sender_id', 'in', `(${[u1.id, u2.id].join(',')})`)
      .filter('data->>receiver_id', 'in', `(${[u1.id, u2.id].join(',')})`)
      .order('created_at', { ascending: true });

    if (data) {
      const msgs = (data as any[]).map(r => ({
        id: r.id,
        created_at: r.created_at,
        ...(r.data || {})
      })) as ChatMessage[];
      
      const filtered = msgs.filter(m => 
        (m.sender_id === u1.id && m.receiver_id === u2.id) ||
        (m.sender_id === u2.id && m.receiver_id === u1.id)
      );
      setMasterMessages(filtered);
      setMasterViewUsers({ u1, u2 });
      setMasterViewDialog(true);
    }
  };

  // Audio playback
  const toggleAudio = (msgId: string, url: string) => {
    if (playingAudio === msgId) {
      audioRefs.current[msgId]?.pause();
      setPlayingAudio(null);
    } else {
      if (playingAudio && audioRefs.current[playingAudio]) {
        audioRefs.current[playingAudio].pause();
      }
      if (!audioRefs.current[msgId]) {
        audioRefs.current[msgId] = new Audio(url);
        audioRefs.current[msgId].onended = () => setPlayingAudio(null);
      }
      audioRefs.current[msgId].play();
      setPlayingAudio(msgId);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const formatFileSize = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext || '')) return <FileText className="h-5 w-5 text-red-500" />;
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext || '')) return <FileText className="h-5 w-5 text-blue-500" />;
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const getUserName = (id: string) => usuarios.find(u => u.id === id)?.nome || 'Desconhecido';

  // Filter visible messages
  const visibleMessages = messages.filter(msg => {
    // Master sees everything including deleted
    if (isMaster) return true;
    // Deleted for all - nobody sees
    if (msg.deleted_for_all && msg.sender_id !== currentUser?.id) return false;
    if (msg.deleted_for_all && msg.sender_id === currentUser?.id) return false;
    // Deleted for sender - sender doesn't see
    if (msg.deleted_for_sender && msg.sender_id === currentUser?.id) return false;
    return true;
  });

  // User list view
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
            {otherUsers.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhum outro usuário cadastrado.
              </div>
            )}
            {otherUsers.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                <button
                  onClick={() => setSelectedUser(u)}
                  className="flex-1 flex items-center gap-3 text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {u.foto ? (
                      <img src={u.foto} alt={u.nome} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-5 w-5 text-primary" />
                    )}
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

        {/* Master view dialog */}
        <Dialog open={masterViewDialog} onOpenChange={setMasterViewDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center justify-between">
                <span>Conversa: {masterViewUsers?.u1.nome} ↔ {masterViewUsers?.u2.nome}</span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => {
                      const lines = masterMessages.map(msg => {
                        const time = new Date(msg.created_at).toLocaleString('pt-BR');
                        const sender = getUserName(msg.sender_id);
                        const deleted = msg.deleted_for_all ? ' [APAGADA P/ TODOS]' : msg.deleted_for_sender ? ' [APAGADA P/ REMETENTE]' : '';
                        const content = msg.message_type === 'text' ? msg.content : msg.message_type === 'audio' ? '[Áudio]' : `[Arquivo: ${msg.file_name}]`;
                        return `[${time}] ${sender}${deleted}: ${content}`;
                      });
                      const header = `HISTÓRICO DE CONVERSA\n${masterViewUsers?.u1.nome} ↔ ${masterViewUsers?.u2.nome}\nExportado em: ${new Date().toLocaleString('pt-BR')}\n${'—'.repeat(40)}\n\n`;
                      const blob = new Blob([header + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `conversa_${masterViewUsers?.u1.nome}_${masterViewUsers?.u2.nome}_${new Date().toISOString().slice(0,10)}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Histórico salvo!');
                    }}
                  >
                    <Download className="h-3.5 w-3.5" /> Salvar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => {
                      const lines = masterMessages.map(msg => {
                        const time = new Date(msg.created_at).toLocaleString('pt-BR');
                        const sender = getUserName(msg.sender_id);
                        const deleted = msg.deleted_for_all ? ' <span style="color:red">[APAGADA]</span>' : '';
                        const content = msg.message_type === 'text' ? msg.content : msg.message_type === 'audio' ? '<em>[Áudio]</em>' : `<em>[Arquivo: ${msg.file_name}]</em>`;
                        return `<p><strong>[${time}] ${sender}</strong>${deleted}: ${content}</p>`;
                      });
                      const html = `<html><head><title>Conversa</title><style>body{font-family:sans-serif;padding:20px;font-size:13px}h2{font-size:16px}p{margin:4px 0}</style></head><body><h2>Conversa: ${masterViewUsers?.u1.nome} ↔ ${masterViewUsers?.u2.nome}</h2><p style="color:gray;font-size:11px">Exportado em: ${new Date().toLocaleString('pt-BR')}</p><hr/>${lines.join('')}</body></html>`;
                      const win = window.open('', '_blank');
                      if (win) { win.document.write(html); win.document.close(); win.print(); }
                    }}
                  >
                    <Printer className="h-3.5 w-3.5" /> Imprimir
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              {masterMessages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem encontrada.</p>
              )}
              {masterMessages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.deleted_for_all || msg.deleted_for_sender ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold">{getUserName(msg.sender_id)}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(msg.created_at).toLocaleString('pt-BR')}</span>
                    {(msg.deleted_for_all || msg.deleted_for_sender) && (
                      <span className="text-[10px] text-destructive font-medium">
                        {msg.deleted_for_all ? '🗑 Apagada para todos' : '🗑 Apagada para si'}
                        {msg.deleted_by && ` por ${getUserName(msg.deleted_by)}`}
                      </span>
                    )}
                  </div>
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm max-w-[80%]">
                    {msg.message_type === 'text' && <p>{msg.content}</p>}
                    {msg.message_type === 'file' && (
                      <a href={getFileUrl(msg.file_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                        {getFileIcon(msg.file_name || '')} {msg.file_name}
                      </a>
                    )}
                    {msg.message_type === 'audio' && <p className="italic text-muted-foreground">🎤 Mensagem de áudio</p>}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Chat view
  const userPhoto = selectedUser.foto;
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
          <p className="text-xs text-muted-foreground capitalize">{selectedUser.nivel}</p>
        </div>
      </div>

      <div className="flex-1 bg-card border rounded-lg flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {visibleMessages.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Conversa com {selectedUser.nome}</p>
                <p className="text-sm">Envie uma mensagem para começar</p>
              </div>
            </div>
          )}
          {visibleMessages.map(msg => {
            const isMine = msg.sender_id === currentUser?.id;
            const isDeleted = msg.deleted_for_all;
            return (
              <div key={msg.id} className={`flex gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                {!isMine && (
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden mt-1">
                    {userPhoto ? <img src={userPhoto} alt="" className="h-full w-full object-cover" /> : <User className="h-3.5 w-3.5 text-primary" />}
                  </div>
                )}
                <div className="group relative max-w-[70%]">
                  <div className={`rounded-2xl px-4 py-2.5 ${
                    isDeleted
                      ? 'bg-muted/50 border border-dashed border-muted-foreground/20'
                      : isMine
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted rounded-bl-md'
                  }`}>
                    {isDeleted ? (
                      <p className="text-xs italic text-muted-foreground">
                        {isMaster ? `🗑 Mensagem apagada por ${getUserName(msg.deleted_by || '')}` : '🗑 Mensagem apagada'}
                      </p>
                    ) : msg.message_type === 'text' ? (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    ) : msg.message_type === 'audio' ? (
                      <div className="flex items-center gap-3 min-w-[180px]">
                        <button onClick={() => toggleAudio(msg.id, getFileUrl(msg.file_url))} className={`h-8 w-8 rounded-full flex items-center justify-center ${isMine ? 'bg-primary-foreground/20' : 'bg-primary/10'}`}>
                          {playingAudio === msg.id ? <Pause className={`h-4 w-4 ${isMine ? 'text-primary-foreground' : 'text-primary'}`} /> : <Play className={`h-4 w-4 ${isMine ? 'text-primary-foreground' : 'text-primary'}`} />}
                        </button>
                        <div className="flex-1">
                          <div className={`h-1 rounded-full ${isMine ? 'bg-primary-foreground/30' : 'bg-primary/20'}`}>
                            <div className={`h-1 rounded-full w-0 ${playingAudio === msg.id ? 'animate-pulse w-full' : ''} ${isMine ? 'bg-primary-foreground' : 'bg-primary'}`} />
                          </div>
                          <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                            🎤 {msg.audio_duration ? formatTime(msg.audio_duration) : 'Áudio'}
                          </p>
                        </div>
                      </div>
                    ) : msg.message_type === 'file' ? (
                      <a href={getFileUrl(msg.file_url)} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 ${isMine ? 'text-primary-foreground' : ''}`}>
                        {getFileIcon(msg.file_name || '')}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{msg.file_name}</p>
                          {msg.file_size && <p className={`text-[10px] ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{formatFileSize(msg.file_size)}</p>}
                        </div>
                      </a>
                    ) : null}
                  </div>
                  <p className={`text-[10px] mt-0.5 ${isMine ? 'text-right' : 'text-left'} text-muted-foreground`}>
                    {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>

                  {/* Delete menu */}
                  {!isDeleted && (
                    <div className={`absolute top-1 ${isMine ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded hover:bg-muted"><MoreVertical className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isMine ? 'start' : 'end'}>
                          {isMine && (
                            <DropdownMenuItem onClick={() => deleteMessage(msg, false)} className="text-destructive">
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Apagar para mim
                            </DropdownMenuItem>
                          )}
                          {isMine && (
                            <DropdownMenuItem onClick={() => deleteMessage(msg, true)} className="text-destructive">
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Apagar para todos
                            </DropdownMenuItem>
                          )}
                          {!isMine && (
                            <DropdownMenuItem onClick={() => deleteMessage(msg, false)} className="text-destructive">
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Apagar para mim
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
                {isMine && (
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-secondary/20 flex items-center justify-center overflow-hidden mt-1">
                    {currentUser?.foto ? <img src={currentUser.foto} alt="" className="h-full w-full object-cover" /> : <User className="h-3.5 w-3.5 text-secondary" />}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="border-t p-3">
          {isRecording ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-3 bg-destructive/10 rounded-lg px-4 py-2">
                <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm font-medium text-destructive">Gravando... {formatTime(recordingTime)}</span>
              </div>
              <Button onClick={stopRecording} variant="destructive" size="icon">
                <MicOff className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) sendFile(file);
                  e.target.value = '';
                }}
              />
              <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-md hover:bg-muted transition-colors" title="Enviar arquivo">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
              </button>
              <Input
                placeholder="Digite sua mensagem..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendTextMessage()}
                className="flex-1"
              />
              {input.trim() ? (
                <Button onClick={sendTextMessage} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={startRecording} variant="outline" size="icon" title="Gravar áudio">
                  <Mic className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
