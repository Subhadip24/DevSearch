import os
import json
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
CONFIG_FILE = BASE_DIR / "config.json"

# Load environment variables if .env exists
load_dotenv(ENV_FILE)

class ConfigManager:
    @staticmethod
    def get_token() -> str:
        # 1. Check environment variable
        token = os.getenv("GITHUB_TOKEN", "").strip()
        if token:
            return token
        
        # 2. Check local config.json file
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data.get("github_token", "").strip()
            except Exception:
                pass
        return ""

    @staticmethod
    def set_token(token: str) -> None:
        token = token.strip()
        # Update config.json
        data = {}
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = {}
        data["github_token"] = token
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        # Update .env
        env_lines = []
        if ENV_FILE.exists():
            with open(ENV_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    if not line.startswith("GITHUB_TOKEN="):
                        env_lines.append(line)
        env_lines.append(f"GITHUB_TOKEN={token}\n")
        with open(ENV_FILE, "w", encoding="utf-8") as f:
            f.writelines(env_lines)
        os.environ["GITHUB_TOKEN"] = token

