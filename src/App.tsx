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
import GerenciamentoPage from "./pages/GerenciamentoPage";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import { useUsuarios, type UsuarioDB } from "./hooks/useUsuarios";
import { useDataSync } from "./hooks/useDataSync";
import { store } from "./lib/store";
import { formatCPForCNPJ, formatTelefone } from "./lib/formatters";

const queryClient = new QueryClient();

function AppContent() {
  const [currentUser, setCurrentUser] = useState<UsuarioDB | null>(null);
  const [checking, setChecking] = useState(true);
  const { getByAuthId } = useUsuarios();

  // Initialize bidirectional data sync with database
  useDataSync();

  // One-time data migration for formatting
  useEffect(() => {
    const hasMigrated = localStorage.getItem('rp_format_migration_v1');
    if (!hasMigrated) {
      console.log('Running format migration...');
      try {
        const clientes = store.getClientes();
        let changedClientes = false;
        const newClientes = clientes.map(c => {
          let cChanged = false;
          const newC = { ...c };
          if (c.cnpj && c.cnpj !== formatCPForCNPJ(c.cnpj)) { newC.cnpj = formatCPForCNPJ(c.cnpj); cChanged = true; }
          if (c.telefone && c.telefone !== formatTelefone(c.telefone)) { newC.telefone = formatTelefone(c.telefone); cChanged = true; }
          if (c.whatsapp && c.whatsapp !== formatTelefone(c.whatsapp)) { newC.whatsapp = formatTelefone(c.whatsapp); cChanged = true; }
          if (c.compradores) {
            newC.compradores = c.compradores.map(comp => {
              const newComp = { ...comp };
              if (comp.telefone && comp.telefone !== formatTelefone(comp.telefone)) { newComp.telefone = formatTelefone(comp.telefone); cChanged = true; }
              if (comp.whatsapp && comp.whatsapp !== formatTelefone(comp.whatsapp)) { newComp.whatsapp = formatTelefone(comp.whatsapp); cChanged = true; }
              return newComp;
            });
          }
          if (cChanged) changedClientes = true;
          return newC;
        });
        if (changedClientes) store.saveClientes(newClientes);

        const orcamentos = store.getOrcamentos();
        let changedOrcs = false;
        const newOrcs = orcamentos.map(o => {
          let oChanged = false;
          const newO: any = { ...o };
          if (newO.clienteCnpj && newO.clienteCnpj !== formatCPForCNPJ(newO.clienteCnpj)) { newO.clienteCnpj = formatCPForCNPJ(newO.clienteCnpj); oChanged = true; }
          if (newO.clienteTelefone && newO.clienteTelefone !== formatTelefone(newO.clienteTelefone)) { newO.clienteTelefone = formatTelefone(newO.clienteTelefone); oChanged = true; }
          if (newO.compradorTelefone && newO.compradorTelefone !== formatTelefone(newO.compradorTelefone)) { newO.compradorTelefone = formatTelefone(newO.compradorTelefone); oChanged = true; }
          if (oChanged) changedOrcs = true;
          return newO;
        });
        if (changedOrcs) store.saveOrcamentos(newOrcs);

        localStorage.setItem('rp_format_migration_v1', 'true');
        console.log('Format migration complete.');
      } catch (e) {
        console.error('Migration failed', e);
      }
    }
  }, []);

  // Supabase Auth listener
  useEffect(() => {
    // Safety timeout — never stay stuck on "Carregando" for more than 5s
    const timeout = setTimeout(() => {
      if (checking) {
        console.warn('[App] Auth check timed out, proceeding without user');
        setChecking(false);
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        try {
          const profile = await getByAuthId(session.user.id);
          if (profile) {
            setCurrentUser(profile);
          } else {
            await supabase.auth.signOut();
            setCurrentUser(null);
          }
        } catch (err) {
          console.error('[App] Error fetching profile:', err);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setChecking(false);
    });

    // Check existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        try {
          const profile = await getByAuthId(session.user.id);
          if (profile) {
            setCurrentUser(profile);
          }
        } catch (err) {
          console.error('[App] Error fetching profile on init:', err);
        }
      }
      setChecking(false);
    }).catch(() => {
      setChecking(false);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = (userId: string) => {
    // Session is already set by supabase.auth.signInWithPassword
    // The onAuthStateChange listener will pick up the user
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Carregando...</div>;
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

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
          <Route path="/usuarios" element={<UsuariosPage />} />
          <Route path="/gerenciamento" element={<GerenciamentoPage />} />
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
