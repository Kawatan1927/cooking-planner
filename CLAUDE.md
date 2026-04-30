# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal cooking recipe / meal planning / shopping list management app. Frontend is a React SPA; backend is a single AWS Lambda (small monolith) behind API Gateway HTTP API; auth is Amazon Cognito; infra is managed with AWS CDK.

The source of truth for specifications is `docs/` — read the relevant files before implementing. If `docs/` and code conflict, `docs/` takes precedence. Spec changes may require updating `docs/*.md`.

## Workspace Structure

```
cooking-planner/
├── frontend/          # Vite + React + TypeScript SPA
├── infra/
│   ├── lambda/        # AWS Lambda handler (TypeScript, compiled separately)
│   └── lib/           # AWS CDK stack definition
└── docs/              # Specifications and Docusaurus site
```

All root-level scripts delegate to the appropriate sub-workspace via `bun run <prefix>:*`.

## Commands

All commands are run from the repo root unless noted.

### Development

```bash
npm run frontend:dev          # Vite dev server (http://localhost:5173)
npm run lambda:watch          # Watch-mode Lambda build

# Docs site (from docs/ only)
cd docs && bun run start
```

### Checks (run before committing / CI mirrors these)

```bash
npm run lint                  # ESLint for frontend + lambda + cdk
npm run format:check          # Prettier check for all workspaces
npm run type-check            # tsc for frontend + lambda (no emit)
npm run build:all             # Build frontend + lambda + cdk
npm run test                  # Placeholder — exits 0
```

### Per-workspace type-check / build

```bash
npm run frontend:type-check
npm run frontend:build        # Also runs tsc -b (type errors fail build)

npm run lambda:type-check
npm run lambda:build
npm run lambda:rebuild        # clean + build

npm run cdk:synth             # Generate CloudFormation template
```

### Formatting (auto-fix)

```bash
npm run frontend:format
npm run lambda:format
```

### CDK (from infra/)

```bash
npx cdk synth --context stage=dev
npx cdk diff  --context stage=prod
npx cdk deploy --context stage=prod \
  --context allowedOrigins=https://xxx.cloudfront.net \
  --context callbackUrls=https://xxx.cloudfront.net/callback \
  --context logoutUrls=https://xxx.cloudfront.net
```

## Architecture

### Frontend (`frontend/src/`)

- **Router**: `app/router.tsx` — React Router with routes for `/login`, `/callback`, `/recipes`, `/menus`, `/shopping-list`. Do not break the `/login` flow when adding routes.
- **Feature modules**: `features/<domain>/` — each domain owns its pages, components, hooks, API wrappers, and types. Add new features here, not in top-level `components/`.
- **API calls**: Always go through `lib/apiClient.ts` → `apiFetch()`, which handles `VITE_API_BASE_URL` and `Authorization: Bearer <token>`. Per-endpoint wrappers live in `features/<domain>/api/`.
- **Server state**: React Query custom hooks in `features/<domain>/hooks/`. Query keys use `recipesQueryKeys` patterns (keyed per user via JWT `sub`) to scope cache by user.
- **Auth**: Cognito Hosted UI, Authorization Code Grant + PKCE. `features/auth/utils/cognito.ts` handles URL generation and token exchange. The ID token is stored in `localStorage` (`cooking_planner_auth_token`). `useAuthToken` hook reads it.

### Lambda (`infra/lambda/src/`)

- **Entry**: `src/index.ts` — single handler, manual path/method routing.
- **Adding routes**: Match existing domain-split pattern. Route in `index.ts`, implement in `<domain>/`.
- **DynamoDB**: Use AWS SDK v3 via `shared/dynamodb.ts`. Table names come from env vars (`RECIPES_TABLE_NAME`, etc.). Always include `userId` as a key condition; `userId` is the DynamoDB partition key on all tables.
- **`userId` source**: Extract from Cognito JWT claims (`event.requestContext.authorizer.jwt.claims`). Use `sub` consistently.
- **Error responses**: Follow the shape in `docs/04-api-design.md` — `{ error: { code, message, details } }`.

### DynamoDB Table Keys

| Table | PK | SK |
|---|---|---|
| Recipes | `userId` | `recipeId` (UUID) |
| RecipeIngredients | `userId` | `recipeId#ingredientName` |
| Menus | `userId` | `date#mealType#menuId` |

### CDK Stack (`infra/lib/cooking-planner-stack.ts`)

- Single stack `CookingPlanner-{stage}`. Stage is passed as CDK context (`--context stage=dev|prod`).
- Resource naming convention: Construct IDs in `PascalCase`; AWS resource names in `kebab-case-{stage}`.
- `prod` stage enforces `allowedOrigins`, `callbackUrls`, and `logoutUrls` via context — omitting them throws at synth time (fail-closed).
- Lambda `NodejsFunction` points directly at `infra/lambda/src/index.ts`; CDK bundles it via esbuild.
- `prod` DynamoDB tables use `RemovalPolicy.RETAIN`; `dev` uses `DESTROY`.

## Code Conventions

**Both frontend and lambda:**
- Prettier: semicolons on, single quotes, 2-space indent, 100-char line length.
- TypeScript strict mode.

**Frontend env vars** (copy from `frontend/.env.example`):
- `VITE_API_BASE_URL` — API Gateway endpoint
- `VITE_COGNITO_DOMAIN`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_REDIRECT_URI` — required at runtime

## Git / PR Workflow

- Issues, PR titles/bodies, review comments, and commit messages should be written in **Japanese**.
- Issue title format: plain Japanese, no Conventional Commits prefix.
- Branch creation: `gh issue develop <Issue番号> --name <Issue番号>-<説明> --base main --checkout`
- PR body must follow `.github/PULL_REQUEST_TEMPLATE.md` and include `closes #N`.
- lefthook runs pre-commit (format + lint on staged files) and pre-push (build + test) automatically.

## Specification Documents

Before implementing, check the relevant docs:

| Topic | File |
|---|---|
| Vision / scope | `docs/01-vision-and-scope.md` |
| Features / screens | `docs/02-features-and-screens.md` |
| Domain & data model | `docs/03-domain-and-data-model.md` |
| API design (endpoints, schemas, error format) | `docs/04-api-design.md` |
| Architecture / infra / env vars | `docs/05-architecture-notes.md` |
