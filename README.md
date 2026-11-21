# 🌊 DevSearch - Personal Google & GitHub Project Hub

[![GitHub](https://img.shields.io/badge/GitHub-Subhadip24-181717?style=flat&logo=github)](https://github.com/Subhadip24)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python)](https://www.python.org/)

**DevSearch** is a personalized, Google-style developer portal and project hub. It lets you explore, manage, search, and upload all your code projects seamlessly, combined with real-time GitHub synchronization and a 60 FPS animated sea-storm background.

---

## 🌟 Key Features

### 🔍 1. Google-Style Unified Search
* **Instant Real-Time Search**: Search across your repository titles, descriptions, programming languages, and topics as you type.
* **Search Scope Switcher**:
  * 🐙 **My GitHub Projects**: Fuzzy filter through your personal repos.
  * 🌐 **Google Web Search**: Seamlessly forwards your search query to Google in a new tab.
  * 💻 **GitHub Global Search**: Searches all public code and repositories across GitHub.
* **"I'm Feeling Lucky"**: Jump directly to a random project from your personal portfolio.

### ⚡ 2. Direct In-Browser Project Access
* **In-Browser Code & File Explorer**: Click **"⚡ Direct Access"** on any project to open a dual-pane file manager right inside your browser. Browse directories with breadcrumbs and inspect file contents with line numbering.
* **🌐 1-Click Web VS Code (`github.dev`)**: Click **"🌐 Web IDE"** to instantly launch full VS Code in your browser tab—no desktop software installation required!
* **📖 In-App README Viewer**: Read rendered GitHub markdown documentation directly in a modal without navigating away.
* **📋 1-Click Clone**: Copy `git clone` commands straight to your clipboard.

### 🔄 3. Real-Time GitHub Auto-Sync (Instant Detection)
* Features a **🟢 Live Sync** engine that monitors your GitHub account in the background.
* Whenever you create a new repository on GitHub (via web, mobile, or CLI), it **automatically appears at the top of your browser in real time without refreshing**.

### 🚀 4. One-Click Project Upload & Publisher
* Drag and drop any `.zip` archive or project files into the **Upload Project** modal.
* Enter your repo name and visibility (Public or Private).
* DevSearch automatically initializes Git, creates the GitHub repository under your account, commits your files, and pushes to `main`.

### 🌪️ 5. Animated 60 FPS Tornado & Ship Background
* Full-screen Canvas background featuring a 3-masted galleon navigating a storm vortex.
* 260+ wind & debris particles spiraling along the tornado funnel.
* Rolling ocean waves, foaming crests, and dynamic branching lightning flashes.
* **Dark & Light Mode**: Smooth transition between Midnight Abyssal Storm and Daylight Coastal Tempest with frosted-glass UI.

---

## 🚀 Getting Started

### Prerequisites
* Python 3.10 or higher
* Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Subhadip24/DevSearch.git
   cd DevSearch
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure your GitHub Token:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your GitHub Personal Access Token (classic token with `repo` scope from [github.com/settings/tokens](https://github.com/settings/tokens)):
   ```env
   GITHUB_TOKEN=ghp_your_token_here
   ```
   *(Or simply connect your token directly via the web interface after launching).*

4. **Run the application:**
   ```bash
   python run.py
   ```
   *(On Windows, you can also double-click `start.bat`)*

5. Open your browser:
   👉 **`http://127.0.0.1:8000`**

---

## ☁️ Cloud Hosting

DevSearch can be deployed to any cloud platform in minutes:

### Deploy to Render
1. Create a new **Web Service** on [Render.com](https://render.com).
2. Connect this repository (`Subhadip24/DevSearch`).
3. Set the **Start Command**:
   ```bash
   uvicorn app:app --host 0.0.0.0 --port $PORT
   ```
4. Add the environment variable:
   * `GITHUB_TOKEN`: Your GitHub Personal Access Token.

### Deploy to Railway / Heroku
Using the included `Procfile`:
```
web: uvicorn app:app --host 0.0.0.0 --port $PORT
```

---

## 🛠️ Tech Stack

* **Backend**: FastAPI, Uvicorn, Requests, Python-Multipart, Jinja2
* **Frontend**: HTML5, CSS3 Glassmorphism, Vanilla JavaScript
* **Graphics**: HTML5 2D Canvas Physics Engine (60 FPS Tornado & Ship simulation)
* **Integration**: GitHub REST API v3

---

## 📄 License

MIT License © 2026 [Subhadip Mondal](https://github.com/Subhadip24)
