# Three Stars Fashion Website - Automation
# ==========================================
# Usage:
#   make start        - Start the website locally (python http.server)
#   make stop         - Stop the local website
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
	@echo "    make start        Start the local web server on port $$(PORT)"
	@echo "    make stop         Stop the local web server"
	@echo ""
	@echo "  Git Operations:"
	@echo "    make push         AI-powered commit + push (DeepSeek)"
	@echo "    make pull         Pull latest code from git"
	@echo "    make switch b=... Switch branches (e.g., make switch b=main)"
	@echo ""

start:
	@echo "🚀 Starting website on http://localhost:$(PORT)..."
	@$(PYTHON_CMD) -m http.server $(PORT) & echo $$! > server.pid
	@echo "✅ Website running in background. Use 'make stop' to stop."

stop:
	@echo "🛑 Stopping website..."
	@if [ -f server.pid ]; then \
		kill -9 `cat server.pid` 2>/dev/null || true; \
		rm server.pid; \
		echo "✅ Website stopped!"; \
	else \
		pkill -f "$(PYTHON_CMD) -m http.server $(PORT)" 2>/dev/null || true; \
		echo "✅ Website stopped!"; \
	fi

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
