# Cursor Migration - Desacoplamento Lovable e Setup Local

## O que é esta base de código
Este projeto é um app `Vite + React (TypeScript)` com `Tailwind/shadcn-ui`. O backend de APIs/negócio é feito com `Supabase Edge Functions` em `supabase/functions/*` (runtime Deno).

A parte de IA fica concentrada na edge function `chat`:
- arquivo: `supabase/functions/chat/index.ts`
- endpoint usado pela UI: `${VITE_SUPABASE_URL}/functions/v1/chat`

## Acoplamentos diretos ao Lovable (encontrados no código)
1. **Build do frontend**: `lovable-tagger`
   - `vite.config.ts` importa `componentTagger` de `lovable-tagger`
   - `package.json` declara `lovable-tagger` em `devDependencies`
2. **IA/chat no backend**: gateway remoto `ai.gateway.lovable.dev`
   - `supabase/functions/chat/index.ts` lê `LOVABLE_API_KEY`
   - `supabase/functions/chat/index.ts` faz `fetch` para `https://ai.gateway.lovable.dev/v1/chat/completions`
3. **Metadados/documentação e texto da UI**
   - `README.md` e `index.html` mencionam Lovable
   - `src/pages/IAPage.tsx` exibe “IA powered by Lovable”

## Objetivo do desacoplamento
- Remover dependência do Lovable (principalmente `ai.gateway.lovable.dev` e `LOVABLE_API_KEY`).
- Remover dependência do build (`lovable-tagger`).
- Manter o “contrato” de streaming que o frontend espera na rota `/ia` (SSE).

## Contrato de streaming que a UI espera (importante)
As páginas/components que consomem `/functions/v1/chat` fazem leitura de stream (SSE) procurando linhas:
- começam com `data: `
- contém JSON com o formato `choices[0].delta.content`
- encerra quando aparece `data: [DONE]`

Portanto, ao trocar o provedor de IA (ou implementar mock), preserve esse formato na resposta da edge function `chat`.

## Plano passo a passo

### 1) Preparar ambiente e segregar segredos
1. Crie/ajuste um arquivo local de env, preferencialmente `/.env.local` (e garanta que não será commitado).
2. Garanta que você tem:
   - Node.js + npm
   - Docker Desktop
   - Supabase CLI (para rodar Supabase localmente com Edge Functions)

### 2) Remover Lovable do build do frontend
1. Em `vite.config.ts`, remova:
   - `import { componentTagger } from "lovable-tagger";`
   - o uso do plugin `componentTagger()` em `plugins: [...]`
2. Em `package.json`, remova `lovable-tagger` de `devDependencies`.
3. Rode novamente a instalação de dependências:
   - `npm install`
   - (isso atualiza `package-lock.json` removendo a dependência)

Resultado esperado: build de Vite deixa de depender de `lovable-tagger`.

### 3) Remover gateway Lovable da IA (Supabase Edge Function)
1. No arquivo `supabase/functions/chat/index.ts`:
   - remova a leitura e validação de `LOVABLE_API_KEY`
   - remova o `fetch` para `https://ai.gateway.lovable.dev/v1/chat/completions`
2. Substitua o provedor por uma destas estratégias:
   - **Opção A (recomendada pelo que já existe no repo): Gemini**
     - use `GOOGLE_GENERATIVE_AI_API_KEY` (já existe em `.env`)
     - adapte o stream do Gemini para o formato OpenAI-like que a UI consome (`data: { choices: [{ delta: { content } }] }`)
   - **Opção B (para dev/offline): mock determinístico**
     - adicione `AI_PROVIDER=mock`
     - retorne uma resposta fixa ou baseada no prompt, sempre no mesmo formato de stream/SSE
   - **Opção C: OpenAI/compatíveis**
     - desde que você mapeie/normaliza o streaming para o formato `choices[0].delta.content`
3. Preserve o que **não** deve mudar:
   - validação da sessão (`sessions` + `usuarios`)
   - `corsHeaders`
   - streaming SSE com `data: ...` e `data: [DONE]`
4. Ajuste erros para manter experiência:
   - o frontend trata `429` e `402` com mensagens específicas.
   - se o provedor novo não gerar esses status, normalize para `429/402` na edge function ou ajuste o frontend para mensagens genéricas.

Resultado esperado: nenhuma chamada HTTP para `ai.gateway.lovable.dev` durante `/ia`.

### 4) Limpeza de referências visuais/documentais ao Lovable (opcional, mas recomendado)
1. Em `src/pages/IAPage.tsx`, troque “IA powered by Lovable” por algo genérico (“IA powered by <provedor>” ou “IA local”).
2. Atualize `README.md` e `index.html` para remover links/imagens do Lovable (não afeta runtime).
3. A pasta `/.lovable/` é artefato/documentação; pode ser removida após confirmar que não é usada por build/CI.

### 5) Rodar em desenvolvimento local
Passo a passo sugerido:
1. **Supabase local**
   - Suba o Supabase local com migrações e edge functions:
     - `supabase start`
     - `supabase db reset`
   - Confirme que as edge functions estão servindo (ex.: `.../functions/v1/chat`).
2. **Apontar o front para o Supabase local**
   - Em `/.env.local`, ajuste:
     - `VITE_SUPABASE_URL` -> tipicamente `http://localhost:54321`
     - `VITE_SUPABASE_PUBLISHABLE_KEY` -> anon key local
     - `VITE_SUPABASE_PROJECT_ID` -> idealmente compatível com o ambiente local
3. **Frontend**
   - `npm install`
   - `npm run dev` (por padrão este repo roda em `:8080`)
4. **Testar fluxos principais**
   - Abra `/ia`, faça login e envie uma pergunta.
   - Confirme streaming SSE funcionando e que não há chamadas ao gateway do Lovable.

## Checklist de validação rápida
1. Rotas carregam e login funciona.
2. `/ia`:
   - envia mensagem
   - faz streaming do texto (sem travar)
   - falhas por sessão expirada retornam `401` (ou erro equivalente)
3. Nenhuma requisição para `https://ai.gateway.lovable.dev/`.
4. `npm run dev` e build (`npm run build`) funcionam sem `lovable-tagger`.

## Observações
- O `.env` atual contém `GOOGLE_GENERATIVE_AI_API_KEY`. Após a troca do provedor, ele deve ser usado pelo novo backend (ou mova para `.env.local`).
- Evite commit de segredos (API keys, `SUPABASE_SERVICE_ROLE_KEY`, etc.).
