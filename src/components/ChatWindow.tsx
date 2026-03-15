import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Mic, MicOff, User, Trash2, FileText, File, Play, Pause, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { type UsuarioDB } from '@/hooks/useUsuarios';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export interface ChatMessage {
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

interface ChatWindowProps {
  selectedUser: UsuarioDB;
  currentUser: UsuarioDB;
  isMaster?: boolean;
}

export default function ChatWindow({ selectedUser, currentUser, isMaster = false }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  const sessionToken = localStorage.getItem('rp_session_token');

  // Signed URL cache
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

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

  const sendTextMessage = async () => {
    if (!input.trim() || !selectedUser || !currentUser || !sessionToken) return;
    const { error } = await supabase.functions.invoke('chat-api', {
      body: {
        action: 'send_message',
        sessionToken,
        receiver_id: selectedUser.id,
        content: input.trim(),
        message_type: 'text',
      },
    });
    if (error) { toast.error('Erro ao enviar mensagem'); return; }
    setInput('');
  };

  const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'csv', 'zip', 'rar'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const sanitizeFilename = (name: string): string => {
    return name.replace(/[^a-zA-Z0-9._\-\s]/g, '_').substring(0, 255);
  };

  const sendFile = async (file: globalThis.File) => {
    if (!selectedUser || !currentUser || !sessionToken) return;
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
    const path = `${currentUser.id}/${Date.now()}.${ext}`;
    toast.info(`Enviando ${safeName}...`);

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
    if (uploadError) { toast.error('Erro ao enviar arquivo'); return; }
    const { error } = await supabase.functions.invoke('chat-api', {
      body: {
        action: 'send_message',
        sessionToken,
        receiver_id: selectedUser.id,
        message_type: 'file',
        file_url: path,
        file_name: sanitizeFilename(file.name),
        file_size: file.size,
      },
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
          body: {
            action: 'upload_file',
            sessionToken,
            file_base64: base64,
            file_path: path,
            content_type: 'audio/webm',
          },
        });
        if (uploadError) { toast.error('Erro ao enviar áudio'); return; }
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

  const visibleMessages = messages.filter(msg => {
    if (isMaster) return true;
    if (msg.deleted_for_all) return false;
    if (msg.deleted_for_sender && msg.sender_id === currentUser?.id) return false;
    return true;
  });

  const userPhoto = selectedUser.foto;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
              <div className="group relative max-w-[85%]">
                <div className={`rounded-2xl px-4 py-2.5 ${
                  isDeleted
                    ? 'bg-muted/50 border border-dashed border-muted-foreground/20'
                    : isMine
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted rounded-bl-md'
                }`}>
                  {isDeleted ? (
                    <p className="text-xs italic text-muted-foreground">🗑 Mensagem apagada</p>
                  ) : msg.message_type === 'text' ? (
                    <p className="text-sm whitespace-pre-wrap text-left">{msg.content}</p>
                  ) : msg.message_type === 'audio' ? (
                    <div className="flex items-center gap-3 min-w-[150px]">
                      <button onClick={() => toggleAudio(msg.id, getFileUrl(msg.file_url))} className={`h-8 w-8 rounded-full flex items-center justify-center ${isMine ? 'bg-primary-foreground/20' : 'bg-primary/10'}`}>
                        {playingAudio === msg.id ? <Pause className={`h-4 w-4 ${isMine ? 'text-primary-foreground' : 'text-primary'}`} /> : <Play className={`h-4 w-4 ${isMine ? 'text-primary-foreground' : 'text-primary'}`} />}
                      </button>
                      <div className="flex-1">
                        <div className={`h-1 rounded-full ${isMine ? 'bg-primary-foreground/30' : 'bg-primary/20'}`}>
                          <div className={`h-1 rounded-full w-0 ${playingAudio === msg.id ? 'animate-pulse w-full' : ''} ${isMine ? 'bg-primary-foreground' : 'bg-primary'}`} />
                        </div>
                        <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>🎤 {msg.audio_duration ? formatTime(msg.audio_duration) : 'Áudio'}</p>
                      </div>
                    </div>
                  ) : msg.message_type === 'file' ? (
                    <a href={getFileUrl(msg.file_url)} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 ${isMine ? 'text-primary-foreground' : ''}`}>
                      {getFileIcon(msg.file_name || '')}
                      <div className="min-w-0 text-left">
                        <p className="text-sm font-medium truncate">{msg.file_name}</p>
                        {msg.file_size && <p className={`text-[10px] ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{formatFileSize(msg.file_size)}</p>}
                      </div>
                    </a>
                  ) : null}
                </div>
                <p className={`text-[10px] mt-0.5 ${isMine ? 'text-right' : 'text-left'} text-muted-foreground`}>
                  {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>

                {!isDeleted && (
                  <div className={`absolute top-1 ${isMine ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded hover:bg-muted"><MoreVertical className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isMine ? 'start' : 'end'}>
                        <DropdownMenuItem onClick={() => deleteMessage(msg, false)} className="text-destructive">
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Apagar para mim
                        </DropdownMenuItem>
                        {isMine && (
                          <DropdownMenuItem onClick={() => deleteMessage(msg, true)} className="text-destructive">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Apagar para todos
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
  );
}
