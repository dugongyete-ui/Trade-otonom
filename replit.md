# DzeckAI Trader

## Project Overview

A full-stack autonomous AI trading dashboard that simulates hedge-fund-style XAUUSD paper trading. The AI (powered by Cohere) makes all trading decisions independently every 30 seconds. Users observe in real-time via a live WebSocket feed and can manually mirror signals in MT5.

## Architecture

- **Frontend**: React + Vite on port 5000 (`client/`)
- **Backend**: Node.js + Express + WebSocket server on port 3001 (`server/`)
- **Database**: PostgreSQL (Replit built-in)
- **AI Engine**: Cohere `command-r-plus-08-2024` model

## Key Features

- Real-time AI trading decisions in Indonesian (Bahasa Indonesia)
- Live WebSocket feed broadcasting AI decisions, portfolio updates, trade updates
- AI "learns from losses" — shows `Belajar dari Kesalahan` reflection cards after SL hits
- Simulated XAUUSD paper trading with realistic market data
- Copy Trade MT5 panel with step-by-step instructions in Indonesian
- Equity curve chart, win rate, drawdown tracking

## Running the Project

The workflow `Start application` runs both services via `bash start.sh`:
- Kills any zombie processes on ports 5000 and 3001
- Starts server: `pnpm --filter server dev`
- Starts client: `pnpm --filter client dev`

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)
- `COHERE_API_KEY` — Cohere API key (set in .replit userenv)

## User Preferences

- All AI communication in Bahasa Indonesia
- Dark professional theme (navy/black background, gold accents)
- Paper trading only — no real money execution
