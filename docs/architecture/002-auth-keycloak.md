# ADR 002 — Identidade no Keycloak

**Status:** aceito · **Data:** 2026-09-22 · **Fase:** 1

## Contexto

A Ripay movimenta dinheiro de terceiros. Identidade precisa de senha forte, recuperação,
verificação de e-mail, MFA, login social e sessão auditável — e nada disso deveria ser reimplementado
dentro da aplicação.

## Decisão

Keycloak é o provedor de identidade (realm `ripay`, client confidencial `ripay-web`). A integração é
OIDC Authorization Code + PKCE (S256), implementada diretamente com `jose`, sem NextAuth, Auth.js,
Clerk, Supabase Auth ou Firebase Auth.

- `GET /api/auth/login`: gera `state`, `nonce` e `code_verifier`, guardados em cookie assinado de 10 min.
- `GET /api/auth/callback`: valida `state`, troca o code, verifica o ID token pelo JWKS (issuer e
  audience conferidos), confere o `nonce` e faz upsert do `User` por `keycloakUserId`.
- `POST /api/auth/logout`: limpa a sessão local e encerra a sessão no Keycloak com `id_token_hint`.
  É POST para não ser acionável por link/imagem de terceiros.

A sessão da Ripay é um JWT HS256 próprio em cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção,
com validade de 8 horas. A Ripay **nunca** armazena senha.

O papel de realm `platform_admin` é sincronizado no login para `User.platformRole`, mas quem decide
acesso é sempre a Ripay (ADR 003).

O URL público do Keycloak (issuer) e o interno (chamadas server-to-server) são separados
(`KEYCLOAK_URL` e `KEYCLOAK_INTERNAL_URL`), para o app funcionar dentro de container sem quebrar o issuer.

## Consequências

- Mais um serviço para operar, com seu próprio banco.
- MFA, login social e políticas de senha passam a ser configuração, não código.
- A integração é nossa: ganhamos controle e perdemos o "pronto" de uma biblioteca de auth.

## Alternativas consideradas

- **NextAuth/Auth.js**: rápido de começar, mas joga responsabilidade de identidade para dentro da
  aplicação e amarra a sessão ao framework.
- **Clerk/Auth0**: bom produto, custo por usuário e dependência de terceiro para algo central.
