import os
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, Request, Form, File, UploadFile, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from config import ConfigManager
from github_service import GitHubService

BASE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="DevSearch - Personal Google & GitHub Project Hub")

# Mount static and templates
STATIC_DIR.mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "css").mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "js").mkdir(parents=True, exist_ok=True)
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


class TokenRequest(BaseModel):
    token: str


class SyncRequest(BaseModel):
    known_ids: List[int] = []


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Render the main Google-style search & developer hub interface."""
    token = ConfigManager.get_token()
    configured = bool(token)
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"is_configured": configured}
    )


@app.get("/api/status")
async def get_status():
    """Check if token is configured and retrieve user profile."""
    token = ConfigManager.get_token()
    if not token:
        return {"configured": False, "user": None}
    
    try:
        user = GitHubService.get_user_profile(token)
        return {
            "configured": True,
            "user": {
                "login": user.get("login"),
                "name": user.get("name") or user.get("login"),
                "avatar_url": user.get("avatar_url"),
                "html_url": user.get("html_url"),
                "bio": user.get("bio", ""),
                "public_repos": user.get("public_repos", 0),
                "total_private_repos": user.get("total_private_repos", 0),
                "followers": user.get("followers", 0),
                "following": user.get("following", 0)
            }
        }
    except Exception as e:
        return {"configured": False, "error": str(e), "user": None}


@app.post("/api/settings/token")
async def save_token(payload: TokenRequest):
    """Validate and store GitHub Personal Access Token."""
    token = payload.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token cannot be empty.")
    
    try:
        user = GitHubService.get_user_profile(token)
        ConfigManager.set_token(token)
        return {
            "success": True,
            "message": f"Successfully authenticated as @{user.get('login')}!",
            "user": {
                "login": user.get("login"),
                "name": user.get("name"),
                "avatar_url": user.get("avatar_url")
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/repos")
async def get_repos(refresh: bool = False):
    """Get all repositories and language statistics."""
    token = ConfigManager.get_token()
    if not token:
        raise HTTPException(status_code=401, detail="GitHub token not configured. Please add your token in settings.")
    
    try:
        repos = GitHubService.get_repositories(token, force_refresh=refresh)
        
        # Calculate summary statistics
        languages = {}
        total_stars = 0
        total_forks = 0
        for r in repos:
            lang = r.get("language")
            if lang and lang != "Code":
                languages[lang] = languages.get(lang, 0) + 1
            total_stars += r.get("stars", 0)
            total_forks += r.get("forks", 0)

        # Sort languages by popularity
        sorted_languages = sorted(languages.items(), key=lambda x: x[1], reverse=True)

        return {
            "total_count": len(repos),
            "total_stars": total_stars,
            "total_forks": total_forks,
            "top_languages": [lang for lang, count in sorted_languages[:10]],
            "language_counts": dict(sorted_languages[:10]),
            "repos": repos
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/repo/{owner}/{repo}/readme")
async def get_readme(owner: str, repo: str):
    """Get rendered README content."""
    token = ConfigManager.get_token()
    if not token:
        raise HTTPException(status_code=401, detail="GitHub token not configured.")
    
    try:
        return GitHubService.get_repo_readme(token, owner, repo)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/repos/sync")
async def sync_repos(payload: SyncRequest):
    """Check for new repositories on GitHub and return any updates."""
    token = ConfigManager.get_token()
    if not token:
        raise HTTPException(status_code=401, detail="GitHub token not configured.")
    try:
        return GitHubService.sync_repositories(token, payload.known_ids)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/repo/{owner}/{repo}/contents")
async def get_contents(owner: str, repo: str, path: str = ""):
    """Fetch directory contents of a repository."""
    token = ConfigManager.get_token()
    if not token:
        raise HTTPException(status_code=401, detail="GitHub token not configured.")
    try:
        return GitHubService.get_repo_contents(token, owner, repo, path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/repo/{owner}/{repo}/file")
async def get_file(owner: str, repo: str, path: str):
    """Fetch raw and decoded file content."""
    token = ConfigManager.get_token()
    if not token:
        raise HTTPException(status_code=401, detail="GitHub token not configured.")
    try:
        return GitHubService.get_file_content(token, owner, repo, path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload")
async def upload_project(
    name: str = Form(...),
    description: str = Form(""),
    is_private: bool = Form(False),
    add_readme: bool = Form(True),
    archive: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None)
):
    """Upload project files/zip, create a GitHub repo, and push code."""
    token = ConfigManager.get_token()
    if not token:
        raise HTTPException(status_code=401, detail="GitHub token not configured. Please connect your GitHub account.")

    clean_name = name.strip().replace(" ", "-")
    if not clean_name:
        raise HTTPException(status_code=400, detail="Repository name cannot be empty.")

    # Create temporary directory to stage files
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        has_files = False

        # 1. Handle ZIP Archive upload
        if archive and archive.filename:
            zip_dest = temp_path / "upload.zip"
            with open(zip_dest, "wb") as buffer:
                shutil.copyfileobj(archive.file, buffer)
            
            # Extract zip
            try:
                with zipfile.ZipFile(zip_dest, 'r') as zip_ref:
                    zip_ref.extractall(temp_path)
                zip_dest.unlink() # remove the zip itself
                
                # If everything extracted into a single root folder, move contents up
                extracted_items = list(temp_path.iterdir())
                if len(extracted_items) == 1 and extracted_items[0].is_dir():
                    single_dir = extracted_items[0]
                    for item in single_dir.iterdir():
                        shutil.move(str(item), str(temp_path))
                    single_dir.rmdir()
                has_files = True
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to extract ZIP archive: {str(e)}")

        # 2. Handle Individual Files upload
        if files:
            for upload in files:
                if upload.filename:
                    rel_path = Path(upload.filename)
                    dest_file = temp_path / rel_path
                    dest_file.parent.mkdir(parents=True, exist_ok=True)
                    with open(dest_file, "wb") as buffer:
                        shutil.copyfileobj(upload.file, buffer)
                    has_files = True

        # 3. Add default README.md if requested and not present
        readme_path = temp_path / "README.md"
        if not readme_path.exists() and (add_readme or not has_files):
            with open(readme_path, "w", encoding="utf-8") as f:
                f.write(f"# {clean_name}\n\n{description or 'Project uploaded via DevSearch Hub.'}\n\n## Built with DevSearch Hub\n")
            has_files = True

        # 4. Add a default .gitignore if not present
        gitignore_path = temp_path / ".gitignore"
        if not gitignore_path.exists():
            with open(gitignore_path, "w", encoding="utf-8") as f:
                f.write("__pycache__/\n*.pyc\nnode_modules/\n.env\n.DS_Store\nThumbs.db\n*.class\ntarget/\nbin/\n")

        # 5. Create GitHub Repository
        try:
            repo_info = GitHubService.create_repo(token, clean_name, description, is_private)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

        # 6. Push files to GitHub using Git
        try:
            GitHubService.push_project_files(token, repo_info, temp_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Repository created, but error pushing files: {str(e)}")

        return {
            "success": True,
            "message": f"Successfully created and uploaded project '{clean_name}' to GitHub!",
            "repo": {
                "name": repo_info.get("name"),
                "full_name": repo_info.get("full_name"),
                "html_url": repo_info.get("html_url"),
                "clone_url": repo_info.get("clone_url"),
                "is_private": repo_info.get("private", False)
            }
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)

