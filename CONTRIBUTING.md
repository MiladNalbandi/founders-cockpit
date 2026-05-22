# Contributing to Founder's Cockpit

Thanks for your interest! This project is GPL-3.0 — contributions are welcome under the same license.

## Dev setup

Follow the two-terminal flow in the [README](README.md#running-locally-fastest-path). Once you can register, paste an Anthropic key, and run an agent end-to-end, you're set up.

## Filing issues

Please include:
- What you tried (commands, clicks)
- What you expected
- What you got — full traceback or browser console errors
- Your OS, Python version (`python --version`), and Node version (`node --version`)

## Pull requests

- Branch from `main`, keep PRs focused (one concern per PR)
- Run `python manage.py test` in `backend/` and `npm run typecheck` in `desktop/` before pushing
- For new agent roles, add the role file under `backend/apps/agents/roles/` and register it in `registry.py`
- For UI changes, attach a screenshot in the PR description

## Areas that need help

- Filling in the **stub** agents (Marketing, Engagement, Analytics, Release) with real tool integrations
- Raster image generation for the Designer agent
- Postgres + Redis docker-compose hardening
- Tests for `backend/apps/agents/runtime.py`

By submitting a PR you agree your contribution is licensed under GPL-3.0.
