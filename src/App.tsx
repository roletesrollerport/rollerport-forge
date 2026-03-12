import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import IAPage from "./pages/IAPage";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import { useUsuarios, type UsuarioDB } from "./hooks/useUsuarios";
import { useDataSync } from "./hooks/useDataSync";

const queryClient = new QueryClient();

function AppContent() {
  const [loggedUserId, setLoggedUserId] = useState<string | null>(() => localStorage.getItem('rp_logged_user'));
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem('rp_session_token'));
  const [currentUser, setCurrentUser] = useState<UsuarioDB | null>(null);
  const [checking, setChecking] = useState(true);
  const { getById } = useUsuarios();
  
  // Initialize bidirectional data sync with database
  useDataSync();

  useEffect(() => {
    if (loggedUserId && sessionToken) {
      // Validate session server-side
      supabase.functions.invoke('chat-api', {
        body: { action: 'validate_session', sessionToken },
      }).then(({ data, error }) => {
        if (error || !data?.valid || data?.user_id !== loggedUserId) {
          localStorage.removeItem('rp_logged_user');
          localStorage.removeItem('rp_session_token');
          setLoggedUserId(null);
          setSessionToken(null);
          setChecking(false);
          return;
        }
        getById(loggedUserId).then(user => {
          if (user) {
            setCurrentUser(user);
          } else {
            localStorage.removeItem('rp_logged_user');
            localStorage.removeItem('rp_session_token');
            setLoggedUserId(null);
            setSessionToken(null);
          }
          setChecking(false);
        }).catch(() => {
          setChecking(false);
        });
      }).catch(() => {
        // Session invalid or network error - show login
        localStorage.removeItem('rp_logged_user');
        localStorage.removeItem('rp_session_token');
        setLoggedUserId(null);
        setSessionToken(null);
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, [loggedUserId]);

  // Heartbeat: update last_seen every 60s while logged in (via edge function)
  useEffect(() => {
    if (!loggedUserId || !sessionToken) return;
    const updateLastSeen = () => {
      supabase.functions.invoke('chat-api', {
        body: { action: 'heartbeat', sessionToken },
      }).catch(() => {});
    };
    updateLastSeen();
    const interval = setInterval(updateLastSeen, 60000);

    // On tab close / navigate away, try to clean up session
    const handleUnload = () => {
      const token = localStorage.getItem('rp_session_token');
      if (token) {
        const blob = new Blob(
          [JSON.stringify({ action: 'logout', sessionToken: token })],
          { type: 'application/json' }
        );
        navigator.sendBeacon(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hash-password`,
          blob
        );
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [loggedUserId, sessionToken]);

  const handleLogin = (userId: string, token: string) => {
    localStorage.setItem('rp_logged_user', userId);
    localStorage.setItem('rp_session_token', token);
    setLoggedUserId(userId);
    setSessionToken(token);
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('rp_session_token');
    if (token) {
      await supabase.functions.invoke('hash-password', {
        body: { action: 'logout', sessionToken: token },
      }).catch(() => {});
    }
    localStorage.removeItem('rp_logged_user');
    localStorage.removeItem('rp_session_token');
    setLoggedUserId(null);
    setSessionToken(null);
    setCurrentUser(null);
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
          <Route path="/estoque" element={<EstoquePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/ia" element={<IAPage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
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
