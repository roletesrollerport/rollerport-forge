

## Plan: Refactor DashboardPage - Replace Relatórios Comerciais with User Cards Grid

### What Changes

1. **Remove "Relatórios Comerciais" section** (lines 658-702) - the table with orçamentos listing at the bottom.

2. **Move User Cards Grid to replace the removed section** - reposition the existing user cards grid (lines 704-719) to where the table was.

3. **Enhance each user card** with the requested content:
   - **Header**: Name + `Badge` component (Ativo/Inativo) from shadcn/ui
   - **Individual Stats**: Orçamentos count, Pedidos count, OS count per user ID
   - **Monthly Goal**: `Progress` bar showing percentage of monthly target
   - **Status Summary**: Small indicators for Rascunho, Aprovado, Em Produção counts linked to the user
   - **Footer Buttons**: Two `Button` components - `[Ver Relatório Completo]` (navigates to vendor-detail) and `[Imprimir Relatório]` (navigates to vendor-print)

4. **Permission logic** (already partially implemented):
   - **Master**: Sees grid of all users' cards
   - **Non-master**: Hides the users grid, shows only their own card directly below the "Taxa de Conversão" section

5. **Data connections**:
   - Use `useUsuarios` hook to fetch real user data from the database instead of `store.getUsuarios()`
   - Add OS count per user by filtering `data.os` by user association
   - Add per-user status breakdown (rascunho/aprovado/em produção) from existing `data.orcamentos` and `data.pedidos`

### Files Modified
- `src/pages/DashboardPage.tsx` - single file change

