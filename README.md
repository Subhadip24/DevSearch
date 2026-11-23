# 🌊 DevSearch - Personal Google & GitHub Project Hub

[![Live Demo](https://img.shields.io/badge/🌐_Live_Website-GitHub_Pages-2ea44f?style=for-the-badge)](https://subhadip24.github.io/DevSearch/)
[![GitHub](https://img.shields.io/badge/GitHub-Subhadip24-181717?style=flat&logo=github)](https://github.com/Subhadip24)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python)](https://www.python.org/)

> 🚀 **Live Hosted Link:** **[https://subhadip24.github.io/DevSearch/](https://subhadip24.github.io/DevSearch/)**

**DevSearch** is a personalized, Google-style developer portal and project hub. It lets you explore, manage, search, and upload all your code projects seamlessly, combined with real-time GitHub synchronization and a 60 FPS animated sea-storm background.

---

## 🌐 Live Website

Experience DevSearch directly on GitHub Pages with zero setup:
👉 **[https://subhadip24.github.io/DevSearch/](https://subhadip24.github.io/DevSearch/)**

* ⚡ **100% Serverless**: Runs completely in the browser via GitHub REST API.
* 🌓 **Dark & Light Mode**: Seamless atmospheric transitions.
* 🌪️ **60 FPS Physics Engine**: Interactive tornado vortex & moving ship animation.
* 💻 **Direct Code Exploration**: Read files, explore trees, and launch Web VS Code in 1 click!

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

### 📜 6. Dynamic CV on the Sailing Ship
* **Real-Time Ship Pinning**: A golden parchment CV badge is tethered to the mainmast of the 3-masted ship, floating, bobbing, and tracking the ship's coordinate trajectory in real-time across the tornado canvas.
* **Interactive CV Modal**: Click the moving ship or its badge to view Subhadip Mondal's full developer CV—education (Techno India University), COMSYS Hackathon 7 Championship (Rank #1, Team Vic-Trio), technical skills, contact info, and custom PDF upload/print support.

### 📊 7. GitHub Live Stats & Activity Insights
* Direct header access to personal GitHub analytics via **"📊 Stats"**.
* Dynamic theme-synced cards (Radical Dark / GitHub Light) showcasing total stars, commits, PRs, issues, current streaks, and language breakdown.

### 🛡️ 8. Zero-History Private Web Search
* **Private Web Mode**: Instant DuckDuckGo search integration that never saves search terms or browsing logs.
* **Google History Suppression**: Query execution passes `pws=0` (disables Google web history personalization) with `rel="noopener noreferrer"`.
* **Form Cache Shield**: Inputs configured with `autocomplete="new-password"`, `spellcheck="false"`, and `data-lpignore="true"` to prevent local browser caching of search queries.

---

## 🚀 Running Locally

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
   *(Or connect your token directly via the web interface after launching).*

4. **Run the application:**
   ```bash
   python run.py
   ```
   *(On Windows, simply double-click `start.bat`)*

5. Open your browser:
   👉 **`http://127.0.0.1:8000`**

---

## ☁️ Cloud & Platform Hosting

### 1. GitHub Pages (Static / Serverless)
DevSearch includes full client-side hybrid capability:
* Repository root includes `index.html` configured for GitHub Pages.
* Enable Pages in **Settings** → **Pages** → Source: **Deploy from a branch (`main` or `gh-pages`)**.
* Live at: `https://subhadip24.github.io/DevSearch/`

### 2. Full-Stack on Render.com
1. Create a new **Web Service** on [Render.com](https://render.com).
2. Connect `Subhadip24/DevSearch`.
3. Set the **Start Command**:
   ```bash
   uvicorn app:app --host 0.0.0.0 --port $PORT
   ```
4. Set the environment variable `GITHUB_TOKEN`.

---

## 🛠️ Tech Stack

* **Frontend**: HTML5, CSS3 Glassmorphism, Vanilla JavaScript ES6+
* **Backend**: FastAPI, Uvicorn, Requests, Python-Multipart, Jinja2
* **Graphics**: HTML5 2D Canvas Physics Engine (60 FPS Tornado & Ship simulation)
* **API**: GitHub REST API v3
* **Hosting**: GitHub Pages

---

## 📄 License

MIT License © 2026 [Subhadip Mondal](https://github.com/Subhadip24)
