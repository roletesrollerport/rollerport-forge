import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Resilient edge function caller with direct fetch fallback
async function invokeEdgeFn(fnName: string, body: Record<string, unknown>) {
  try {
    const { data, error } = await supabase.functions.invoke(fnName, { body });
    if (!error) return { data, error: null };
  } catch {
    // fall through to fallback
  }
  // Fallback: direct fetch
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/${fnName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { data: null, error: { context: { status: res.status } } };
  const data = await res.json().catch(() => null);
  return { data, error: null };
}
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import CustosPage from "./pages/CustosPage";
import ClientesPage from "./pages/ClientesPage";
import ProdutosPage from "./pages/ProdutosPage";
import OrcamentosPage from "./pages/OrcamentosPage";
import PedidosPage from "./pages/PedidosPage";
import ProducaoPage from "./pages/ProducaoPage";
import EstoquePage from "./pages/EstoquePage";
import UsuariosPage from "./pages/UsuariosPage";
import ChatPage from "./pages/ChatPage";

import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import AgendaPage from "./pages/AgendaPage";
import GestaoDadosPage from "./pages/GestaoDadosPage";
import { useUsuarios, type UsuarioDB, parseUsuario } from "./hooks/useUsuarios";
import { useDataSync } from "./hooks/useDataSync";

const queryClient = new QueryClient();

function isFatalSessionValidationError(error: { context?: { status?: number } } | null, data: Record<string, unknown> | null): boolean {
  const status = error?.context?.status;
  if (status === 401 || status === 403) return true;
  if (data && data.valid === false) return true;
  return false;
}

function AppContent() {
  const [loggedUserId, setLoggedUserId] = useState<string | null>(() => localStorage.getItem('rp_logged_user'));
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem('rp_session_token'));
  const [currentUser, setCurrentUser] = useState<UsuarioDB | null>(null);
  const [checking, setChecking] = useState(true);
  const { getById } = useUsuarios();

  // Initialize bidirectional data sync with database
  useDataSync();

  const clearLocalSession = useCallback(() => {
    localStorage.removeItem('rp_logged_user');
    localStorage.removeItem('rp_session_token');
    setLoggedUserId(null);
    setSessionToken(null);
    setCurrentUser(null);
  }, []);

  useEffect(() => {
    const onSessionExpired = () => clearLocalSession();
    window.addEventListener('rp-session-expired', onSessionExpired);
    return () => window.removeEventListener('rp-session-expired', onSessionExpired);
  }, [clearLocalSession]);

  useEffect(() => {
    if (!loggedUserId || !sessionToken) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      const maxAttempts = 3;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (cancelled) return;

        const { data, error } = await invokeEdgeFn('chat-api', { action: 'validate_session', sessionToken });
        if (cancelled) return;

        const payload = data as { valid?: boolean; user_id?: string; user?: unknown } | null;
        const ok = !error && payload?.valid === true && payload?.user_id === loggedUserId;

        if (ok) {
          if (cancelled) return;
          if (payload?.user) {
            setCurrentUser(parseUsuario(payload.user));
          } else {
            try {
              const user = await getById(loggedUserId);
              if (cancelled) return;
              if (user) setCurrentUser(user);
              else {
                clearLocalSession();
                setChecking(false);
                return;
              }
            } catch {
              if (cancelled) return;
              clearLocalSession();
              setChecking(false);
              return;
            }
          }
          if (!cancelled) setChecking(false);
          return;
        }

        if (isFatalSessionValidationError(error, payload as Record<string, unknown> | null)) {
          if (!cancelled) {
            clearLocalSession();
            setChecking(false);
          }
          return;
        }

        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
        }
      }

      // Rede / edge instável: ainda há token — tenta carregar perfil direto (evita voltar ao login no F5)
      if (cancelled) return;
      try {
        const user = await getById(loggedUserId);
        if (cancelled) return;
        if (user) setCurrentUser(user);
        else clearLocalSession();
      } catch {
        if (!cancelled) clearLocalSession();
      }
      if (!cancelled) setChecking(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [loggedUserId, sessionToken, getById, clearLocalSession]);

  // Heartbeat: update last_seen every 60s while logged in (via edge function)
  useEffect(() => {
    if (!loggedUserId || !sessionToken) return;

    const is401SessionError = async (error: any) => {
      if (error?.context?.status === 401) return true;

      try {
        const jsonReader = error?.context?.json;
        if (typeof jsonReader === 'function') {
          const payload = await jsonReader.call(error.context);
          const text = String(payload?.error || '').toLowerCase();
          if (text.includes('invalid or expired session') || text.includes('missing session token')) {
            return true;
          }
        }
      } catch {
        // ignore parse failures
      }

      const message = String(error?.message || '').toLowerCase();
      return message.includes('401');
    };

    const updateLastSeen = async () => {
      const { error } = await invokeEdgeFn('chat-api', { action: 'heartbeat', sessionToken });

      if (error && await is401SessionError(error)) {
        clearLocalSession();
      }
    };

    updateLastSeen();
    const interval = setInterval(updateLastSeen, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [loggedUserId, sessionToken, clearLocalSession]);

  const handleLogin = (userId: string, token: string) => {
    localStorage.setItem('rp_logged_user', userId);
    localStorage.setItem('rp_session_token', token);
    setLoggedUserId(userId);
    setSessionToken(token);
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('rp_session_token');
    if (token) {
      await invokeEdgeFn('hash-password', { action: 'logout', sessionToken: token }).catch(() => {});
    }
    clearLocalSession();
  };

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Carregando...</div>;
  }

  if (!loggedUserId || !currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Map UsuarioDB to the shape AppLayout expects
  const userForLayout = {
    id: currentUser.id,
    nome: currentUser.nome,
    email: currentUser.email,
    telefone: currentUser.telefone,
    whatsapp: currentUser.whatsapp,
    login: currentUser.login,
    senha: currentUser.senha,
    nivel: currentUser.nivel,
    genero: currentUser.genero,
    ativo: currentUser.ativo,
    foto: currentUser.foto,
    permissoes: currentUser.permissoes,
    createdAt: currentUser.created_at,
  };

  return (
    <BrowserRouter>
      <AppLayout currentUser={userForLayout} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/custos" element={<CustosPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/produtos" element={<ProdutosPage />} />
          <Route path="/orcamentos" element={<OrcamentosPage />} />
          <Route path="/pedidos" element={<PedidosPage />} />
          <Route path="/producao" element={<ProducaoPage />} />
          <Route path="/producao/:id" element={<ProducaoPage />} />
          <Route path="/estoque" element={<EstoquePage />} />
          <Route path="/chat" element={<ChatPage />} />

          <Route path="/usuarios" element={<UsuariosPage />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/gestao-dados" element={<GestaoDadosPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
