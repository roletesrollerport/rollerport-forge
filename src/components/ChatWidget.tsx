import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, Users, ArrowLeft, Paperclip, Mic, MicOff, User, Trash2, FileText, File, Play, Pause, MoreVertical, MessageCircle, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useUsuarios, type UsuarioDB } from '@/hooks/useUsuarios';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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

interface ChatWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  initialUserId?: string | null;
  onClearInitialUser?: () => void;
}

export default function ChatWidget({ isOpen, onToggle, initialUserId, onClearInitialUser }: ChatWidgetProps) {
  const { usuarios: dbUsuarios } = useUsuarios();
  const [selectedUser, setSelectedUser] = useState<UsuarioDB | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  const loggedUserId = localStorage.getItem('rp_logged_user');
  const sessionToken = localStorage.getItem('rp_session_token');
  const currentUser = dbUsuarios.find(u => u.id === loggedUserId);
  const isMaster = currentUser?.nivel === 'master';
  const otherUsers = dbUsuarios.filter(u => u.id !== loggedUserId);

  // Handle initial user from notification
  useEffect(() => {
    if (initialUserId && isOpen && dbUsuarios.length > 0) {
      const user = dbUsuarios.find(u => u.id === initialUserId);
      if (user) {
        setSelectedUser(user);
        onClearInitialUser?.();
      }
    }
  }, [initialUserId, isOpen, dbUsuarios, onClearInitialUser]);

  const resolveFileUrl = useCallback(async (fileUrl: string | null): Promise<string> => {
    if (!fileUrl) return '';
    if (fileUrl.startsWith('http')) return fileUrl;
    if (signedUrls[fileUrl]) return signedUrls[fileUrl];
    try {
      const { data } = await supabase.functions.invoke('chat-api', {
        body: { action: 'get_signed_url', sessionToken, file_path: fileUrl },
      });
      if (data?.url) {
        setSignedUrls(prev => ({ ...prev, [fileUrl]: data.url }));
        return data.url;
      }
    } catch {}
    return fileUrl;
  }, [sessionToken, signedUrls]);

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

  const loadMessages = useCallback(async () => {
    if (!selectedUser || !currentUser) return;
    const { data, error } = await supabase
      .from('chat_messages' as any)
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });
    if (!error && data) {
      setMessages(data as unknown as ChatMessage[]);
    }
  }, [selectedUser, currentUser]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (!selectedUser || !currentUser) return;
    const channel = supabase
      .channel(`widget-chat-${[currentUser.id, selectedUser.id].sort().join('-')}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => { loadMessages(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedUser, currentUser, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendTextMessage = async () => {
    if (!input.trim() || !selectedUser || !currentUser || !sessionToken) return;
    const { error } = await supabase.functions.invoke('chat-api', {
      body: { action: 'send_message', sessionToken, receiver_id: selectedUser.id, content: input.trim(), message_type: 'text' },
    });
    if (error) { toast.error('Erro ao enviar mensagem'); return; }
    setInput('');
  };

  const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'csv', 'zip', 'rar'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const sanitizeFilename = (name: string): string => name.replace(/[^a-zA-Z0-9._\-\s]/g, '_').substring(0, 255);

  const sendFile = async (file: globalThis.File) => {
    if (!selectedUser || !currentUser || !sessionToken) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) { toast.error('Tipo de arquivo não permitido'); return; }
    if (file.size > MAX_FILE_SIZE) { toast.error('Arquivo muito grande (máx 10MB)'); return; }
    const path = `${currentUser.id}/${Date.now()}.${ext}`;
    toast.info(`Enviando ${sanitizeFilename(file.name)}...`);
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const { error: uploadError } = await supabase.functions.invoke('chat-api', {
      body: { action: 'upload_file', sessionToken, file_base64: base64, file_path: path, content_type: file.type },
    });
    if (uploadError) { toast.error('Erro ao enviar arquivo'); return; }
    const { error } = await supabase.functions.invoke('chat-api', {
      body: { action: 'send_message', sessionToken, receiver_id: selectedUser.id, message_type: 'file', file_url: path, file_name: sanitizeFilename(file.name), file_size: file.size },
    });
    if (error) { toast.error('Erro ao registrar arquivo'); return; }
    toast.success('Arquivo enviado!');
  };

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
        if (blob.size < 1000) return;
        const path = `${currentUser!.id}/audio_${Date.now()}.webm`;
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const { error: uploadError } = await supabase.functions.invoke('chat-api', {
          body: { action: 'upload_file', sessionToken, file_base64: base64, file_path: path, content_type: 'audio/webm' },
        });
        if (uploadError) { toast.error('Erro ao enviar áudio'); return; }
        await supabase.functions.invoke('chat-api', {
          body: { action: 'send_message', sessionToken, receiver_id: selectedUser!.id, message_type: 'audio', file_url: path, audio_duration: recordingTime },
        });
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch { toast.error('Não foi possível acessar o microfone'); }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  const deleteMessage = async (msg: ChatMessage, forAll: boolean) => {
    if (!currentUser || !sessionToken) return;
    const { error } = await supabase.functions.invoke('chat-api', {
      body: { action: 'delete_message', sessionToken, message_id: msg.id, for_all: forAll },
    });
    if (error) { toast.error('Erro ao apagar mensagem'); return; }
    loadMessages();
  };

  const toggleAudio = (msgId: string, url: string) => {
    if (playingAudio === msgId) { audioRefs.current[msgId]?.pause(); setPlayingAudio(null); }
    else {
      if (playingAudio && audioRefs.current[playingAudio]) audioRefs.current[playingAudio].pause();
      if (!audioRefs.current[msgId]) { audioRefs.current[msgId] = new Audio(url); audioRefs.current[msgId].onended = () => setPlayingAudio(null); }
      audioRefs.current[msgId].play();
      setPlayingAudio(msgId);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const formatFileSize = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext || '')) return <FileText className="h-4 w-4 text-destructive" />;
    if (['doc', 'docx', 'xls', 'xlsx'].includes(ext || '')) return <FileText className="h-4 w-4 text-primary" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };
  const getUserName = (id: string) => dbUsuarios.find(u => u.id === id)?.nome || 'Desconhecido';

  const visibleMessages = messages.filter(msg => {
    if (isMaster) return true;
    if (msg.deleted_for_all) return false;
    if (msg.deleted_for_sender && msg.sender_id === currentUser?.id) return false;
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[380px] h-[520px] bg-card border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground shrink-0">
        {selectedUser ? (
          <>
            <button onClick={() => setSelectedUser(null)} className="p-1 rounded hover:bg-primary-foreground/10">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-7 w-7 rounded-full bg-primary-foreground/20 flex items-center justify-center overflow-hidden">
              {selectedUser.foto ? <img src={selectedUser.foto} alt="" className="h-full w-full object-cover" /> : <User className="h-3.5 w-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedUser.nome}</p>
              <p className="text-[10px] opacity-70 capitalize">{selectedUser.nivel}</p>
            </div>
          </>
        ) : (
          <>
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm font-semibold flex-1">Bate-Papo</span>
          </>
        )}
        <button onClick={onToggle} className="p-1 rounded hover:bg-primary-foreground/10">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!selectedUser ? (
        /* Contact list */
        <div className="flex-1 overflow-y-auto divide-y">
          {otherUsers.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">Nenhum contato disponível.</div>
          )}
          {otherUsers.map(u => (
            <button key={u.id} onClick={() => setSelectedUser(u)} className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {u.foto ? <img src={u.foto} alt="" className="h-full w-full object-cover" /> : <User className="h-4 w-4 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.nome}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{u.nivel}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {visibleMessages.length === 0 && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-center">
                <div>
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Envie uma mensagem para começar</p>
                </div>
              </div>
            )}
            {visibleMessages.map(msg => {
              const isMine = msg.sender_id === currentUser?.id;
              const isDeleted = msg.deleted_for_all;
              return (
                <div key={msg.id} className={`flex gap-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                  {!isMine && (
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden mt-1">
                      {selectedUser.foto ? <img src={selectedUser.foto} alt="" className="h-full w-full object-cover" /> : <User className="h-3 w-3 text-primary" />}
                    </div>
                  )}
                  <div className="group relative max-w-[75%]">
                    <div className={`rounded-2xl px-3 py-2 text-xs ${
                      isDeleted ? 'bg-muted/50 border border-dashed' :
                      isMine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'
                    }`}>
                      {isDeleted ? (
                        <p className="italic text-muted-foreground text-[10px]">🗑 Mensagem apagada</p>
                      ) : msg.message_type === 'text' ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : msg.message_type === 'audio' ? (
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <button onClick={() => toggleAudio(msg.id, getFileUrl(msg.file_url))} className={`h-6 w-6 rounded-full flex items-center justify-center ${isMine ? 'bg-primary-foreground/20' : 'bg-primary/10'}`}>
                            {playingAudio === msg.id ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                          </button>
                          <span className="text-[10px]">🎤 {msg.audio_duration ? formatTime(msg.audio_duration) : 'Áudio'}</span>
                        </div>
                      ) : msg.message_type === 'file' ? (
                        <a href={getFileUrl(msg.file_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                          {getFileIcon(msg.file_name || '')}
                          <div className="min-w-0">
                            <p className="font-medium truncate">{msg.file_name}</p>
                            {msg.file_size && <p className="text-[9px] opacity-60">{formatFileSize(msg.file_size)}</p>}
                          </div>
                        </a>
                      ) : null}
                    </div>
                    <p className={`text-[9px] mt-0.5 ${isMine ? 'text-right' : ''} text-muted-foreground`}>
                      {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {!isDeleted && (
                      <div className={`absolute top-0 ${isMine ? '-left-6' : '-right-6'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-0.5 rounded hover:bg-muted"><MoreVertical className="h-3 w-3 text-muted-foreground" /></button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isMine ? 'start' : 'end'} className="text-xs">
                            <DropdownMenuItem onClick={() => deleteMessage(msg, false)} className="text-destructive text-xs">
                              <Trash2 className="h-3 w-3 mr-1" /> Apagar para mim
                            </DropdownMenuItem>
                            {isMine && (
                              <DropdownMenuItem onClick={() => deleteMessage(msg, true)} className="text-destructive text-xs">
                                <Trash2 className="h-3 w-3 mr-1" /> Apagar para todos
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t p-2 shrink-0">
            {isRecording ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-destructive/10 rounded-lg px-3 py-1.5">
                  <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-xs font-medium text-destructive">Gravando... {formatTime(recordingTime)}</span>
                </div>
                <Button onClick={stopRecording} variant="destructive" size="icon" className="h-8 w-8">
                  <MicOff className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp" className="hidden"
                  onChange={e => { const file = e.target.files?.[0]; if (file) sendFile(file); e.target.value = ''; }} />
                <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded hover:bg-muted">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <Input placeholder="Mensagem..." value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendTextMessage()} className="flex-1 h-8 text-xs" />
                {input.trim() ? (
                  <Button onClick={sendTextMessage} size="icon" className="h-8 w-8"><Send className="h-3.5 w-3.5" /></Button>
                ) : (
                  <Button onClick={startRecording} variant="outline" size="icon" className="h-8 w-8"><Mic className="h-3.5 w-3.5" /></Button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
