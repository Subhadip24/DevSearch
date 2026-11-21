import requests
import subprocess
import shutil
import tempfile
import time
from pathlib import Path
from typing import Dict, Any, List, Optional

GITHUB_API_URL = "https://api.github.com"

# Cache for repositories to avoid hitting rate limits too frequently
_repo_cache: Dict[str, Any] = {
    "timestamp": 0,
    "repos": []
}
CACHE_TTL_SECONDS = 60

class GitHubService:
    @staticmethod
    def _get_headers(token: str) -> Dict[str, str]:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "DevSearch-Hub"
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    @staticmethod
    def get_user_profile(token: str) -> Dict[str, Any]:
        """Fetch current authenticated user profile."""
        if not token:
            raise ValueError("GitHub token is not configured.")
        
        headers = GitHubService._get_headers(token)
        response = requests.get(f"{GITHUB_API_URL}/user", headers=headers, timeout=10)
        
        if response.status_code == 401:
            raise ValueError("Invalid GitHub Token or token has expired.")
        if response.status_code != 200:
            raise ValueError(f"GitHub API Error ({response.status_code}): {response.text}")
        
        return response.json()

    @staticmethod
    def get_repositories(token: str, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """Fetch all repositories for the authenticated user with caching."""
        global _repo_cache
        current_time = time.time()

        if not force_refresh and _repo_cache["repos"] and (current_time - _repo_cache["timestamp"] < CACHE_TTL_SECONDS):
            return _repo_cache["repos"]

        if not token:
            raise ValueError("GitHub token is not configured.")

        headers = GitHubService._get_headers(token)
        all_repos = []
        page = 1

        # Fetch up to 300 repositories (3 pages of 100)
        while page <= 3:
            url = f"{GITHUB_API_URL}/user/repos?per_page=100&page={page}&sort=updated&direction=desc&affiliation=owner,collaborator"
            resp = requests.get(url, headers=headers, timeout=12)
            if resp.status_code != 200:
                if page == 1:
                    raise ValueError(f"Failed to fetch repositories: {resp.text}")
                break
            
            repos = resp.json()
            if not repos:
                break
            all_repos.extend(repos)
            if len(repos) < 100:
                break
            page += 1

        # Format and normalize repository list
        normalized = []
        for r in all_repos:
            normalized.append({
                "id": r.get("id"),
                "name": r.get("name"),
                "full_name": r.get("full_name"),
                "owner": r.get("owner", {}).get("login"),
                "owner_avatar": r.get("owner", {}).get("avatar_url"),
                "html_url": r.get("html_url"),
                "description": r.get("description") or "No description provided.",
                "language": r.get("language") or "Code",
                "stars": r.get("stargazers_count", 0),
                "forks": r.get("forks_count", 0),
                "is_private": r.get("private", False),
                "is_fork": r.get("fork", False),
                "updated_at": r.get("updated_at"),
                "default_branch": r.get("default_branch", "main"),
                "clone_url": r.get("clone_url"),
                "ssh_url": r.get("ssh_url"),
                "open_issues": r.get("open_issues_count", 0),
                "topics": r.get("topics", [])
            })

        _repo_cache["repos"] = normalized
        _repo_cache["timestamp"] = current_time
        return normalized

    @staticmethod
    def get_repo_readme(token: str, owner: str, repo: str) -> Dict[str, str]:
        """Fetch README rendered HTML or raw content."""
        headers = GitHubService._get_headers(token)
        # Request HTML rendered format
        headers["Accept"] = "application/vnd.github.html+json"
        url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/readme"
        resp = requests.get(url, headers=headers, timeout=10)
        
        if resp.status_code == 404:
            return {"html": "<p class='text-muted'>No README.md found in this repository.</p>"}
        if resp.status_code != 200:
            return {"html": f"<p class='text-danger'>Could not load README: {resp.text}</p>"}
            
        return {"html": resp.text}

    @staticmethod
    def create_repo(token: str, name: str, description: str, is_private: bool) -> Dict[str, Any]:
        """Create a new GitHub repository."""
        headers = GitHubService._get_headers(token)
        payload = {
            "name": name,
            "description": description,
            "private": is_private,
            "auto_init": False
        }
        resp = requests.post(f"{GITHUB_API_URL}/user/repos", headers=headers, json=payload, timeout=15)
        if resp.status_code not in (200, 201):
            error_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            message = error_data.get("message", resp.text)
            errors = error_data.get("errors", [])
            if errors:
                message += f" ({errors[0].get('message', '')})"
            raise ValueError(f"Failed to create repository: {message}")
        return resp.json()

    @staticmethod
    def push_project_files(token: str, repo_info: Dict[str, Any], project_dir: Path, commit_msg: str = "Initial commit from DevSearch Hub") -> None:
        """Initialize Git repo, commit files, and push to GitHub."""
        clone_url = repo_info["clone_url"]  # https://github.com/username/repo.git
        auth_url = clone_url.replace("https://", f"https://x-access-token:{token}@")
        user_name = repo_info.get("owner", {}).get("login", "DevSearch User")

        # Commands to execute in project_dir
        cmds = [
            ["git", "init"],
            ["git", "config", "user.name", user_name],
            ["git", "config", "user.email", f"{user_name}@users.noreply.github.com"],
            ["git", "add", "."],
            ["git", "commit", "-m", commit_msg],
            ["git", "branch", "-M", "main"],
            ["git", "remote", "add", "origin", auth_url],
            ["git", "push", "-u", "origin", "main"]
        ]

        for cmd in cmds:
            result = subprocess.run(
                cmd,
                cwd=str(project_dir),
                capture_output=True,
                text=True,
                check=False
            )
            if result.returncode != 0:
                # If git commit had nothing to commit (empty directory)
                if "nothing to commit" in result.stdout or "nothing to commit" in result.stderr:
                    continue
                # Mask token in error message
                err_clean = result.stderr.replace(token, "***")
                raise RuntimeError(f"Git command failed ({' '.join(cmd[:2])}): {err_clean.strip()}")

        # Invalidate cache so new repo appears right away
        global _repo_cache
        _repo_cache["timestamp"] = 0

    @staticmethod
    def get_repo_contents(token: str, owner: str, repo: str, path: str = "") -> Dict[str, Any]:
        """Fetch directory contents of a repository."""
        headers = GitHubService._get_headers(token)
        clean_path = path.strip("/")
        url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/contents/{clean_path}" if clean_path else f"{GITHUB_API_URL}/repos/{owner}/{repo}/contents"
        resp = requests.get(url, headers=headers, timeout=12)

        if resp.status_code == 404:
            return {"empty": True, "path": clean_path, "items": []}
        if resp.status_code != 200:
            raise ValueError(f"Failed to fetch contents: {resp.text}")

        data = resp.json()
        if not isinstance(data, list):
            # Single file was requested instead of directory
            data = [data]

        items = []
        for item in data:
            items.append({
                "name": item.get("name"),
                "path": item.get("path"),
                "type": item.get("type"),  # "file" | "dir"
                "size": item.get("size", 0),
                "download_url": item.get("download_url"),
                "html_url": item.get("html_url")
            })

        # Sort: directories first, then files
        items.sort(key=lambda x: (0 if x["type"] == "dir" else 1, x["name"].lower()))
        return {"empty": False, "path": clean_path, "items": items}

    @staticmethod
    def get_file_content(token: str, owner: str, repo: str, path: str) -> Dict[str, Any]:
        """Fetch and decode raw content of a specific file."""
        import base64
        headers = GitHubService._get_headers(token)
        clean_path = path.strip("/")
        url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/contents/{clean_path}"
        resp = requests.get(url, headers=headers, timeout=15)

        if resp.status_code == 404:
            raise ValueError("File not found.")
        if resp.status_code != 200:
            raise ValueError(f"Failed to load file: {resp.text}")

        data = resp.json()
        raw_b64 = data.get("content", "")
        encoding = data.get("encoding", "")

        text_content = ""
        is_binary = False

        if encoding == "base64" and raw_b64:
            try:
                decoded_bytes = base64.b64decode(raw_b64)
                text_content = decoded_bytes.decode("utf-8")
            except UnicodeDecodeError:
                is_binary = True
                text_content = f"Binary file ({data.get('size', 0)} bytes). Cannot be displayed as text."
            except Exception as e:
                text_content = f"Error decoding file: {str(e)}"
        else:
            text_content = raw_b64 or "Empty file."

        return {
            "name": data.get("name"),
            "path": data.get("path"),
            "size": data.get("size", 0),
            "content": text_content,
            "is_binary": is_binary,
            "download_url": data.get("download_url"),
            "html_url": data.get("html_url")
        }

    @staticmethod
    def sync_repositories(token: str, known_ids: List[int]) -> Dict[str, Any]:
        """Check for newly created repositories and return updated list."""
        all_repos = GitHubService.get_repositories(token, force_refresh=True)
        known_set = set(known_ids)
        new_repos = [r for r in all_repos if r["id"] not in known_set]
        return {
            "has_new": len(new_repos) > 0,
            "new_count": len(new_repos),
            "new_repos": new_repos,
            "total_count": len(all_repos),
            "repos": all_repos
        }

