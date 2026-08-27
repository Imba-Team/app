# Frontend migration plan

## Goal

Replace the current Vite-based frontend under apps/web with the existing Next.js implementation from frontend-main while preserving the current visual design system (palette, shadcn-style component treatment, and spacing/typography).

## Phases

1. Repository alignment
   - Link the local frontend-main checkout to the GitHub repo at https://github.com/Imba-Team/frontend.git.
   - Fetch the upstream history so the project remains traceable.

2. Source transfer
   - Copy the app, components, contexts, lib, public, and config files from frontend-main into apps/web.
   - Keep the current design tokens and UI styling from the existing app as the visual foundation.

3. Build integration
   - Update package metadata and app entry points so the new frontend runs from apps/web.
   - Resolve any path alias or routing differences between the old and new codebases.

4. UI polish
   - Apply the current palette and shadcn-inspired component styling to the transferred app.
   - Validate the core routes and auth flow.

## Current status

- Repository remote is now pointed at the GitHub frontend repository.
- Frontend source transfer has started and will continue into the app/web workspace.
