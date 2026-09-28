# ADR 003 — Multi-tenancy e autorização

**Status:** aceito · **Data:** 2026-09-22 · **Fase:** 1

## Contexto

Cada produtor é um tenant com produtos, clientes e **dinheiro** próprios. Um vazamento entre tenants
aqui não é um bug de privacidade: é um bug financeiro.

## Decisão

Tenancy por coluna `organizationId` em banco compartilhado, com isolamento aplicado em camadas:

1. **Repositórios** recebem `organizationId` e filtram em toda leitura e escrita
   (`updateMany({ where: { id, organizationId } })` em vez de `update({ where: { id } })`).
2. **Resolução do tenant** (`resolveTenant`) confere o vínculo no banco. O `organizationId` vindo de
   cookie, formulário ou URL é uma preferência, nunca uma credencial.
3. **Autorização** é da Ripay, não do Keycloak: papéis (`OWNER`, `ADMIN`, `FINANCE`, `SUPPORT`,
   `MARKETING`, `VIEWER`) mapeiam para permissões, verificadas por `requireRole` /
   `requirePermission` em páginas e Server Actions.
4. **Referências cruzadas** são validadas: criar uma oferta exige que o produto seja da mesma
   organização; criar um checkout exige que a oferta seja.
5. O `proxy.ts` só faz checagem otimista de sessão — ele nunca autoriza.

Papel global `PLATFORM_ADMIN` dá acesso ao `/admin` e é reconferido no banco a cada requisição.

## Consequências

- Uma query sem filtro de tenant é uma falha de segurança; por isso o filtro vive no repositório, e
  não no service, e há testes dedicados de isolamento.
- Migrar para schema-por-tenant ou RLS no futuro continua possível, pois a coluna já existe.

## Alternativas consideradas

- **Schema/banco por tenant**: isolamento mais forte, custo operacional alto e migrations complexas
  para milhares de produtores.
- **Row Level Security no PostgreSQL**: defesa em profundidade interessante; ainda em aberto para
  uma fase futura, exigiria propagar o tenant na conexão.
