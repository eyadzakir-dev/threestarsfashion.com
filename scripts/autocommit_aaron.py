import os
import subprocess
import sys
from pathlib import Path

# Setup paths
SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent

try:
    from openai import OpenAI
except ImportError:
    print("⚠️  Missing dependencies (openai).")
    subprocess.run(["git", "add", "."], cwd=ROOT_DIR)
    subprocess.run(["git", "commit", "-m", "wip: quick push (missing deps)"], cwd=ROOT_DIR)
    subprocess.run(["git", "push"], cwd=ROOT_DIR)
    sys.exit(0)

def get_staged_diff():
    """Get the diff of currently staged files."""
    result = subprocess.run(
        ["git", "diff", "--cached"], 
        capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=ROOT_DIR
    )
    return result.stdout or ""

def get_staged_files():
    """Get the list of staged files."""
    result = subprocess.run(
        ["git", "diff", "--name-only", "--cached"], 
        capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=ROOT_DIR
    )
    return result.stdout or ""

def main():
    api_key = "sk-873324e093c342adbba6c4754882add3"
    commit_msg = ""

    print("📦 Staging all changes...")
    subprocess.run(["git", "add", "."], cwd=ROOT_DIR)

    diff = get_staged_diff()
    files = get_staged_files()
    
    if not diff.strip():
        print("No changes to commit.")
        sys.exit(0)

    # --- LOGIC CHANGE: Handling Large Diffs ---
    # 25,000 chars is roughly 6000-7000 tokens. DeepSeek handles 64k context easily.
    MAX_DIFF_LEN = 25000 
    
    # Check for lock files using safe extension check
    is_lock_file = any(f.endswith(('.lock', '-lock.json', '.lock.yaml')) for f in files.splitlines())
    
    if is_lock_file:
        diff_context = "⚠️ Large lock file changes detected (excluded from context to save tokens)."
        diff_context += "\n" + diff[:10000]
    elif len(diff) > MAX_DIFF_LEN:
        diff_context = f"⚠️ DIFF TRUNCATED (Total len: {len(diff)} chars). Showing first {MAX_DIFF_LEN} chars:\n"
        diff_context += diff[:MAX_DIFF_LEN]
    else:
        diff_context = diff

    prompt_content = f"Staged Files (Always Full List):\n{files}\n\nDiff Content:\n{diff_context}"

    client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

    print("🤖 Analyzing changeset...")
    
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": (
                    "You are a senior developer. Generate a detailed commit message complying with Conventional Commits."
                    "\nStructure:"
                    "\n<type>: <short summary>"
                    "\n\n- <bullet point 1>"
                    "\n- <bullet point 2>"
                    "\n\nRules:"
                    "\n1. First line must be under 72 chars."
                    "\n2. If the file list is long, group changes logically in the bullet points (e.g., 'Refactor auth modules' instead of listing every file)."
                    "\n3. Use the file list to infer architectural changes if the diff is truncated."
                    "\n4. Do not use markdown (like **bold**) in the output, just plain text."
                )},
                {"role": "user", "content": prompt_content}
            ],
            temperature=0.4, # Lower temperature for more factual summaries
            max_tokens=250   # Increased tokens for longer body
        )
        commit_msg = response.choices[0].message.content.strip()
    except Exception as e:
        print(f"⚠️  Generation failed: {e}")
        commit_msg = "wip: large update (generation failed)"

    # Execute Git Commands
    branch = subprocess.run(["git", "branch", "--show-current"], capture_output=True, text=True, cwd=ROOT_DIR).stdout.strip()
    
    print("---------------------------------------------------")
    print(f"🚀 Branch: {branch}")
    print(f"📝 Message:\n{commit_msg}")
    print("---------------------------------------------------")

    try:
        subprocess.run(["git", "commit", "-m", commit_msg], cwd=ROOT_DIR, check=True)
        subprocess.run(["git", "push"], cwd=ROOT_DIR, check=True)
        print("✅ Pushed!")
    except subprocess.CalledProcessError:
        print("❌ Failed to commit/push.")
        sys.exit(1)

if __name__ == "__main__":
    main()