## Plano de Responsividade por Dispositivo

### Regra Principal
- **Desktop/Notebook (≥1024px):** NÃO TOCAR em nada. Layout, fontes, colunas, menu lateral — tudo permanece idêntico ao atual.
- **Tablet/Celular (<1024px):** Adaptar a interface para parecer um App fluido sem alterar design, cores ou componentes.

---

### 1. Base CSS Global
- [ ] Adicionar `overflow-x: hidden` no body apenas para `<1024px`
- [ ] Adicionar `hyphens: none; word-break: keep-all` para evitar quebra de palavras
- [ ] Todas as regras mobile usam `@media (max-width: 1023px)` exclusivamente

### 2. Tabelas de Dados
- [ ] Envolver tabelas em container com `overflow-x: auto` em `<1024px`
- [ ] Tabelas de impressão/orçamento: rolagem horizontal interna sem mover cabeçalho/página
- [ ] Aplicar em: Orçamentos, Pedidos, Custos, Produção, Estoque

### 3. Logos e Cabeçalhos (Impressão/Orçamento)
- [ ] Redimensionar logos proporcionalmente em `<1024px`
- [ ] Centralizar informações da empresa dentro das margens mobile

### 4. Botões em Excesso
- [ ] Em `<1024px`, grupos de botões em container com `overflow-x: auto; white-space: nowrap`
- [ ] Scroll lateral em vez de empilhar verticalmente
- [ ] Tamanho de toque mínimo 44px mantido

### 5. Páginas Específicas
- [ ] DashboardPage: Grids empilham em mobile, intactos em desktop
- [ ] ClientesPage: Modais 95vw em mobile, fixos em desktop
- [ ] ProdutosPage: Tabela com scroll horizontal mobile
- [ ] OrcamentosPage: Scroll horizontal nas tabelas de impostos
- [ ] PedidosPage: Colunas secundárias ocultas em mobile
- [ ] CustosPage, ProducaoPage, EstoquePage: Scroll horizontal
- [ ] AgendaPage/CRM: Calendário e formulários adaptados

### 6. Menu Lateral (AppLayout)
- [ ] ≥1024px: Menu lateral fixo, sem alteração
- [ ] <1024px: Menu via Sheet (já implementado), sem overflow

### 7. Validação
- [ ] Testar viewport 1920px — zero mudanças visuais
- [ ] Testar viewport 768px (tablet) — acessível, sem overflow
- [ ] Testar viewport 375px (iPhone) — app fluido
