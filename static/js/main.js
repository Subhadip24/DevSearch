// ==========================================================================
// DevSearch & GitHub Hub - Client Application Logic
// ==========================================================================

const LANGUAGE_COLORS = {
    "Python": "#3572A5",
    "Java": "#b07219",
    "JavaScript": "#f1e05a",
    "TypeScript": "#3178c6",
    "HTML": "#e34c26",
    "CSS": "#563d7c",
    "C++": "#f34b7d",
    "C": "#555555",
    "C#": "#178600",
    "Go": "#00ADD8",
    "Rust": "#dea584",
    "PHP": "#4F5D95",
    "Ruby": "#701516",
    "Kotlin": "#A97BFF",
    "Swift": "#F05138",
    "Dart": "#00B4AB",
    "Shell": "#89e051"
};

// Global App State
let appState = {
    repositories: [],
    filteredRepositories: [],
    selectedLanguage: "all",
    selectedVisibility: "all",
    sortBy: "updated",
    searchMode: "github", // 'github' | 'web' | 'gh_all'
    user: null,
    isConfigured: false
};

// DOM Elements
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const searchBtn = document.getElementById("searchBtn");
const luckyBtn = document.getElementById("luckyBtn");
const repoGrid = document.getElementById("repoGrid");
const loadingIndicator = document.getElementById("loadingIndicator");
const emptyResults = document.getElementById("emptyResults");
const filtersSection = document.getElementById("filtersSection");
const repoCountStat = document.getElementById("repoCountStat");
const starsCountStat = document.getElementById("starsCountStat");
const forksCountStat = document.getElementById("forksCountStat");
const languageChips = document.getElementById("languageChips");
const visibilityFilter = document.getElementById("visibilityFilter");
const sortBy = document.getElementById("sortBy");
const unconfiguredBanner = document.getElementById("unconfiguredBanner");
const githubStatusLabel = document.getElementById("githubStatusLabel");
const searchModes = document.getElementById("searchModes");

// Initialize on Load
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    checkAuthStatus();
    initEventListeners();
});

// --------------------------------------------------------------------------
// Theme Handling (Dark / Light)
// --------------------------------------------------------------------------
function initTheme() {
    const savedTheme = localStorage.getItem("devsearch_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);

    document.getElementById("themeToggleBtn").addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", nextTheme);
        localStorage.setItem("devsearch_theme", nextTheme);
        updateThemeIcon(nextTheme);
    });
}

function updateThemeIcon(theme) {
    document.getElementById("themeIcon").textContent = theme === "dark" ? "☀️" : "🌙";
}

// --------------------------------------------------------------------------
// Event Listeners
// --------------------------------------------------------------------------
function initEventListeners() {
    // Search input live filtering
    searchInput.addEventListener("input", handleSearchInput);
    searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            executeSearch();
        }
    });

    clearSearchBtn.addEventListener("click", () => {
        searchInput.value = "";
        clearSearchBtn.style.display = "none";
        filterAndRenderRepos();
        searchInput.focus();
    });

    searchBtn.addEventListener("click", executeSearch);
    luckyBtn.addEventListener("click", handleLuckySearch);

    // Search Mode tabs
    searchModes.querySelectorAll(".mode-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            searchModes.querySelectorAll(".mode-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            appState.searchMode = tab.dataset.mode;
            updateSearchPlaceholder();
        });
    });

    // Filters and Sorting
    visibilityFilter.addEventListener("change", (e) => {
        appState.selectedVisibility = e.target.value;
        filterAndRenderRepos();
    });

    sortBy.addEventListener("change", (e) => {
        appState.sortBy = e.target.value;
        sortRepositories();
        renderRepositories();
    });

    document.getElementById("refreshReposBtn").addEventListener("click", () => {
        loadRepositories(true);
    });

    // Modals
    document.getElementById("openSettingsBtn").addEventListener("click", openSettingsModal);
    document.getElementById("openUploadBtn").addEventListener("click", openUploadModal);
    document.getElementById("saveTokenBtn").addEventListener("click", saveGitHubToken);

    // File Drag and Drop in Upload Modal
    setupDropZone();
}

function updateSearchPlaceholder() {
    if (appState.searchMode === "web") {
        searchInput.placeholder = "Search Google or type a URL...";
    } else if (appState.searchMode === "gh_all") {
        searchInput.placeholder = "Search all GitHub repositories, code, and users...";
    } else {
        searchInput.placeholder = "Search your repositories, languages, or projects...";
    }
}

// --------------------------------------------------------------------------
// Auth & Repositories Fetching
// --------------------------------------------------------------------------
async function checkAuthStatus() {
    try {
        const res = await fetch("/api/status");
        const data = await res.json();
        
        if (data.configured && data.user) {
            appState.isConfigured = true;
            appState.user = data.user;
            githubStatusLabel.textContent = `@${data.user.login}`;
            unconfiguredBanner.style.display = "none";
            loadRepositories();
        } else {
            appState.isConfigured = false;
            githubStatusLabel.textContent = "Connect GitHub";
            unconfiguredBanner.style.display = "flex";
            filtersSection.style.display = "none";
        }
    } catch (err) {
        console.error("Failed to check auth status:", err);
    }
}

async function loadRepositories(refresh = false) {
    loadingIndicator.style.display = "block";
    emptyResults.style.display = "none";
    repoGrid.innerHTML = "";

    try {
        const url = `/api/repos?refresh=${refresh}`;
        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to load repositories");
        }

        const data = await res.json();
        appState.repositories = data.repos;
        
        // Update stats
        repoCountStat.innerHTML = `<strong>${data.total_count}</strong> Repositories`;
        starsCountStat.innerHTML = `⭐ <strong>${data.total_stars}</strong> Stars`;
        forksCountStat.innerHTML = `🍴 <strong>${data.total_forks}</strong> Forks`;

        // Render Language Chips
        renderLanguageChips(data.top_languages, data.language_counts);

        filtersSection.style.display = "block";
        filterAndRenderRepos();
        startAutoSync();
    } catch (err) {
        console.error("Error loading repos:", err);
        repoGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <p class="text-danger">Failed to load repositories: ${err.message}</p>
                <button class="btn btn-primary" onclick="openSettingsModal()">Check GitHub Token</button>
            </div>
        `;
    } finally {
        loadingIndicator.style.display = "none";
    }
}

// --------------------------------------------------------------------------
// Language Chips & Filtering
// --------------------------------------------------------------------------
function renderLanguageChips(languages, counts) {
    languageChips.innerHTML = '<button class="chip active" data-lang="all">All</button>';
    
    languages.forEach(lang => {
        const count = counts[lang] || 0;
        const chip = document.createElement("button");
        chip.className = "chip";
        chip.dataset.lang = lang;
        chip.innerHTML = `${lang} <span style="opacity: 0.7; font-size: 11px;">(${count})</span>`;
        chip.addEventListener("click", () => {
            languageChips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            appState.selectedLanguage = lang;
            filterAndRenderRepos();
        });
        languageChips.appendChild(chip);
    });

    languageChips.querySelector('[data-lang="all"]').addEventListener("click", (e) => {
        languageChips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        e.currentTarget.classList.add("active");
        appState.selectedLanguage = "all";
        filterAndRenderRepos();
    });
}

// --------------------------------------------------------------------------
// Search and Rendering
// --------------------------------------------------------------------------
function handleSearchInput() {
    const query = searchInput.value.trim();
    clearSearchBtn.style.display = query ? "block" : "none";

    // If searching personal GitHub repos, filter in real-time
    if (appState.searchMode === "github") {
        filterAndRenderRepos();
    }
}

function executeSearch() {
    const query = searchInput.value.trim();

    if (appState.searchMode === "web") {
        if (query) {
            window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
        }
    } else if (appState.searchMode === "gh_all") {
        if (query) {
            window.open(`https://github.com/search?q=${encodeURIComponent(query)}`, "_blank");
        }
    } else {
        filterAndRenderRepos();
    }
}

function handleLuckySearch() {
    if (appState.searchMode === "web") {
        const query = searchInput.value.trim() || "Google";
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}&btnI=1`, "_blank");
        return;
    }

    if (!appState.repositories.length) {
        showToast("No repositories available. Connect your GitHub account!");
        return;
    }

    const randomRepo = appState.repositories[Math.floor(Math.random() * appState.repositories.length)];
    showToast(`Feeling lucky! Opening "${randomRepo.name}"...`);
    window.open(randomRepo.html_url, "_blank");
}

function filterAndRenderRepos() {
    const query = searchInput.value.toLowerCase().trim();
    
    appState.filteredRepositories = appState.repositories.filter(repo => {
        // Query text match
        const matchesQuery = !query || 
            repo.name.toLowerCase().includes(query) ||
            repo.description.toLowerCase().includes(query) ||
            (repo.language && repo.language.toLowerCase().includes(query)) ||
            (repo.topics && repo.topics.some(t => t.toLowerCase().includes(query)));

        // Language filter match
        const matchesLang = appState.selectedLanguage === "all" || repo.language === appState.selectedLanguage;

        // Visibility filter match
        let matchesVisibility = true;
        if (appState.selectedVisibility === "public") matchesVisibility = !repo.is_private;
        if (appState.selectedVisibility === "private") matchesVisibility = repo.is_private;

        return matchesQuery && matchesLang && matchesVisibility;
    });

    sortRepositories();
    renderRepositories();
}

function sortRepositories() {
    appState.filteredRepositories.sort((a, b) => {
        if (appState.sortBy === "stars") {
            return b.stars - a.stars;
        } else if (appState.sortBy === "name") {
            return a.name.localeCompare(b.name);
        } else {
            // recently updated
            return new Date(b.updated_at) - new Date(a.updated_at);
        }
    });
}

function renderRepositories() {
    const repos = appState.filteredRepositories;
    repoGrid.innerHTML = "";

    if (!repos.length) {
        emptyResults.style.display = "block";
        return;
    }

    emptyResults.style.display = "none";

    repos.forEach(repo => {
        const card = document.createElement("div");
        card.className = "repo-card";

        const langColor = LANGUAGE_COLORS[repo.language] || "#888888";
        const relativeTime = getRelativeTimeString(new Date(repo.updated_at));

        card.innerHTML = `
            <div>
                <div class="repo-header">
                    <div class="repo-title-wrapper">
                        <a href="javascript:void(0)" onclick="openCodeExplorer('${repo.owner}', '${repo.name}', '${repo.default_branch}')" class="repo-title" title="Directly access and explore project in your browser">${escapeHTML(repo.name)}</a>
                        <span class="repo-badge">${repo.is_private ? '🔒 Private' : 'Public'}</span>
                    </div>
                </div>
                <p class="repo-desc">${escapeHTML(repo.description)}</p>
            </div>
            <div>
                <div class="repo-footer">
                    <div class="repo-meta">
                        <span><span class="lang-dot" style="background-color: ${langColor};"></span>${escapeHTML(repo.language)}</span>
                        ${repo.stars > 0 ? `<span>⭐ ${repo.stars}</span>` : ''}
                        <span>Updated ${relativeTime}</span>
                    </div>
                    <div class="repo-actions-group">
                        <button class="btn-card-action btn-card-explore" onclick="openCodeExplorer('${repo.owner}', '${repo.name}', '${repo.default_branch}')" title="Directly access files in your browser">⚡ Direct Access</button>
                        <a href="https://github.dev/${repo.owner}/${repo.name}" target="_blank" rel="noopener" class="btn-card-action" title="Open VS Code in your browser">🌐 Web IDE</a>
                        <button class="btn-card-action" onclick="viewReadme('${repo.owner}', '${repo.name}')" title="Read README.md">📖 Readme</button>
                        <button class="btn-card-action" onclick="copyCloneCommand('${repo.clone_url}')" title="Copy git clone command">📋 Clone</button>
                    </div>
                </div>
            </div>
        `;
        repoGrid.appendChild(card);
    });
}

// --------------------------------------------------------------------------
// README Modal & Viewer
// --------------------------------------------------------------------------
async function viewReadme(owner, repo) {
    const modal = document.getElementById("readmeModal");
    const title = document.getElementById("readmeRepoTitle");
    const content = document.getElementById("readmeContent");
    const externalLink = document.getElementById("readmeExternalLink");

    title.textContent = `${owner} / ${repo}`;
    externalLink.href = `https://github.com/${owner}/${repo}`;
    content.innerHTML = '<div class="spinner"></div><p style="text-align:center;">Loading README...</p>';
    modal.classList.add("active");

    try {
        const res = await fetch(`/api/repo/${owner}/${repo}/readme`);
        const data = await res.json();
        content.innerHTML = data.html || "<p class='text-muted'>No README content found.</p>";
    } catch (err) {
        content.innerHTML = `<p class="text-danger">Failed to load README: ${err.message}</p>`;
    }
}

function closeReadmeModal() {
    document.getElementById("readmeModal").classList.remove("active");
}

// --------------------------------------------------------------------------
// Project Upload
// --------------------------------------------------------------------------
function setupDropZone() {
    const dropZone = document.getElementById("dropZone");
    const fileInput = document.getElementById("fileInput");

    dropZone.addEventListener("click", () => fileInput.click());

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleSelectedFile(fileInput.files[0]);
        }
    });

    fileInput.addEventListener("change", () => {
        if (fileInput.files.length) {
            handleSelectedFile(fileInput.files[0]);
        }
    });
}

function handleSelectedFile(file) {
    const selectedFileInfo = document.getElementById("selectedFileInfo");
    const selectedFileName = document.getElementById("selectedFileName");
    const projectNameInput = document.getElementById("projectNameInput");

    selectedFileName.textContent = `${file.name} (${formatBytes(file.size)})`;
    selectedFileInfo.style.display = "inline-flex";

    // Pre-fill project name if empty
    if (!projectNameInput.value) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
        projectNameInput.value = cleanName;
    }
}

function removeSelectedFile() {
    const fileInput = document.getElementById("fileInput");
    const selectedFileInfo = document.getElementById("selectedFileInfo");
    fileInput.value = "";
    selectedFileInfo.style.display = "none";
}

async function submitProjectUpload() {
    const form = document.getElementById("uploadForm");
    const nameInput = document.getElementById("projectNameInput");
    const descInput = document.getElementById("projectDescInput");
    const visibilityInput = document.getElementById("projectVisibility");
    const addReadmeInput = document.getElementById("addReadmeCheck");
    const fileInput = document.getElementById("fileInput");

    const errorDiv = document.getElementById("uploadError");
    const successDiv = document.getElementById("uploadSuccess");
    const progressBox = document.getElementById("uploadProgressBox");
    const progressBar = document.getElementById("progressBar");
    const statusText = document.getElementById("uploadStatusText");
    const submitBtn = document.getElementById("submitUploadBtn");

    errorDiv.style.display = "none";
    successDiv.style.display = "none";

    const name = nameInput.value.trim();
    if (!name) {
        errorDiv.textContent = "Please enter a project / repository name.";
        errorDiv.style.display = "block";
        return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", descInput.value.trim());
    formData.append("is_private", visibilityInput.value);
    formData.append("add_readme", addReadmeInput.checked);

    if (fileInput.files.length > 0) {
        formData.append("archive", fileInput.files[0]);
    }

    submitBtn.disabled = true;
    progressBox.style.display = "block";
    progressBar.style.width = "25%";
    statusText.textContent = "Creating GitHub repository...";

    try {
        setTimeout(() => { progressBar.style.width = "65%"; statusText.textContent = "Committing files and pushing to GitHub..."; }, 800);

        const res = await fetch("/api/upload", {
            method: "POST",
            body: formData
        });

        const data = await res.json();
        progressBar.style.width = "100%";

        if (!res.ok) {
            throw new Error(data.detail || "Upload failed");
        }

        statusText.textContent = "Done! Repository is live.";
        successDiv.innerHTML = `
            <strong>Success!</strong> ${data.message}
            <div style="margin-top: 8px;">
                <a href="${data.repo.html_url}" target="_blank" class="btn btn-sm btn-primary">Open ${data.repo.name} on GitHub ↗</a>
            </div>
        `;
        successDiv.style.display = "block";

        // Refresh repos list
        loadRepositories(true);
        showToast(`Repository "${name}" created on GitHub!`);

    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = "block";
        progressBar.style.backgroundColor = "var(--google-red)";
    } finally {
        submitBtn.disabled = false;
    }
}

function openUploadModal() {
    if (!appState.isConfigured) {
        openSettingsModal();
        showToast("Please connect your GitHub account first!");
        return;
    }
    document.getElementById("uploadError").style.display = "none";
    document.getElementById("uploadSuccess").style.display = "none";
    document.getElementById("uploadProgressBox").style.display = "none";
    document.getElementById("uploadModal").classList.add("active");
}

function closeUploadModal() {
    document.getElementById("uploadModal").classList.remove("active");
}

// --------------------------------------------------------------------------
// Settings & Token Modal
// --------------------------------------------------------------------------
function openSettingsModal() {
    const modal = document.getElementById("settingsModal");
    const userBox = document.getElementById("currentUserBox");
    const tokenInput = document.getElementById("githubTokenInput");
    const errorDiv = document.getElementById("settingsError");
    const successDiv = document.getElementById("settingsSuccess");

    errorDiv.style.display = "none";
    successDiv.style.display = "none";

    if (appState.user) {
        document.getElementById("userAvatar").src = appState.user.avatar_url;
        document.getElementById("userName").textContent = appState.user.name;
        document.getElementById("userLogin").textContent = `@${appState.user.login}`;
        userBox.style.display = "flex";
    } else {
        userBox.style.display = "none";
    }

    modal.classList.add("active");
    tokenInput.focus();
}

function closeSettingsModal() {
    document.getElementById("settingsModal").classList.remove("active");
}

function toggleTokenVisibility() {
    const tokenInput = document.getElementById("githubTokenInput");
    tokenInput.type = tokenInput.type === "password" ? "text" : "password";
}

async function saveGitHubToken() {
    const tokenInput = document.getElementById("githubTokenInput");
    const saveBtn = document.getElementById("saveTokenBtn");
    const errorDiv = document.getElementById("settingsError");
    const successDiv = document.getElementById("settingsSuccess");

    errorDiv.style.display = "none";
    successDiv.style.display = "none";

    const token = tokenInput.value.trim();
    if (!token) {
        errorDiv.textContent = "Please enter your GitHub token.";
        errorDiv.style.display = "block";
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Verifying...";

    try {
        const res = await fetch("/api/settings/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: token })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "Failed to verify token");
        }

        successDiv.textContent = data.message;
        successDiv.style.display = "block";
        tokenInput.value = "";

        // Reload user info and repositories
        await checkAuthStatus();
        showToast("GitHub account connected successfully!");

        setTimeout(() => {
            closeSettingsModal();
        }, 1200);

    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = "block";
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save & Connect";
    }
}

// --------------------------------------------------------------------------
// In-Browser Direct Code & Project Explorer
// --------------------------------------------------------------------------
let explorerState = {
    owner: "",
    repo: "",
    currentPath: "",
    activeFileContent: ""
};

async function openCodeExplorer(owner, repo, defaultBranch = "main") {
    explorerState.owner = owner;
    explorerState.repo = repo;
    explorerState.currentPath = "";
    explorerState.activeFileContent = "";

    document.getElementById("explorerRepoTitle").textContent = `${owner} / ${repo}`;
    document.getElementById("explorerBranchTag").textContent = defaultBranch || "main";
    document.getElementById("explorerWebIdeBtn").href = `https://github.dev/${owner}/${repo}`;
    document.getElementById("explorerDownloadZipBtn").href = `https://github.com/${owner}/${repo}/archive/refs/heads/${defaultBranch || 'main'}.zip`;

    // Reset viewer
    document.getElementById("activeFileName").textContent = "Select a file to inspect";
    document.getElementById("activeFileSize").textContent = "";
    document.getElementById("fileViewerActions").style.display = "none";
    document.getElementById("codeViewerContainer").innerHTML = `
        <div class="empty-code-placeholder">
            <div style="font-size: 32px; margin-bottom: 8px;">💻</div>
            <p>Select any code or documentation file on the left to preview it directly in your browser.</p>
        </div>
    `;

    document.getElementById("codeExplorerModal").classList.add("active");
    await loadExplorerPath("");
}

function closeCodeExplorerModal() {
    document.getElementById("codeExplorerModal").classList.remove("active");
}

async function loadExplorerPath(path) {
    explorerState.currentPath = path;
    renderBreadcrumbs(path);
    const tree = document.getElementById("explorerTree");
    tree.innerHTML = '<div class="spinner-sm"></div>';

    try {
        const res = await fetch(`/api/repo/${explorerState.owner}/${explorerState.repo}/contents?path=${encodeURIComponent(path)}`);
        const data = await res.json();

        if (data.empty) {
            tree.innerHTML = `
                <div class="empty-repo-box">
                    <p style="font-size: 28px; margin-bottom: 6px;">📂</p>
                    <p class="text-muted" style="font-size: 13px;">This repository is empty.</p>
                    <button class="btn btn-sm btn-primary" style="margin-top: 10px;" onclick="closeCodeExplorerModal(); openUploadModal();">+ Upload Code Now</button>
                </div>
            `;
            return;
        }

        tree.innerHTML = "";

        // Back to parent folder item if inside a subfolder
        if (path) {
            const parentPath = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
            const upItem = document.createElement("div");
            upItem.className = "tree-item";
            upItem.innerHTML = `<span class="tree-item-icon">📁</span> <span class="tree-item-name">.. (back)</span>`;
            upItem.onclick = () => loadExplorerPath(parentPath);
            tree.appendChild(upItem);
        }

        data.items.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "tree-item";
            const icon = item.type === "dir" ? "📁" : getFileIcon(item.name);
            itemEl.innerHTML = `
                <span class="tree-item-icon">${icon}</span>
                <span class="tree-item-name">${escapeHTML(item.name)}</span>
                ${item.type === "file" ? `<span class="tree-item-size">${formatBytes(item.size)}</span>` : ""}
            `;

            if (item.type === "dir") {
                itemEl.onclick = () => loadExplorerPath(item.path);
            } else {
                itemEl.onclick = () => {
                    tree.querySelectorAll(".tree-item").forEach(t => t.classList.remove("active"));
                    itemEl.classList.add("active");
                    viewFile(item.path, item.name, item.size, item.download_url);
                };
            }
            tree.appendChild(itemEl);
        });

    } catch (err) {
        tree.innerHTML = `<p class="text-danger" style="padding: 10px;">Error loading contents: ${err.message}</p>`;
    }
}

async function viewFile(path, name, size, downloadUrl) {
    const headerTitle = document.getElementById("activeFileName");
    const headerSize = document.getElementById("activeFileSize");
    const actions = document.getElementById("fileViewerActions");
    const container = document.getElementById("codeViewerContainer");
    const rawBtn = document.getElementById("rawFileBtn");

    headerTitle.textContent = path;
    headerSize.textContent = `(${formatBytes(size)})`;
    actions.style.display = "flex";
    rawBtn.href = downloadUrl || "#";
    container.innerHTML = '<div class="spinner-sm"></div><p style="text-align: center; color: var(--text-muted); font-size: 13px;">Loading file...</p>';

    try {
        const res = await fetch(`/api/repo/${explorerState.owner}/${explorerState.repo}/file?path=${encodeURIComponent(path)}`);
        const data = await res.json();

        explorerState.activeFileContent = data.content;

        // Render code
        container.innerHTML = `
            <pre class="code-pre"><code id="codeViewerText">${escapeHTML(data.content)}</code></pre>
        `;
    } catch (err) {
        container.innerHTML = `<p class="text-danger" style="padding: 20px;">Failed to load file: ${err.message}</p>`;
    }
}

function copyCurrentFileContent() {
    if (explorerState.activeFileContent) {
        navigator.clipboard.writeText(explorerState.activeFileContent).then(() => {
            showToast("File content copied to clipboard!");
        });
    }
}

function renderBreadcrumbs(path) {
    const breadcrumbs = document.getElementById("explorerBreadcrumbs");
    breadcrumbs.innerHTML = "";

    const rootItem = document.createElement("span");
    rootItem.className = "breadcrumb-item";
    rootItem.textContent = "root";
    rootItem.onclick = () => loadExplorerPath("");
    breadcrumbs.appendChild(rootItem);

    if (!path) return;

    const parts = path.split("/");
    let accum = "";
    parts.forEach((part, index) => {
        accum += (accum ? "/" : "") + part;
        const currentAccum = accum;

        const sep = document.createElement("span");
        sep.className = "breadcrumb-sep";
        sep.textContent = " / ";
        breadcrumbs.appendChild(sep);

        const item = document.createElement("span");
        item.className = "breadcrumb-item";
        item.textContent = part;
        if (index < parts.length - 1) {
            item.onclick = () => loadExplorerPath(currentAccum);
        }
        breadcrumbs.appendChild(item);
    });
}

function getFileIcon(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    switch (ext) {
        case "py": return "🐍";
        case "java": return "☕";
        case "js": case "jsx": return "📜";
        case "ts": case "tsx": return "📘";
        case "html": return "🌐";
        case "css": return "🎨";
        case "json": return "📋";
        case "md": return "📝";
        case "csv": return "📊";
        case "ipynb": return "📓";
        case "png": case "jpg": case "svg": case "gif": return "🖼️";
        case "zip": case "tar": case "gz": return "📦";
        default: return "📄";
    }
}

// --------------------------------------------------------------------------
// Real-time GitHub Auto-Sync (Instant Detection of New Repositories)
// --------------------------------------------------------------------------
let autoSyncInterval = null;
let isSyncing = false;

function startAutoSync() {
    if (autoSyncInterval) clearInterval(autoSyncInterval);

    // Poll every 12 seconds in the background
    autoSyncInterval = setInterval(checkForNewRepos, 12000);

    // Trigger instant sync whenever the user switches back to this browser tab
    window.addEventListener("focus", () => checkForNewRepos(true));
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            checkForNewRepos(true);
        }
    });
}

async function checkForNewRepos(force = false) {
    if (isSyncing || !appState.isConfigured || !appState.repositories.length) return;
    isSyncing = true;

    const syncText = document.getElementById("syncText");
    if (syncText) syncText.textContent = "Syncing...";

    try {
        const knownIds = appState.repositories.map(r => r.id);
        const res = await fetch("/api/repos/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ known_ids: knownIds })
        });

        if (res.ok) {
            const data = await res.json();
            if (data.has_new && data.new_repos && data.new_repos.length > 0) {
                // New repos found on GitHub!
                data.new_repos.forEach(newRepo => {
                    showToast(`✨ New GitHub Project Detected: "${newRepo.name}" added to your browser!`);
                    // Prepend to repositories list so it appears at top
                    appState.repositories.unshift(newRepo);
                });

                // Update stats and re-render
                repoCountStat.innerHTML = `<strong>${data.total_count}</strong> Repositories`;
                filterAndRenderRepos();

                // Highlight newly added repo cards with a glowing pulse
                setTimeout(() => {
                    const firstCards = repoGrid.querySelectorAll(".repo-card");
                    for (let i = 0; i < Math.min(data.new_repos.length, firstCards.length); i++) {
                        firstCards[i].classList.add("new-repo-pulse");
                    }
                }, 100);
            }
        }
    } catch (err) {
        console.warn("Auto-sync check error:", err);
    } finally {
        isSyncing = false;
        if (syncText) syncText.textContent = "Live Sync";
    }
}

// --------------------------------------------------------------------------
// Utilities
// --------------------------------------------------------------------------
function copyCloneCommand(cloneUrl) {
    const cmd = `git clone ${cloneUrl}`;
    navigator.clipboard.writeText(cmd).then(() => {
        showToast(`Copied: ${cmd}`);
    }).catch(() => {
        prompt("Copy this git clone command:", cmd);
    });
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function formatBytes(bytes, decimals = 1) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function getRelativeTimeString(date) {
    const now = new Date();
    const diffSeconds = Math.round((now - date) / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffDays > 30) {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } else if (diffDays > 0) {
        return `${diffDays}d ago`;
    } else if (diffHours > 0) {
        return `${diffHours}h ago`;
    } else if (diffMinutes > 0) {
        return `${diffMinutes}m ago`;
    } else {
        return 'just now';
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

