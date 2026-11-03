# MenteExperta

Landing page premium e corporativa da **MenteExperta**, com venda dos ebooks
**Como Fazer 50K Antes de 2027** (edição Beta e Premium), pagamento por
**PIX** (Brasil e restantes países) e por **carteira móvel** e-Mola ou M-Pesa
(Moçambique), painel de administração, entrega automática do PDF e registo de
visitas.

Construída com React 19, TanStack Start (SSR), Tailwind CSS 4 e Supabase.

## Stack

- **React 19** + **TanStack Router / Start** (SSR + server functions)
- **Vite 8** + **Nitro** (build do servidor)
- **Tailwind CSS 4** + componentes Radix UI
- **Supabase** (Postgres + Storage) para produtos, pedidos, visitas e PDFs
- **InfiniGate** para PIX automático
- **Vitest** para testes

## Funcionalidades

### Site público (`/`)

- Hero, manifesto, produtos, depoimentos, "Quem somos" e contactos.
- **Moeda por região**: se o visitante vier de **Moçambique** o título do hero
  mostra **50K/MT** e os preços mantêm o mesmo valor mas mostram **MT**; qualquer
  outro país mostra **R$**.
- Widget de apoio com IA (TokenHarbor), independente do tema escuro. As conversas
  ficam guardadas e podem ser respondidas por um humano no painel.

### Checkout (`/checkout?edition=beta|premium`)

- **Moçambique** → ecrã de pagamento por **carteira móvel** em 2 passos:
  1. escolha da carteira de destino (**e-Mola** ou **M-Pesa** — os números são
     editáveis em `/admin > Pagamentos`), número de origem e **mensagem de
     confirmação** da transferência;
  2. pedido do **WhatsApp ou e-mail** de entrega.
     No fim, informa que a entrega acontece **após verificação da equipa**.
- **Brasil / outros países** → PIX através da InfiniGate: o cliente informa
  nome, e-mail e CPF, recebe o **QR Code + copia-e-cola** e a página verifica o
  pagamento sozinha. Assim que o webhook confirma, o **PDF é entregue
  automaticamente** na mesma página.

### Painel (`/admin`)

Protegido por **e-mail + palavra-passe** (env `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
e por um cookie de sessão `HttpOnly` assinado com HMAC (12 h).

- **Visão geral**: número de vendas confirmadas, dinheiro faturado (R$ e MT),
  visitas ao site (total / 7 dias / hoje), pedidos a tratar e vendas por produto.
- **Produtos e PDFs**: editar o preço de cada edição e carregar/substituir o PDF
  que é entregue ao comprador (upload direto para o Supabase Storage).
- **Pagamentos**: números, titular e nota das carteiras móveis (**e-Mola** e
  **M-Pesa**) usados no checkout de Moçambique. As alterações ficam visíveis no
  site de imediato e cada carteira pode ser ativada ou desativada.
- **Pedidos**: lista dos pedidos de Moçambique (carteira de destino, número de
  origem, contacto de entrega e mensagem de confirmação) e dos pedidos PIX, com
  ações para confirmar pagamento, marcar como entregue ou cancelar.
- **Mensagens**: todas as conversas do chat de apoio (visitante, respostas da IA
  e pedidos de humano), com **atualização automática a cada 5 s** — não é preciso
  recarregar. O administrador escreve a resposta e esta aparece automaticamente
  no chat do visitante, com aviso de novas mensagens. No topo há um diagnóstico
  da ligação (base de dados, tipo de chave, nº de mensagens e **teste de
  ligação**) para identificar problemas de imediato.
- **Visitas**: totais, países mais frequentes e registo recente.

## Requisitos

- Node.js **>= 22.12** (definido em `engines`)
- npm
- Conta Supabase e conta InfiniGate para os fluxos automáticos

## Configuração

1. Copie o ficheiro de exemplo e preencha os valores:

   ```sh
   cp .env.example .env
   ```

   Todas as variáveis estão documentadas em `.env.example`. Resumo:

   | Variável                         | Para que serve                              |
   | -------------------------------- | ------------------------------------------- |
   | `TOKENHARBOR_API_KEY`            | Chat de apoio com IA                        |
   | `TOKENHARBOR_BASE_URL`           | Endpoint do TokenHarbor (predefinido)       |
   | `TOKENHARBOR_MODEL`              | Modelo usado pelo chat (predefinido)        |
   | `SUPABASE_URL`                   | URL do projeto Supabase                     |
   | `SUPABASE_SERVICE_ROLE_KEY`      | Chave `service_role` (servidor apenas)      |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Credenciais de entrada em `/admin`          |
   | `ADMIN_SESSION_SECRET`           | Segredo para assinar o cookie de sessão     |
   | `INFINIGATE_DEPOSIT_KEY`         | Criação de cobranças PIX                    |
   | `INFINIGATE_WEBHOOK_KEY`         | Verificação da assinatura dos webhooks      |
   | `INFINIGATE_BASE_URL`            | `https://api.infini-gate.com` (predefinido) |
   | `EMOLA_NUMBER` / `EMOLA_HOLDER`  | Número e titular e-Mola (fallback)          |
   | `MPESA_NUMBER` / `MPESA_HOLDER`  | Número e titular M-Pesa (fallback)          |
   | `PUBLIC_BASE_URL`                | URL pública usada nos webhooks              |

2. **Base de dados**: abra o **SQL Editor** do Supabase, cole todo o conteúdo de
   [`supabase/schema.sql`](supabase/schema.sql) e clique em **RUN**.
   O script é idempotente e cria:
   - `public.products`, `public.orders`, `public.site_visits`,
     `public.support_messages`, `public.payment_methods`;
   - o bucket **privado** `ebooks` (onde ficam os PDFs);
   - os produtos iniciais (Beta `19,90` / Premium `399,89`) e as carteiras
     móveis **e-Mola** e **M-Pesa**.

   > Se já tinha executado uma versão anterior do script, volte a executá-lo
   > para criar as tabelas `support_messages` e `payment_methods` e para reparar
   > colunas em falta na tabela do chat. O script não apaga dados existentes.

   > **Importante**: `SUPABASE_SERVICE_ROLE_KEY` tem de ser a chave
   > **service_role** (não a `anon`). O RLS está ligado e sem essa chave o chat
   > de apoio não guarda mensagens. O painel > Mensagens mostra qual está em uso.

3. **Storage**: confirme em **Storage** que o bucket `ebooks` existe e está
   privado. Não crie políticas públicas — o servidor usa a `service_role`.

4. **Webhook da InfiniGate**: no painel da InfiniGate, em _Webhooks & APIs_,
   configure a URL de notificação de depósito para:

   ```
   https://SEU_DOMINIO/api/webhooks/infinigate
   ```

   A mesma URL é também enviada no campo `webhookUrl` de cada cobrança, por isso
   funciona mesmo sem configuração no painel. A assinatura
   (`X-InfiniGate-Signature`) é validada com `INFINIGATE_WEBHOOK_KEY`.

## Desenvolvimento

```sh
npm install
npm run dev
```

O servidor arranca em `http://localhost:8080` (ou na porta definida em `PORT`).
A app escuta em `0.0.0.0`, por isso funciona diretamente no preview do Replit.

| Script              | O que faz                                         |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento (Vite + SSR)          |
| `npm run build`     | Build de produção para Node (`.output/`)          |
| `npm start`         | Serve o build de produção (`node .output/server`) |
| `npm run preview`   | Pré-visualização do Vite                          |
| `npm run typecheck` | Verificação de tipos TypeScript                   |
| `npm run lint`      | ESLint + Prettier                                 |
| `npm run format`    | Formata o código com Prettier                     |
| `npm test`          | Testes com Vitest                                 |

## Deploy

O destino do build do Nitro é escolhido automaticamente:

- **Vercel** (deteta `VERCEL=1`) → preset `vercel`, gera `.vercel/output`.
- **Replit / qualquer host Node** → preset `node-server`, gera
  `.output/server/index.mjs`.

### Vercel

1. Importe o repositório na Vercel.
2. Configure as variáveis de ambiente (as mesmas de `.env.example`).
   Em especial `PUBLIC_BASE_URL=https://SEU_DOMINIO`.
3. Não é preciso mais nada: `vercel.json` define `installCommand`/`buildCommand`.

> **Atenção (Replit → Vercel)**: o Replit instala pacotes através de um proxy
> interno (`package-firewall.replit.internal`). Se o `package-lock.json` for
> gerado ou atualizado lá, a Vercel não consegue instalar e o build falha com
> `ENOTFOUND package-firewall.replit.internal`.
>
> Antes de fazer commit/push, corre:
>
> ```sh
> npm run fix:lockfile
> ```
>
> O script troca apenas o prefixo dos URLs para o registry público
> (`https://registry.npmjs.org/`); versões e hashes de integridade não mudam.

### Replit

O ficheiro `.replit` já está configurado (`run = "npm run dev"`, porta `8080`).
Adicione as variáveis em **Secrets** (ou no `.env`) e carregue em **Run**.

## Estrutura

```
supabase/schema.sql             SQL para executar no Supabase
src/
  lib/api.ts                    Server functions (público + admin)
  lib/catalog.server.ts         Acesso ao Supabase (produtos, carteiras, pedidos, visitas, chat)
  lib/infinigate.server.ts      PIX: criação de cobrança + verificação de webhook
  lib/emola.server.ts           Carteiras móveis MZ (e-Mola, M-Pesa): valores de recurso
  lib/region.server.ts          Deteção de país/moeda
  lib/admin-auth.server.ts      Credenciais + cookie de sessão HMAC
  lib/webhook.server.ts         Endpoint do webhook da InfiniGate
  lib/supabase.server.ts        Cliente Supabase (service_role)
  routes/__root.tsx             Shell + registo de visitas
  routes/index.tsx              Landing page
  routes/checkout.tsx           Checkout (carteira móvel / PIX)
  routes/admin.tsx              Painel de administração
  server.ts                     Wrapper SSR + webhook
  start.ts                      Middleware (CSRF + erros)
  styles.css                    Tokens semânticos + estilos
```

> **Nota de segurança**: nenhum segredo é importado no topo de módulos usados
> pelo browser. Os módulos `*.server.ts` são sempre importados dinamicamente
> dentro dos handlers.

## Build with Lovable

Este projeto teve origem no [Lovable](https://lovable.dev/projects/bedf01a3-9a51-457c-bb2c-3e5666de91fa).
O repositório continua sincronizado com o editor; commits enviados para o branch
ligado aparecem lá automaticamente.
