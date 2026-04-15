# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DO Crypto** — a high-end crypto banking MVP for Daniel & Onur. Runs exclusively on Ethereum testnets (Sepolia / Base Sepolia). The product must look and feel production-grade despite being testnet-only.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15.3.1 (App Router, pinned) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS **v3** + `tailwind.config.ts` + Lucide Icons |
| Animations | Framer Motion |
| Auth & DB | Supabase (PostgreSQL + Supabase Auth) |
| Web3 | Wagmi v3 + Viem + ConnectKit |
| Hosting | Vercel |

## Critical Environment Notes

**DO NOT** run `npm install` or `npm run build` without first unsetting `__NEXT_PRIVATE_STANDALONE_CONFIG`:

```bash
# Required for any build or dev server start:
env -u __NEXT_PRIVATE_STANDALONE_CONFIG npm run dev
env -u __NEXT_PRIVATE_STANDALONE_CONFIG npm run build
```

This variable bleeds in from another project (CodeGPT) running on the same machine and causes `generate is not a function` during Next.js build.

**Also**: `NODE_ENV=production` is set globally on this machine. This causes npm to skip devDependencies. Use `NODE_ENV=development npm install` if packages are missing.

## Development Commands

```bash
# Dev server (must unset env var)
env -u __NEXT_PRIVATE_STANDALONE_CONFIG npm run dev

# Production build
env -u __NEXT_PRIVATE_STANDALONE_CONFIG npm run build

# If devDependencies are missing (tailwindcss, typescript, etc.)
NODE_ENV=development npm install

npm run lint
npm run type-check   # tsc --noEmit
```

## Design System

Defined in `tailwind.config.ts` (Tailwind v3). Never use raw hex values in components — always use the semantic token names:

| Token | Hex | Usage |
|---|---|---|
| `background` | `#020617` | Page background (Deep Space Blue) |
| `card` / `popover` | `#0F172A` | Cards, modals (Midnight Navy) |
| `primary` | `#22D3EE` | CTAs, active states (Electric Cyan) |
| `secondary` | `#6366F1` | Accent, staking (Royal Indigo) |
| `success` | `#10B981` | Satoshi-Test validation (Satoshi-Green) |
| `foreground` | `#F8FAFC` | Body text (Ghost White) |

**Glass effect pattern** — reuse this class combination for cards and the login modal:
```
glass   (defined as @layer utilities in globals.css)
```
which expands to: `bg-white/4 backdrop-blur-[16px] border border-white/[0.08]`

## Architecture

### Web3 / SSR Constraint

Wagmi and ConnectKit use React hooks at module level → **cannot run server-side**. All Web3 providers are wrapped in `components/no-ssr.tsx` which renders `null` on the server and hydrates on the client. Do NOT remove the `NoSSR` wrapper around `<Providers>` in `app/layout.tsx`.

### Folder Structure

```
app/
  (auth)/           # Login page (unauthenticated route group)
  (dashboard)/      # All pages behind wallet-connect + Supabase auth
  layout.tsx        # Root layout — imports NoSSR + Providers
  not-found.tsx     # Custom 404 (prevents Pages Router doc error)
components/
  ui/               # Shadcn primitives + custom primitives
  dashboard/        # Bento-grid tiles, staking cards, transaction list
  auth/             # LoginCard (glassmorphism), WalletConnectButton
  no-ssr.tsx        # Client-only mount guard for Web3 providers
  providers.tsx     # WagmiProvider + QueryClientProvider + ConnectKitProvider
lib/
  supabase/         # client.ts (browser client), server.ts (server client), types.ts
  agents/           # agent_monitor.ts — placeholder for future AI transaction agents
  wagmi.ts          # Wagmi config (Sepolia + Base Sepolia chains ONLY)
middleware.ts       # Auth guard — redirects unauthenticated users to /login
```

### Route Architecture

- `/` — Public landing page
- `/(auth)/login` — Glassmorphism login card; Supabase Auth + ConnectKit
- `/(dashboard)/portfolio` — Bento-grid portfolio tiles (default dashboard)
- `/(dashboard)/satoshi-test` — Compliance verification UI
- `/(dashboard)/staking` — DeFi protocol list (mock APY data)
- `/(dashboard)/send` — Send testnet ETH form

## Database Schema (Supabase)

Four core tables — all protected by Row Level Security (RLS):

- **users** — mirrors `auth.users`, holds profile data
- **wallets** — linked to `users.id`; key column: `satoshi_status` (`pending` | `verified` | `failed`)
- **transactions** — on-chain tx records (hash, amount, status, chain_id)
- **staking_positions** — protocol name, APY snapshot, amount, start date

RLS rule pattern: `auth.uid() = user_id` on every table.

## Key Feature: Satoshi-Test (Compliance Flow)

1. User submits an external wallet address in the UI.
2. Backend generates a random micro-amount (e.g. 0.0001–0.0009 ETH).
3. User sends exactly that amount from the target wallet.
4. A server action / API route polls the RPC (via Viem `publicClient`) for an incoming tx matching the amount.
5. On match: `wallets.satoshi_status` → `verified` in Supabase.

## Web3 Configuration

- **Networks:** Sepolia (chain id 11155111) and Base Sepolia (chain id 84532) only — never mainnet.
- Missing optional peer deps in `@wagmi/connectors` (porto, coinbase-wallet, metamask, walletconnect, safe) are intentionally silenced via `webpack.resolve.fallback` in `next.config.ts`.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only, never exposed to client
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_ALCHEMY_API_KEY=
```
