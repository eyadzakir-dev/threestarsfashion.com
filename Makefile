# ============================================
# TSF Website - Commands Cheat Sheet
# ============================================
#
# HOW TO USE (type these in Terminal):
#
#   🌐 WEBSITE:
#   make start     → Start the website & open in Chrome
#   make dev       → Start with HOT RELOAD (auto-refreshes on save!)
#   make stop      → Stop the website
#   make restart   → Restart & refresh in Chrome
#   make open      → Just open in Chrome
#   make status    → Check if running
#
#   📤 GITHUB:
#   make push      → Save & push to current branch
#   make pull      → Pull latest from current branch
#
#   🌿 BRANCHES:
#   make branch          → Show which branch you're on
#   make switch b=NAME   → Switch to a branch
#   make new-branch b=NAME → Create a new feature branch
#   make merge-to-main   → Merge current branch into main
#   make abandon         → Throw away current branch, go back to main
#   make safe-reset      → Reset current branch to match the remote
#
#   make help      → Show this cheat sheet
#
# Website URL: http://localhost:8080
# ============================================

.PHONY: start dev stop restart open help push pull status branch switch new-branch merge-to-main abandon safe-reset

# Default port
PORT = 8080

# Website directory (. = current directory, since files are in repo root)
WEBSITE_DIR = .

# Chrome profile for development (change "Profile 3" to your profile)
# Your profiles:
#   Default    = eyadzakir@gwmail.gwu.edu (school)
#   Profile 1  = eyad.zakir@gmail.com
#   Profile 3  = eyadzakir1@gmail.com
CHROME_PROFILE = Profile 1

# ============================================
# START - Launch the website & open in develop Chrome
# ============================================
start:
	@echo ""
	@echo "🚀 Starting TSF Website..."
	@echo "🌿 Branch: $$(git rev-parse --abbrev-ref HEAD)"
	@echo ""
	@# Kill any existing server on this port
	@lsof -ti:$(PORT) | xargs kill -9 2>/dev/null || true
	@# Start new server in background
	@cd $(WEBSITE_DIR) && python3 -m http.server $(PORT) > /dev/null 2>&1 &
	@sleep 1
	@echo "✅ Website is now running!"
	@echo ""
	@echo "👉 http://localhost:$(PORT)"
	@echo ""
	@echo "💡 To stop: make stop"
	@echo "💡 To see changes: make restart"
	@echo ""
	@# Open in your develop Chrome profile (not school account)
	@open -na "Google Chrome" --args --profile-directory="$(CHROME_PROFILE)" http://localhost:$(PORT)

# ============================================
# DEV - Start with hot reload (auto-refreshes on save!)
# ============================================
dev:
	@echo ""
	@echo "🔥 Starting TSF Website with HOT RELOAD..."
	@echo "🌿 Branch: $$(git rev-parse --abbrev-ref HEAD)"
	@echo ""
	@# Kill any existing server on this port
	@lsof -ti:$(PORT) | xargs kill -9 2>/dev/null || true
	@sleep 0.5
	@echo "✅ Hot reload server starting!"
	@echo ""
	@echo "👉 http://localhost:$(PORT)"
	@echo "📝 Changes to HTML/CSS/JS will auto-refresh the browser!"
	@echo "💡 Press Ctrl+C to stop"
	@echo ""
	@# Open in Chrome
	@open -na "Google Chrome" --args --profile-directory="$(CHROME_PROFILE)" http://localhost:$(PORT)
	@# Start livereload (runs in foreground so Ctrl+C stops it)
	@cd $(WEBSITE_DIR) && python3 -c "\
import livereload; \
server = livereload.Server(); \
server.watch('*.html'); \
server.watch('*.css'); \
server.watch('*.js'); \
server.watch('assets/'); \
server.serve(port=$(PORT), open_url_delay=None)"

# ============================================
# STOP - Stop the website
# ============================================
stop:
	@echo ""
	@echo "⏹️  Stopping TSF Website..."
	@lsof -ti:$(PORT) | xargs kill -9 2>/dev/null || true
	@echo "✅ Website stopped!"
	@echo ""

# ============================================
# RESTART - Restart server & refresh Chrome
# This is your "I changed something, show me" command
# ============================================
restart:
	@echo ""
	@echo "🔄 Restarting TSF Website..."
	@echo "🌿 Branch: $$(git rev-parse --abbrev-ref HEAD)"
	@lsof -ti:$(PORT) | xargs kill -9 2>/dev/null || true
	@sleep 0.5
	@cd $(WEBSITE_DIR) && python3 -m http.server $(PORT) > /dev/null 2>&1 &
	@sleep 1
	@echo "✅ Website restarted!"
	@echo ""
	@echo "👉 http://localhost:$(PORT)"
	@echo ""
	@# Refresh the page in your develop Chrome profile
	@osascript -e 'tell application "Google Chrome"' \
		-e '  set foundTab to false' \
		-e '  repeat with w in every window' \
		-e '    repeat with t in every tab of w' \
		-e '      if URL of t contains "localhost:$(PORT)" then' \
		-e '        set active tab index of w to (index of t)' \
		-e '        set index of w to 1' \
		-e '        tell t to reload' \
		-e '        set foundTab to true' \
		-e '        exit repeat' \
		-e '      end if' \
		-e '    end repeat' \
		-e '    if foundTab then exit repeat' \
		-e '  end repeat' \
		-e '  if not foundTab then' \
		-e '    do shell script "open -na \"Google Chrome\" --args --profile-directory=\"$(CHROME_PROFILE)\" http://localhost:$(PORT)"' \
		-e '  end if' \
		-e 'end tell' 2>/dev/null || open -na "Google Chrome" --args --profile-directory="$(CHROME_PROFILE)" http://localhost:$(PORT)

# ============================================
# OPEN - Just open website in develop Chrome
# ============================================
open:
	@echo "🌐 Opening website in Chrome..."
	@open -na "Google Chrome" --args --profile-directory="$(CHROME_PROFILE)" http://localhost:$(PORT)

# ============================================
# STATUS - Check if website is running
# ============================================
status:
	@echo ""
	@echo "🌿 Branch: $$(git rev-parse --abbrev-ref HEAD)"
	@if lsof -ti:$(PORT) > /dev/null 2>&1; then \
		echo "✅ Website is RUNNING at http://localhost:$(PORT)"; \
	else \
		echo "❌ Website is NOT running"; \
		echo "   Type 'make start' to start it"; \
	fi
	@echo ""

# ============================================
# PUSH - Save changes to current branch on GitHub
# ============================================
push:
	@echo ""
	@echo "🌿 You are on branch: $$(git rev-parse --abbrev-ref HEAD)"
	@echo "📤 Saving changes to GitHub..."
	@git add -A
	@read -p "💬 Enter commit message: " MSG && \
		git commit -m "$$MSG" || echo "⚠️  No changes to commit."
	@echo "📤 Pushing to $$(git rev-parse --abbrev-ref HEAD)..."
	@git push origin $$(git rev-parse --abbrev-ref HEAD)
	@echo "✅ Changes saved to $$(git rev-parse --abbrev-ref HEAD)!"
	@echo ""

# ============================================
# PULL - Get latest code from current branch
# ============================================
pull:
	@echo ""
	@echo "🌿 Pulling latest from $$(git rev-parse --abbrev-ref HEAD)..."
	@git pull origin $$(git rev-parse --abbrev-ref HEAD)
	@echo "✅ Up to date!"
	@echo ""

# ============================================
# BRANCH - Show which branch you're on
# ============================================
branch:
	@echo ""
	@echo "📍 You are currently on: $$(git rev-parse --abbrev-ref HEAD)"
	@echo ""
	@echo "📋 All your branches:"
	@git branch
	@echo ""

# ============================================
# SWITCH - Switch to a different branch
# Usage: make switch b=branch-name
# ============================================
switch:
	@if [ -z "$(b)" ]; then \
		echo ""; \
		echo "❌ Please specify a branch name!"; \
		echo "   Usage: make switch b=branch-name"; \
		echo ""; \
		echo "📋 Available branches:"; \
		git branch -a; \
		echo ""; \
	else \
		echo ""; \
		echo "🌿 Switching to branch: $(b)..."; \
		git checkout $(b) || git checkout -b $(b) origin/$(b); \
		echo "✅ You are now on: $$(git rev-parse --abbrev-ref HEAD)"; \
		echo ""; \
	fi

# ============================================
# NEW-BRANCH - Create a new feature branch from main
# Usage: make new-branch b=my-feature-name
# ============================================
new-branch:
	@if [ -z "$(b)" ]; then \
		echo ""; \
		echo "❌ Please specify a branch name!"; \
		echo "   Usage: make new-branch b=my-feature-name"; \
		echo ""; \
	else \
		echo ""; \
		echo "🌿 Creating new branch: $(b) (from main)..."; \
		git checkout main; \
		git pull origin main; \
		git checkout -b $(b); \
		git push -u origin $(b); \
		echo "✅ Branch '$(b)' created and pushed to GitHub!"; \
		echo "   You are now on branch: $$(git rev-parse --abbrev-ref HEAD)"; \
		echo ""; \
	fi

# ============================================
# MERGE-TO-MAIN - Merge your feature into main
# (Only do this when your feature is stable!)
# ============================================
merge-to-main:
	@echo ""
	@CURRENT=$$(git rev-parse --abbrev-ref HEAD); \
	if [ "$$CURRENT" = "main" ]; then \
		echo "❌ You're already on main! Switch to a feature branch first."; \
		echo ""; \
	else \
		echo "🔀 Merging '$$CURRENT' into main..."; \
		echo ""; \
		read -p "⚠️  Are you sure you want to merge $$CURRENT into main? (y/n): " CONFIRM && \
		if [ "$$CONFIRM" = "y" ] || [ "$$CONFIRM" = "Y" ]; then \
			git checkout main && \
			git pull origin main && \
			git merge $$CURRENT && \
			git push origin main && \
			echo "" && \
			echo "✅ '$$CURRENT' has been merged into main!" && \
			echo "   You are now on main." && \
			echo ""; \
		else \
			echo "❌ Merge cancelled."; \
			echo ""; \
		fi \
	fi

# ============================================
# ABANDON - Throw away current branch & go back to main
# (Use when your feature branch is totally broken)
# ============================================
abandon:
	@echo ""
	@CURRENT=$$(git rev-parse --abbrev-ref HEAD); \
	if [ "$$CURRENT" = "main" ]; then \
		echo "❌ You're already on main! Nothing to abandon."; \
		echo ""; \
	else \
		echo "🗑️  Abandoning branch: $$CURRENT"; \
		echo ""; \
		read -p "⚠️  This will DELETE '$$CURRENT' and go back to main. Are you sure? (y/n): " CONFIRM && \
		if [ "$$CONFIRM" = "y" ] || [ "$$CONFIRM" = "Y" ]; then \
			git checkout main && \
			git branch -D $$CURRENT && \
			git pull origin main && \
			echo "" && \
			echo "✅ Branch '$$CURRENT' deleted. You are back on main." && \
			echo ""; \
		else \
			echo "❌ Abandon cancelled."; \
			echo ""; \
		fi \
	fi

# ============================================
# SAFE-RESET - Reset current branch to match the remote
# (Throws away local changes, matches what's on GitHub)
# ============================================
safe-reset:
	@echo ""
	@echo "🌿 Branch: $$(git rev-parse --abbrev-ref HEAD)"
	@read -p "⚠️  This will throw away ALL local changes. Are you sure? (y/n): " CONFIRM && \
	if [ "$$CONFIRM" = "y" ] || [ "$$CONFIRM" = "Y" ]; then \
		git fetch origin && \
		git reset --hard origin/$$(git rev-parse --abbrev-ref HEAD) && \
		echo "" && \
		echo "✅ Reset to match GitHub!" && \
		echo ""; \
	else \
		echo "❌ Reset cancelled."; \
		echo ""; \
	fi

# ============================================
# HELP - Show all available commands
# ============================================
help:
	@echo ""
	@echo "╔══════════════════════════════════════════════════════╗"
	@echo "║          TSF WEBSITE - COMMAND CHEAT SHEET          ║"
	@echo "╠══════════════════════════════════════════════════════╣"
	@echo "║                                                      ║"
	@echo "║  🌐 WEBSITE:                                         ║"
	@echo "║  make start          → Start & open in Chrome        ║"
	@echo "║  make dev            → Start with HOT RELOAD 🔥      ║"
	@echo "║  make stop           → Stop the website              ║"
	@echo "║  make restart        → Restart & refresh Chrome      ║"
	@echo "║  make open           → Just open in Chrome           ║"
	@echo "║  make status         → Check if running              ║"
	@echo "║                                                      ║"
	@echo "║  📤 GITHUB:                                          ║"
	@echo "║  make push           → Save & push to branch         ║"
	@echo "║  make pull           → Get latest from branch        ║"
	@echo "║                                                      ║"
	@echo "║  🌿 BRANCHES:                                        ║"
	@echo "║  make branch         → Show current branch           ║"
	@echo "║  make switch b=NAME  → Switch to a branch            ║"
	@echo "║  make new-branch b=NAME → Create new feature branch  ║"
	@echo "║  make merge-to-main  → Merge feature into main       ║"
	@echo "║  make abandon        → Delete branch, go to main     ║"
	@echo "║  make safe-reset     → Reset branch to match GitHub  ║"
	@echo "║                                                      ║"
	@echo "║  make help           → Show this cheat sheet         ║"
	@echo "║                                                      ║"
	@echo "╚══════════════════════════════════════════════════════╝"
	@echo ""
	@echo "📍 Current branch: $$(git rev-parse --abbrev-ref HEAD)"
	@echo "🌐 Website URL: http://localhost:$(PORT)"
	@echo ""
