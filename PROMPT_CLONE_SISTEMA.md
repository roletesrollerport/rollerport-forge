# PROMPT COMPLETO PARA CLONE DO SISTEMA ROLLERPORT ERP

## VISÃO GERAL

Crie um sistema ERP completo para uma fábrica de roletes para correias transportadoras chamada **ROLLERPORT**. O sistema é uma aplicação web SPA (Single Page Application) em React + TypeScript + Tailwind CSS + Vite, com backend Supabase (Edge Functions + PostgreSQL + Realtime + Storage).

O sistema deve ter:
- Autenticação própria (sem Supabase Auth, com tabela `usuarios` + `sessions`)
- Sincronização bidirecional localStorage ↔ Supabase (padrão JSON blob)
- Chat em tempo real estilo WhatsApp
- Dashboard com métricas, metas de vendedores, presença online
- Módulos: Custos, Clientes/Revendas, Produtos, Orçamentos, Pedidos, Produção (O.S.), Estoque, Usuários, Bate-Papo
- Impressão otimizada para cada módulo
- Sistema de permissões granular por módulo (ver/editar)
- Níveis de acesso: master, admin, SEO, Administrador, Vendas, Estoque, Produção
- Notificações de aniversários, pedidos e produção
- Análise IA de desempenho de vendedores com streaming

---

## STACK TECNOLÓGICA

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Edge Functions em Deno, Realtime, Storage)
- **Bibliotecas:** @tanstack/react-query, react-router-dom v6, recharts, xlsx, lucide-react, react-markdown, sonner (toasts), date-fns, framer-motion (opcional), react-circular-progressbar, react-gauge-chart
- **Autenticação:** Custom (edge functions hash-password, user-api, chat-api, password-recovery)
- **Armazenamento:** localStorage como cache + Supabase como source of truth

---

## DESIGN SYSTEM (index.css)

Tema industrial com tons azuis escuros e laranja como accent. Fonte: Inter + JetBrains Mono.

### Cores (HSL):
```css
:root {
  --background: 210 20% 96%;
  --foreground: 215 30% 15%;
  --card: 0 0% 100%;
  --primary: 215 60% 32%;        /* Azul escuro industrial */
  --primary-foreground: 0 0% 100%;
  --secondary: 35 85% 55%;       /* Laranja */
  --secondary-foreground: 0 0% 100%;
  --muted: 210 15% 90%;
  --accent: 10 70% 50%;           /* Vermelho-laranja */
  --destructive: 0 72% 51%;
  --success: 142 60% 40%;
  --warning: 35 85% 55%;
  --info: 200 80% 50%;
  --sidebar-background: 215 35% 18%;
  --sidebar-foreground: 210 15% 85%;
  --sidebar-primary: 35 85% 55%;
  --sidebar-accent: 215 30% 25%;
}
```

### Classes utilitárias:
```css
.stat-card { @apply bg-card rounded-lg border p-5 shadow-sm transition-all duration-200 hover:shadow-md; }
.page-header { @apply text-2xl font-bold text-foreground tracking-tight; }
.page-subtitle { @apply text-sm text-muted-foreground mt-1; }
```

### Print styles: Ocultar sidebar, header, botões fixos. Main sem padding. Landscape para O.S.

---

## ESQUEMA DO BANCO DE DADOS

### Tabelas com padrão JSON blob (id TEXT, data JSONB, updated_at TIMESTAMPTZ):
- `clientes`
- `fornecedores`
- `orcamentos`
- `pedidos`
- `ordens_servico`
- `produtos`
- `estoque`
- `metas_vendedores` (PK: vendedor TEXT)

### Tabelas com colunas flat:
- `usuarios` (id UUID, nome, email, telefone, whatsapp, login, senha (texto plano para comuns, bcrypt legado migra para plano), nivel, genero, ativo, foto TEXT base64, permissoes JSONB, last_seen, created_at)
- `sessions` (id UUID, user_id UUID, token TEXT, expires_at TIMESTAMPTZ, created_at)
- `chat_messages` (id UUID, sender_id TEXT, receiver_id TEXT, content, message_type ['text','file','audio'], file_url, file_name, file_size, audio_duration, deleted_for_sender, deleted_for_all, deleted_at, deleted_by, created_at)
- `custos_tubos` (id UUID, diametro NUMERIC, parede NUMERIC, preco_barra_6000mm NUMERIC, imagem TEXT, created_at)
- `custos_eixos` (id UUID, diametro TEXT, preco_barra_6000mm NUMERIC, imagem, created_at)
- `custos_conjuntos` (id UUID, codigo TEXT, valor NUMERIC, imagem, created_at)
- `custos_revestimentos` (id UUID, tipo TEXT, valor_metro_ou_peca NUMERIC, imagem, created_at)
- `custos_encaixes` (id UUID, tipo TEXT, preco NUMERIC, imagem, created_at)

### Storage Buckets:
- `chat-files` (privado) – arquivos e áudios do chat
- `avatars` (público) – fotos de perfil

### RLS:
- Todas as tabelas têm RLS habilitado
- SELECT: PERMISSIVE com `USING (true)` para todas as tabelas de dados
- INSERT/UPDATE/DELETE: RESTRICTIVE com `false` para tabelas de dados (operações via Edge Functions com service_role)
- `sessions`: sem políticas (acesso via service_role)
- `chat_messages`: SELECT com `true`, INSERT/UPDATE/DELETE bloqueados (via Edge Functions)

### Realtime:
- Habilitado para: orcamentos, pedidos, ordens_servico, clientes, produtos, estoque, metas_vendedores, chat_messages

---

## TIPOS TypeScript (src/lib/types.ts)

```typescript
// CUSTOS
interface Tubo { id: string; diametro: number; parede: number; precoBarra6000mm: number; imagem?: string; }
interface Eixo { id: string; diametro: string; precoBarra6000mm: number; imagem?: string; }
interface Conjunto { id: string; codigo: string; valor: number; imagem?: string; }
interface Revestimento { id: string; tipo: string; valorMetroOuPeca: number; imagem?: string; }
interface Encaixe { id: string; tipo: string; preco: number; imagem?: string; }

type RegimeTributario = 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real' | 'Isento';

interface EmpresaEmissora {
  id: string; nome: string; razaoSocial: string; cnpj: string; ie: string;
  endereco: string; bairro: string; cidade: string; estado: string; cep: string;
  telefone: string; email: string; regimeTributario: RegimeTributario; logo?: string;
}

// CLIENTES
interface Comprador { nome: string; telefone: string; email: string; whatsapp: string; aniversario?: string; redesSociais?: string; }
interface Cliente {
  id: string; nome: string; cnpj: string; email: string; telefone: string; whatsapp: string;
  endereco: string; bairro?: string; cidade: string; estado: string; cep?: string; contato: string;
  compradores: Comprador[]; regimeTributario: RegimeTributario;
  inscricaoEstadual?: string; inscricaoMunicipal?: string;
  aniversarioEmpresa?: string; redesSociais?: string; usuarioCriador?: string; createdAt: string;
}
type Fornecedor = Cliente; // Mesma estrutura, "compradores" = vendedores do fornecedor

// PRODUTOS
type TipoRolete = 'RC' | 'RR' | 'RG' | 'RI' | 'RRA';
interface Produto {
  id: string; codigo: string; codigoCliente?: string; nome: string; nomeCompleto?: string;
  tipo: TipoRolete | 'GENERICO'; medidas: string; descricao: string; miniDescricao?: string;
  valor: number; tempo_fabricacao_minutos?: number; createdAt: string;
}

// ORÇAMENTOS
type StatusOrcamento = 'RASCUNHO' | 'ENVIADO' | 'AGUARDANDO' | 'APROVADO' | 'REPROVADO';
type TipoFrete = 'CIF' | 'FOB';

interface ItemOrcamento {
  id: string; tipoRolete: TipoRolete; quantidade: number;
  diametroTubo: number; paredeTubo: number; comprimentoTubo: number;
  comprimentoEixo: number; diametroEixo: number; tipoEncaixe: string;
  medidaFresado: string; conjunto: string; tipoRevestimento: string;
  especificacaoRevestimento: string; quantidadeAneis: number;
  custo: number; multiplicador: number; desconto: number;
  valorPorPeca: number; valorTotal: number;
  ncm?: string; codigoExterno?: string; codigoProduto?: string;
  aliqPIS?: number; aliqCOFINS?: number; aliqICMS?: number; aliqIPI?: number;
  valorPIS?: number; valorCOFINS?: number; valorICMS?: number; valorIPI?: number;
}

interface ItemProdutoOrcamento {
  id: string; produtoId: string; produtoNome: string;
  quantidade: number; valorUnitario: number; valorTotal: number;
  ncm?: string; medidas?: string; descricao?: string;
  aliqPIS/COFINS/ICMS/IPI e valores correspondentes;
}

interface Orcamento {
  id: string; numero: string; clienteId: string; clienteNome: string;
  compradorNome?: string; tipoFrete: TipoFrete; condicaoPagamento: string;
  vendedor: string; dataOrcamento: string; previsaoEntrega: string;
  observacao: string; prazoPagamento?: string; dataEntrega: string;
  itensRolete: ItemOrcamento[]; itensProduto: ItemProdutoOrcamento[];
  status: StatusOrcamento; empresaEmissoraId: string; valorTotal: number;
  data_entrega_prevista?: string; ultima_interacao?: string;
  createdAt: string; dataAprovacao?: string;
}

// PEDIDOS
type StatusPedido = 'PENDENTE' | 'CONFIRMADO' | 'EM_PRODUCAO' | 'CONCLUIDO' | 'ENTREGUE';
interface Pedido {
  id: string; numero: string; orcamentoId: string; orcamentoNumero?: string;
  clienteNome: string; dataEntrega: string; status: StatusPedido;
  valorTotal: number; createdAt: string;
  motivoCancelamento?: string; dataCancelamento?: string;
  statusHistory?: { status: string; date: string }[];
}

// PRODUÇÃO (O.S.)
type StatusOS = 'ABERTA' | 'EM_ANDAMENTO' | 'CONCLUIDA';
interface ItemOS {
  item: number; quantidade: number; tipo: TipoRolete;
  diametroTubo/paredeTubo/comprimentoTubo/comprimentoEixo/diametroEixo: number;
  encaixeFresado: string; comprimentoFresado: number; medidaAbaFresado: string;
  tipoEncaixe: string; roscaIE: string; furoEixo: string; revestimento: string;
  corte: boolean; torno: boolean; fresa: boolean; solda: boolean; pintura: boolean; montagem: boolean;
}
interface OrdemServico {
  id: string; numero: string; pedidoId: string; empresa: string; pedidoNumero: string;
  emissao: string; entrega: string; entradaProducao: string; diasPropostos: number;
  status: StatusOS; itens: ItemOS[]; createdAt: string;
  statusHistory?: { status: string; date: string }[];
}

// ESTOQUE
interface ItemEstoque {
  id: string; nome: string; categoria: string; quantidade: number; unidade: string;
  metragem?: number; nivelCritico: number; imagem?: string; createdAt: string;
}

// USUÁRIOS
type NivelAcesso = 'master' | 'admin' | 'SEO' | 'Administrador' | 'Vendas' | 'Estoque' | 'Produção';
type Genero = 'M' | 'F';
type PermissaoModulo = 'inicio' | 'custos' | 'clientes' | 'produtos' | 'orcamentos' | 'pedidos' | 'producao' | 'estoque' | 'chat' | 'usuarios' | 'ia';
interface PermissoesUsuario { ver: PermissaoModulo[]; editar: PermissaoModulo[]; }
interface Usuario { id: string; nome: string; email: string; telefone?: string; whatsapp?: string; login: string; senha: string; nivel: NivelAcesso; genero?: Genero; ativo: boolean; foto?: string; permissoes?: PermissoesUsuario; createdAt: string; }

// NOTIFICAÇÕES
interface Notificacao { id: string; tipo: 'aniversario' | 'pedido' | 'producao' | 'chat'; titulo: string; mensagem: string; lida: boolean; createdAt: string; }

// META
interface MetaVendedor { vendedor: string; metaMensal: number; }
```

---

## ARQUITETURA DE DADOS (store.ts)

O `store.ts` atua como camada de persistência local com localStorage, emitindo eventos `rp-store-save` a cada escrita para que o hook `useDataSync` sincronize com o banco.

### Chaves localStorage:
- `rp_tubos`, `rp_eixos`, `rp_conjuntos`, `rp_revestimentos`, `rp_encaixes` → Custos (seed data incluído)
- `rp_clientes`, `rp_fornecedores` → Clientes e Revendas
- `rp_produtos` → Produtos
- `rp_orcamentos`, `rp_pedidos`, `rp_os` → Documentos
- `rp_estoque` → Estoque
- `rp_metas` → Metas de vendedores
- `rp_notificacoes` → Notificações
- `rp_empresas` → Empresas emissoras (Rollerport + Ferreira Roletes)
- `rp_logged_user`, `rp_session_token` → Sessão do usuário

### Funções auxiliares:
- `store.nextId(prefix)` → Gera IDs incrementais (ex: `cli_1001`)
- `store.nextNumero(prefix)` → Gera números formatados (ex: `0826/2026`)

### Dados Seed Iniciais:
- 29 tubos com diâmetros de 50 a 165mm
- 18 eixos (15mm a 80mm + INOX)
- 116 conjuntos (ex: 50X15-1, 102X20-1 NYLON...)
- 19 revestimentos (10 Spiraflex AZ/LA + 9 Anéis ABI)
- 6 encaixes (LPW, Barber Greene, Faço, Rosca Externa/Interna, Furo no Eixo)
- 2 clientes exemplo (Polimix, Votorantim)
- 5 produtos rolete base (RC, RR, RG, RI, RRA)
- 2 empresas emissoras (Rollerport CNPJ 58.234.180/0001-56, Ferreira Roletes CNPJ 10.311.350/0001-22)

---

## SINCRONIZAÇÃO BIDIRECIONAL (useDataSync.ts)

Hook montado UMA vez no App.tsx que:

1. **Initial sync:** Para cada tabela, verifica se DB tem dados → puxa para localStorage. Se DB vazio e localStorage tem dados → empurra para DB (migração inicial).
2. **Store save → Push:** Escuta eventos `rp-store-save`, faz upsert no Supabase via padrão JSON blob. NUNCA empurra arrays vazios (proteção contra apagamento acidental).
3. **Realtime → Pull:** Escuta mudanças Realtime nas tabelas, puxa do DB e atualiza localStorage, emitindo `rp-data-synced`.
4. **Supressão de eco:** Ao fazer push, suprime pull por 2 segundos para evitar loops.

Tabelas sincronizadas: orcamentos, pedidos, ordens_servico, clientes, fornecedores, produtos, estoque, metas_vendedores.

**IMPORTANTE:** A tabela `usuarios` NÃO é sincronizada via este hook (gerenciada pelas Edge Functions).

---

## EDGE FUNCTIONS

### 1. hash-password/index.ts
- **login:** Busca usuário por login (case-insensitive), verifica senha (suporta bcrypt legado → migra para texto plano), cria sessão (token UUID, 24h), atualiza last_seen.
- **logout:** Deleta sessão pelo token, atualiza last_seen.
- **hash/verify:** Operações de hash bcrypt (legado).

### 2. chat-api/index.ts
- Todas as ações requerem `sessionToken` válido.
- **send_message:** Insere mensagem com sender_id = userId autenticado (anti-spoofing).
- **delete_message:** Marca como deleted_for_sender ou deleted_for_all (só remetente pode apagar para todos).
- **validate_session:** Valida token e atualiza last_seen.
- **heartbeat:** Atualiza last_seen.
- **upload_file:** Upload para storage `chat-files`, forçando pasta do userId.
- **get_signed_url:** Gera URL assinada (1h) para arquivos no storage.

### 3. user-api/index.ts
- Todas as ações requerem sessionToken + nível master.
- **save_user:** Cria/atualiza usuário. Senha de comuns: numérica até 8 dígitos. Master: qualquer senha.
- **delete_user:** Deleta (exceto master).
- **get_user_credentials:** Retorna senha em texto plano ou "••••••••" se bcrypt.
- **generate_temp_password:** Gera senha aleatória de 8 dígitos.

### 4. password-recovery/index.ts
- **request_reset:** Busca usuário por login/email/whatsapp, gera código 6 dígitos, salva em tabela `password_resets`, simula envio via WhatsApp.
- **verify_code:** Valida código não usado e não expirado (10 min).
- **reset_password:** Altera senha do usuário para texto plano.

---

## MÓDULOS E TELAS

### 1. Login (LoginPage.tsx)
- Campos: login (nome/email/número) + senha
- Botão "Esqueci minha senha" → Modal com 3 etapas: solicitar código → validar código → nova senha
- Após login bem-sucedido: salva userId e sessionToken no localStorage

### 2. Layout (AppLayout.tsx)
- Sidebar lateral colapsável com logo ROLLERPORT
- Itens de navegação filtrados por permissões do usuário
- Bate-Papo abre como widget flutuante (não navega para /chat)
- Header com: botão forçar sincronização, sino de notificações (auto-fecha em 5s), avatar do usuário, logout
- Notificações: aniversários de empresas/compradores (3 dias antes), pedidos, produção, chat
- Presença em tempo real via Supabase Presence

### 3. Dashboard (DashboardPage.tsx) - ~1015 linhas
- **Cards de resumo:** Orçamentos (rascunho/pendente/aprovado/cancelado), Pedidos (pendente/confirmado/produção/concluído/entregue), Clientes (total), O.S. (aberta/em andamento/concluída)
- **Semáforo (Traffic Light):** Cada documento tem cor baseada em dias sem interação (verde <2d, amarelo 2-5d, vermelho >5d) e atraso na entrega
- **Cards de vendedores:** Foto, status online (Supabase Presence), meta mensal editável pelo Master, barra de progresso, total vendido
- **Relatórios:** Relatório por vendedor (com calendário interativo e análise IA), relatório comercial geral, taxa de conversão
- **Master pode:** Editar metas, excluir orçamentos/pedidos do dashboard, ver relatórios de todos, configurar prompt da IA
- **Vendedor vê:** Apenas seus próprios dados

### 4. Custos (CustosPage.tsx) - ~467 linhas
- 6 abas: Tubos, Eixos, Conjuntos, Revest. Spiraflex, Revest. Anéis, Encaixes
- CRUD inline com edição por linha
- Upload de imagens por item (base64)
- Exportar/Importar Excel (xlsx)
- Exportar modelo vazio
- "Excluir Tudo" por aba
- Dados salvos em tabelas flat no Supabase (custos_tubos, etc.)

### 5. Clientes & Revendas (ClientesPage.tsx) - ~479 linhas
- Toggle Clientes/Revendas (mesma estrutura, labels dinâmicos)
- Consulta automática CNPJ via API (publica.cnpj.ws + BrasilAPI fallback)
- Múltiplos compradores/vendedores por empresa
- Campos: nome, CNPJ, IE, IM, email, telefone, WhatsApp, endereço completo, regime tributário, aniversário empresa, redes sociais
- Formatação automática de CNPJ/CPF e telefone
- Importação CSV/TSV e exportação CSV (master only)
- Filtro por vendedor (via URL param)

### 6. Produtos (ProdutosPage.tsx) - ~213 linhas
- Dois tipos: Roletes (tipo RC/RR/RG/RI/RRA, valor=0 calculado no orçamento) e Produtos Genéricos (valor fixo)
- Campos rolete: código interno, código cliente, nome, nome completo, tipo, mini descrição, NCM
- Campos produto: código, nome, medidas, descrição, valor, NCM, impostos (PIS/COFINS/IPI/ICMS/ICMS-ST)

### 7. Orçamentos (OrcamentosPage.tsx) - ~2057 linhas (MAIOR MÓDULO)
- **Listagem:** Filtro por texto, cards com status
- **Formulário completo:**
  - Seleção cliente/revenda com busca + cadastro rápido (modal completo)
  - Seleção empresa emissora (Rollerport ou Ferreira Roletes)
  - Campos: vendedor, condição pagamento, prazo, tipo frete, previsão entrega, observação
  - Histórico de orçamentos do cliente selecionado com botão "Clonar" (recalcula preços atuais)
  - Cadastro rápido de comprador e produto (inline)
  - **Itens rolete:** Formulário técnico com selects dinâmicos (diâmetros/paredes/eixos do módulo Custos), cálculo automático de custo (aproveitamento de barra 6000mm), multiplicador (default 1.8), desconto %
  - **Itens produto:** Busca no catálogo, NCM, desconto
  - **Motor fiscal:** Alíquotas PIS/COFINS/ICMS calculadas com base no regime tributário da empresa emissora e do cliente, e UF de destino (tabela ICMS interestadual)
  - Auto-save draft a cada 10 segundos + localStorage
- **Impressão (landscape):** Layout profissional com header da empresa, dados do cliente, tabela de itens com impostos destacados, QR code, dados bancários (PIX/boleto/cheque), informações complementares (5 cláusulas legais), seção técnica editável
- **Seção técnica:** Lista de especificações editáveis (NBR, materiais, garantia, pintura), com highlight automático de cores mencionadas no texto
- **Ações:** Salvar rascunho, finalizar, duplicar com preços atualizados, enviar por email, converter em pedido, excluir

### 8. Pedidos (PedidosPage.tsx) - ~622 linhas
- **Listagem:** Orçamentos pendentes (sem pedido) + Pedidos existentes
- Barra de progresso do status (PENDENTE 20% → CONFIRMADO 40% → EM_PRODUCAO 60% → CONCLUIDO 80% → ENTREGUE 100%)
- Contador de dias (total + no status atual)
- **Ações:** Ver, editar itens, imprimir, gerar O.S. (automático: cria O.S. com itens rolete), marcar concluído/entregue, cancelar (com motivo obrigatório → volta orçamento para rascunho), excluir
- **Visualização read-only:** Layout moderno com cards de info e tabela detalhada
- **Edição:** Permite alterar quantidades, valores unitários, tipos de itens

### 9. Produção (ProducaoPage.tsx) - ~452 linhas
- **Listagem:** O.S. com status, barra de progresso, dias
- **Etapas de produção por item:** Corte, Torno, Fresa (renomeado "MED. ENCAIXE" na impressão), Solda, Pintura, Montagem
- Checkboxes interativos na view (sem precisar entrar em modo edição)
- Status automático: ABERTA (nenhuma etapa), EM_ANDAMENTO (alguma), CONCLUIDA (todas)
- **Materiais utilizados:** Grid de 5x3 com categorias (tubo, eixo, caneca, rolamento, anéis, labirinto, anel elástico, revestimentos, bucha nylon, tinta, flanges, encaixes)
- **Impressão landscape:** Layout condensado com tabela técnica + etapas + materiais
- **Cancelamento:** Com motivo obrigatório, volta pedido para PENDENTE

### 10. Estoque (EstoquePage.tsx) - ~217 linhas
- Categorias: Tubo, Eixo, Caneca, Rolamento, Anéis de Borracha, Labirinto, Retentor, Anel Elástico, Revest. Spiraflex, Revest. Borracha Vulcanizada, Bucha Nylon, Tinta, Flanges, Engrenagens, Encaixe Faço, Porcas, Parafusos, Arruelas, Conjuntos, Encaixes, Outros
- Campos: nome, categoria, quantidade, unidade, metragem, nível crítico, imagem
- Destaque visual (bg vermelho) quando quantidade ≤ nível crítico
- Estoque padrão criado automaticamente na primeira visita

### 11. Bate-Papo (ChatPage.tsx + ChatWidget.tsx) - ~641 + ~419 linhas
- **ChatPage:** Tela cheia com lista de contatos
- **ChatWidget:** Popup flutuante arrastável (drag & drop), abre via sidebar
- Funcionalidades: texto, envio de arquivos (PDF, DOC, XLS, imagens, ZIP - max 10MB), gravação de áudio (WebM), playback de áudio inline
- Exclusão de mensagens: "para mim" ou "para todos"
- **Master:** Visualiza conversas entre quaisquer dois usuários, exporta histórico como TXT, vê mensagens deletadas
- Notificações toast com preview da mensagem e foto do remetente
- URLs assinadas para arquivos (1h de validade)
- Realtime via Supabase postgres_changes

### 12. Usuários (UsuariosPage.tsx) - ~461 linhas
- **Apenas Master** pode acessar
- Cards com foto, nome, login, senha (visível/oculta), nível, status online/offline
- CRUD completo: nome, email, telefone, WhatsApp, login, senha (numérica até 8 dígitos para comuns), setor, gênero, foto
- **Permissões granulares:** Grid módulo x ver/editar com checkboxes
- Ações: editar, excluir (exceto master), ativar/bloquear, ver senha, gerar senha temporária, deslogar remotamente, deslogar todos os comuns

### 13. VendorReportView (componente) - ~886 linhas
- Relatório detalhado por vendedor com filtro por mês/ano/dia
- **Calendário interativo:** Grid mensal com indicadores de atividade (O=Orçamento, P=Pedido, S=O.S.)
- Tabelas de orçamentos, pedidos e O.S. com tempo decorrido e motivo de cancelamento
- Clique em documento abre modal com detalhes completos (itens, valores, impostos)
- **Análise IA (streaming):** Envia relatório para Edge Function que usa modelo AI para avaliar desempenho, dar dicas motivacionais, sugerir clientes potenciais
- **Master pode:** Editar prompt de treinamento da IA, testar análise

---

## CÁLCULOS FISCAIS

### Custo do Rolete:
1. Tubo: `precoBarra6000mm / floor(6000 / comprimentoTubo)`
2. Eixo: `precoBarra6000mm / floor(6000 / comprimentoEixo)`
3. Conjunto + Encaixe (valores fixos)
4. Revestimento: Spiraflex = `valor/metro × comprimentoEixo/1000`, Anéis = `valor/peça × quantidadeAnéis`
5. **Custo total** = soma dos 4 componentes
6. **Valor de venda** = custo × multiplicador × (1 - desconto/100)

### Alíquotas:
- ICMS interestadual de SP: 18% (SP), 12% (MG/RJ/PR/SC/RS), 7% (demais estados)
- PIS: 0.65% (Lucro Presumido), 1.65% (Lucro Real), 0% (Simples Nacional)
- COFINS: 3.00% (Lucro Presumido), 7.60% (Lucro Real), 0% (Simples Nacional)
- IPI: Por item (default 0%)
- Impostos são "por dentro" (já inclusos no valor de venda)

---

## FORMATADORES (formatters.ts)

- `formatCPForCNPJ(value)` → Auto-detecta CPF (xxx.xxx.xxx-xx) ou CNPJ (xx.xxx.xxx/xxxx-xx)
- `formatTelefone(value)` → (xx) xxxx-xxxx ou (xx) xxxxx-xxxx
- `formatDateBR(dateStr)` → dd/mm/yyyy
- Validadores: `isValidCPF`, `isValidCNPJ`

---

## CONSULTA CNPJ (utils.ts)

1. Tenta `publica.cnpj.ws/cnpj/{cnpj}` (retorna razão social, endereço, IE, IM, telefones, email, simples nacional, situação cadastral)
2. Fallback: `brasilapi.com.br/api/cnpj/v1/{cnpj}`
3. Preenche automaticamente campos vazios do formulário
4. Toast de alerta se situação cadastral ≠ ATIVA

---

## PRESENÇA ONLINE (usePresence.ts)

Usa Supabase Realtime Presence:
- Canal: `online-users`
- Cada usuário logado faz `channel.track()` com seu ID
- `presenceState()` retorna todos os IDs online
- Indicador visual: bolinha verde animada (online) ou cinza (offline) nos cards de vendedores e contatos do chat

---

## EMPRESAS EMISSORAS

O sistema tem 2 empresas emissoras para os orçamentos:

1. **ROLLERPORT** (Simples Nacional)
   - Razão Social: ROLLERPORT INDUSTRIA, COMERCIO SERVIÇOS DE ROLETES LTDA
   - CNPJ: 58.234.180/0001-56
   - IE: 312.259.169.119
   - Endereço: Rua João Marcos Pimenta Rocha, 16 - Polo Industrial, Franco da Rocha/SP, 07832-460
   - Tel: 11 4441-3572 / 11 4811-1588
   - Email: faturamento@rollerport.com.br

2. **FERREIRA ROLETES** (Lucro Presumido)
   - Razão Social: FERREIRA ROLETES, INDÚSTRIA COMERCIO E SERVIÇO LTDA
   - CNPJ: 10.311.350/0001-22
   - IE: 312.034.593.110
   - Mesmo endereço
   - Email: contato@ferreiraroletes.com.br

---

## NUMERAÇÃO AUTOMÁTICA

- Orçamentos: Sequencial por ano, inicia em 826/2026 (ex: 0826/2026, 0827/2026...)
- Pedidos: Sequencial por ano (0001/2026...)
- O.S.: Sequencial por ano
- IDs internos: Prefixo + contador incremental (cli_1001, ped_1002...)

---

## COMPORTAMENTOS ESPECIAIS

1. **Proteção contra apagamento:** O sync NUNCA empurra arrays vazios para o DB
2. **Heartbeat:** A cada 60s, atualiza `last_seen` via Edge Function
3. **Logout on close:** `navigator.sendBeacon` no `beforeunload` envia logout
4. **Draft auto-save:** Orçamento em edição salva draft no localStorage a cada mudança + intervalo de 10s
5. **Migração de formatação:** Na primeira execução, formata CNPJs e telefones de todos os clientes/orçamentos
6. **Dashboard direto do DB:** O Dashboard busca dados diretamente do Supabase (não do localStorage) para evitar race conditions
7. **Botão forçar sync:** Limpa todos os caches localStorage e recarrega a página
8. **Sessão 24h:** Token de sessão expira em 24 horas. Sessões expiradas são limpas no login.

---

## ASSETS

- `src/assets/logo.png` → Logo Rollerport (usado no login, sidebar, impressões)
- `src/assets/logo-ferreira.jpg` → Logo Ferreira Roletes (usado na impressão quando empresa emissora = Ferreira)
- `src/assets/qrcode-rollerport.jpeg` → QR Code para impressão de orçamentos

---

## INSTRUÇÕES FINAIS

1. Implemente módulo por módulo, começando pelo schema do banco, depois autenticação, depois layout, depois cada tela.
2. Use shadcn/ui para todos os componentes de UI (Button, Input, Dialog, Table, Card, Badge, Progress, Avatar, Skeleton, etc.).
3. Mantenha a separação: `store.ts` para localStorage, `useDataSync.ts` para sync, `useCustos.ts` para custos (tabelas flat), `useUsuarios.ts` para usuários (via Edge Functions).
4. Todas as operações de escrita em `usuarios` e `chat_messages` DEVEM passar por Edge Functions (nunca pelo cliente diretamente).
5. O sistema é 100% em português do Brasil.
6. A impressão deve ser otimizada com `@media print` e classe `print:hidden`.
7. O chat widget deve ser arrastável e não obstruir conteúdo.
8. Permissões: Master vê tudo. Outros veem apenas o que suas permissões permitem. A sidebar filtra itens, e as páginas filtram dados por vendedor quando aplicável.
