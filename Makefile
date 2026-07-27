# Three Stars Fashion Website - Automation
# ==========================================
# Usage:
#   make start        - Start local dev server (Clean URLs + Live Reload)
#   make stop         - Stop the local dev server
#   make push         - AI-powered git commit + push (DeepSeek)
#   make pull         - Pull latest code from current branch
#   make switch b=... - Switch to branch (e.g. make switch b=main)

PORT ?= 8080
ifneq (,$(filter Windows_NT,$(OS)))
    PYTHON_CMD := python
else
    PYTHON_CMD := $(shell command -v python3 > /dev/null 2>&1 && echo python3 || echo python)
endif

.PHONY: help start stop push pull switch

default: help

help:
	@echo ""
	@echo "  Three Stars Fashion - Dev Commands"
	@echo "  =================================="
	@echo ""
	@echo "  Website:"
	@echo "    make start        Start dev server — Clean URLs + Live Reload (port $$(PORT))"
	@echo "    make stop         Stop the local dev server"
	@echo ""
	@echo "  Git Operations:"
	@echo "    make push         AI-powered commit + push (DeepSeek)"
	@echo "    make pull         Pull latest code from git"
	@echo "    make switch b=... Switch branches (e.g., make switch b=main)"
	@echo ""

start:
	@echo "📦 Checking dependencies..."
	@$(PYTHON_CMD) -m pip install livereload -q
	@echo "🧹 Clearing port $(PORT)..."
	@if [ -f server.pid ]; then kill -9 `cat server.pid` 2>/dev/null || true; rm -f server.pid; fi
	@lsof -ti:$(PORT) | xargs kill -9 2>/dev/null || true
	@echo "🚀 Starting dev server on http://localhost:$(PORT)..."
	@PORT=$(PORT) $(PYTHON_CMD) scripts/dev_server.py & echo $$! > server.pid
	@sleep 1
	@echo "✅ Dev server running at http://localhost:$(PORT)"
	@echo "   🔄 Live Reload + 🔗 Clean URLs active"
	@echo "   Stop with: make stop"

stop:
	@echo "🛑 Stopping dev server..."
	@if [ -f server.pid ]; then kill -9 `cat server.pid` 2>/dev/null || true; rm -f server.pid; fi
	@pkill -f "dev_server.py" 2>/dev/null || true
	@lsof -ti:$(PORT) | xargs kill -9 2>/dev/null || true
	@echo "✅ Dev server stopped!"

push:
	@echo "🚀 AI-powered commit + push (Using DeepSeek)..."
	@$(PYTHON_CMD) scripts/autocommit_aaron.py

pull:
	@echo "⬇️  Pulling latest code..."
	git pull

switch:
	@if [ -z "$(b)" ]; then \
		echo "⚠️  Please specify a branch using b=<branch> (e.g., make switch b=main)"; \
		exit 1; \
	fi
	@echo "🔀 Switching to branch: $(b)..."
	git checkout $(b)
