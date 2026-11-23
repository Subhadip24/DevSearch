// ==========================================================================
// DevSearch: AI Voice Agent & Autonomous Automation Controller
// Provides continuous Speech Recognition, Text-to-Speech (TTS), Web Audio chimes,
// and natural spoken command parsing to automate all aspects of DevSearch.
// ==========================================================================

(function() {
    'use strict';

    // State
    const voiceState = {
        isSupported: false,
        isListening: false,
        isSpeaking: false,
        isMuted: localStorage.getItem('devsearch_voice_muted') === 'true',
        autoRestart: false,
        recognition: null,
        synth: window.speechSynthesis || null,
        selectedVoice: null,
        audioContext: null
    };

    // DOM Element References (wired on init)
    let micSearchBtn = null;
    let voiceDockBtn = null;
    let voiceHud = null;
    let voiceTranscriptText = null;
    let voiceReplyText = null;
    let voiceVisualizer = null;
    let voiceStatusText = null;
    let voiceCommandsModal = null;

    // ----------------------------------------------------------------------
    // Web Audio Chimes (Synthesized - zero external file dependencies)
    // ----------------------------------------------------------------------
    function getAudioContext() {
        if (!voiceState.audioContext) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) voiceState.audioContext = new AudioCtx();
        }
        if (voiceState.audioContext && voiceState.audioContext.state === 'suspended') {
            voiceState.audioContext.resume();
        }
        return voiceState.audioContext;
    }

    function playChime(type) {
        if (voiceState.isMuted && type !== 'toggle') return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'start') {
                // Friendly high-tech rising chirp (440Hz -> 880Hz)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.14);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                osc.start(now);
                osc.stop(now + 0.22);
            } else if (type === 'success') {
                // Dual chord confirmation (D5 + A5)
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(587.33, now);
                osc.frequency.setValueAtTime(880, now + 0.08);
                gain.gain.setValueAtTime(0.07, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
                osc.start(now);
                osc.stop(now + 0.28);
            } else if (type === 'lightning') {
                // Low rumble thunder synth
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(140, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.45);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                osc.start(now);
                osc.stop(now + 0.5);
            } else if (type === 'error') {
                // Soft falling buzz
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(320, now);
                osc.frequency.exponentialRampToValueAtTime(180, now + 0.2);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                osc.start(now);
                osc.stop(now + 0.22);
            }
        } catch (e) {
            // AudioContext gesture rules may suppress autoplay, safe to ignore
        }
    }

    // ----------------------------------------------------------------------
    // Speech Synthesis (Text-to-Speech)
    // ----------------------------------------------------------------------
    function initVoices() {
        if (!voiceState.synth) return;
        const loadVoices = () => {
            const voices = voiceState.synth.getVoices();
            if (!voices || voices.length === 0) return;
            // Prefer natural English voices
            voiceState.selectedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('David') || v.name.includes('Guy'))) 
                || voices.find(v => v.lang.startsWith('en')) 
                || voices[0];
        };
        loadVoices();
        if (voiceState.synth.onvoiceschanged !== undefined) {
            voiceState.synth.onvoiceschanged = loadVoices;
        }
    }

    function speak(text, onComplete) {
        setAgentReply(text);
        if (voiceState.isMuted || !voiceState.synth) {
            if (onComplete) onComplete();
            return;
        }

        try {
            voiceState.synth.cancel(); // Stop any pending speech
            const utterance = new SpeechSynthesisUtterance(text);
            if (voiceState.selectedVoice) {
                utterance.voice = voiceState.selectedVoice;
            }
            utterance.rate = 1.05;
            utterance.pitch = 1.0;

            utterance.onstart = () => {
                voiceState.isSpeaking = true;
                updateVisualizer(true);
            };

            utterance.onend = () => {
                voiceState.isSpeaking = false;
                updateVisualizer(false);
                if (onComplete) onComplete();
            };

            utterance.onerror = () => {
                voiceState.isSpeaking = false;
                updateVisualizer(false);
                if (onComplete) onComplete();
            };

            voiceState.synth.speak(utterance);
        } catch (e) {
            console.warn("TTS error:", e);
            if (onComplete) onComplete();
        }
    }

    // ----------------------------------------------------------------------
    // Speech Recognition Setup
    // ----------------------------------------------------------------------
    function initRecognition() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            voiceState.isSupported = false;
            console.info("Web Speech Recognition API is not supported in this browser.");
            return;
        }

        voiceState.isSupported = true;
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onstart = () => {
            voiceState.isListening = true;
            updateListeningUI(true);
            playChime('start');
            setStatus("Listening... Speak a command or search query");
        };

        rec.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (interimTranscript) {
                setUserTranscript(`🗣️ "${interimTranscript.trim()}..."`);
            }

            if (finalTranscript) {
                const cleanText = finalTranscript.trim();
                setUserTranscript(`🗣️ "${cleanText}"`);
                handleSpokenCommand(cleanText);
            }
        };

        rec.onerror = (event) => {
            if (event.error === 'no-speech') {
                setStatus("No speech detected. Listening...");
                return;
            }
            console.warn("Speech recognition error:", event.error);
            if (event.error === 'not-allowed') {
                setStatus("Microphone access denied. Please allow microphone permissions.");
                stopListening();
            } else {
                setStatus(`Voice error: ${event.error}`);
            }
        };

        rec.onend = () => {
            if (voiceState.autoRestart && voiceState.isListening) {
                // Restart automatically for continuous hands-free automation
                try {
                    rec.start();
                } catch (e) {
                    voiceState.isListening = false;
                    updateListeningUI(false);
                }
            } else {
                voiceState.isListening = false;
                updateListeningUI(false);
                setStatus("Voice Agent idle. Click mic or press Ctrl+M");
            }
        };

        voiceState.recognition = rec;
    }

    function startListening() {
        if (!voiceState.isSupported) {
            alert("Speech recognition is not supported in this browser. Please try Chrome, Edge, or a Web Speech API compatible browser.");
            return;
        }
        if (voiceState.isListening) return;

        voiceState.autoRestart = true;
        try {
            voiceState.recognition.start();
            openHud();
        } catch (e) {
            console.warn("Recognition start failed:", e);
        }
    }

    function stopListening() {
        voiceState.autoRestart = false;
        voiceState.isListening = false;
        if (voiceState.recognition) {
            try {
                voiceState.recognition.stop();
            } catch (e) {}
        }
        updateListeningUI(false);
        setStatus("Voice Agent stopped.");
    }

    function toggleListening() {
        if (voiceState.isListening) {
            stopListening();
            speak("Voice agent paused.");
        } else {
            startListening();
        }
    }

    // ----------------------------------------------------------------------
    // Natural Spoken Command Dispatcher ("Automate Everything")
    // ----------------------------------------------------------------------
    function handleSpokenCommand(rawText) {
        const text = rawText.toLowerCase().replace(/[.,?!]/g, '').trim();
        console.log("Voice Agent recognized command:", text);
        playChime('success');

        // 1. GREETINGS & SELF-IDENTIFICATION
        if (/^(hi|hello|hey|hey devsearch|greetings)\b/i.test(text)) {
            speak("Hello! I am DevSearch Voice Copilot. What would you like me to do? You can say 'Open my CV', 'Search for Java', 'Switch to dark mode', or 'Show stats'.");
            return;
        }

        if (/(who are you|what are you|who made this|about voice agent)/i.test(text)) {
            speak("I am DevSearch Voice Agent, an autonomous copilot built for Subhadip Mondal's developer portal. I can automate your searches, explore GitHub projects, launch Web VS Code, and control the atmospheric cyclone.");
            return;
        }

        // 2. HELP & COMMANDS CHEATSHEET
        if (/(help|show commands|what can you do|voice commands|command list)/i.test(text)) {
            openCommandsModal();
            speak("Here are all the automated voice commands you can speak. Try saying: 'Open my CV', 'Show stats', 'Search for Python', or 'Dark mode'.");
            return;
        }

        // 3. CV & RESUME AUTOMATION
        if (/(open|show|display|view)\s+(?:my\s+)?(cv|resume|credentials|profile)/i.test(text)) {
            if (typeof window.openCvModal === 'function') window.openCvModal();
            speak("Opening Subhadip's interactive CV, showcasing education at Techno India University and COMSYS Hackathon 7 Championship honors.");
            return;
        }

        if (/(close|hide|dismiss)\s+(?:my\s+)?(cv|resume)/i.test(text)) {
            if (typeof window.closeCvModal === 'function') window.closeCvModal();
            speak("Closed CV modal.");
            return;
        }

        if (/(print|download|save|export)\s+(?:my\s+)?(cv|resume)/i.test(text)) {
            if (typeof window.openCvModal === 'function') window.openCvModal();
            setTimeout(() => { window.print(); }, 400);
            speak("Opening print and PDF save dialog for Subhadip's CV.");
            return;
        }

        // 4. GITHUB STATS MODAL
        if (/(open|show|display|view)\s+(?:github\s+)?(stats|statistics|analytics|streak)/i.test(text)) {
            if (typeof window.openStatsModal === 'function') window.openStatsModal();
            speak("Opening live GitHub stats and streak analytics.");
            return;
        }

        if (/(close|hide|dismiss)\s+(?:github\s+)?(stats|statistics)/i.test(text)) {
            if (typeof window.closeStatsModal === 'function') window.closeStatsModal();
            speak("Closed GitHub stats modal.");
            return;
        }

        // 5. PROJECT UPLOAD & SETTINGS MODALS
        if (/(upload|add|new)\s+(?:a\s+)?(project|repository|repo|code)/i.test(text)) {
            if (typeof window.openUploadModal === 'function') window.openUploadModal();
            speak("Opening project upload modal. You can drag and drop your project ZIP or files here.");
            return;
        }

        if (/(close|hide)\s+upload/i.test(text)) {
            if (typeof window.closeUploadModal === 'function') window.closeUploadModal();
            speak("Closed upload modal.");
            return;
        }

        if (/(open|show)\s+(settings|token|github account|connect github)/i.test(text)) {
            if (typeof window.openSettingsModal === 'function') window.openSettingsModal();
            speak("Opening settings to configure your GitHub Personal Access Token.");
            return;
        }

        if (/(close|hide)\s+settings/i.test(text)) {
            if (typeof window.closeSettingsModal === 'function') window.closeSettingsModal();
            speak("Closed settings modal.");
            return;
        }

        // 6. SYNC & REFRESH REPOSITORIES
        if (/(sync|refresh|update|reload)\s+(repositories|repos|projects|data)/i.test(text)) {
            if (typeof window.loadRepositories === 'function') {
                window.loadRepositories(true);
                speak("Refreshing and synchronizing all repositories directly from GitHub in real time.");
            }
            return;
        }

        // 7. I'M FEELING LUCKY / RANDOM PROJECT
        if (/(i'm feeling lucky|lucky|random project|surprise me|pick a project)/i.test(text)) {
            speak("Picking a lucky project from Subhadip's portfolio!");
            if (typeof window.handleLuckySearch === 'function') window.handleLuckySearch();
            return;
        }

        // 8. THEME & CYCLONE ATMOSPHERICS
        if (/(dark mode|night mode|lights off|turn off lights|abyssal mode)/i.test(text)) {
            if (typeof window.toggleTheme === 'function') window.toggleTheme('dark');
            speak("Switched to dark storm mode.");
            return;
        }

        if (/(light mode|day mode|lights on|turn on lights|daylight)/i.test(text)) {
            if (typeof window.toggleTheme === 'function') window.toggleTheme('light');
            speak("Switched to daylight tempest mode.");
            return;
        }

        if (/(toggle theme|switch theme|change theme)/i.test(text)) {
            const next = typeof window.toggleTheme === 'function' ? window.toggleTheme() : 'dark';
            speak(`Switched theme to ${next} mode.`);
            return;
        }

        if (/(lightning|strike lightning|thunder|thunderstorm|storm surge|strike)/i.test(text)) {
            if (typeof window.triggerStormLightning === 'function') {
                window.triggerStormLightning();
                playChime('lightning');
            }
            speak("Summoning cyclone lightning strike!");
            return;
        }

        // 9. SCROLLING & VIEW NAVIGATION
        if (/(scroll down|view projects|show projects|go to projects)/i.test(text)) {
            const target = document.getElementById('filtersSection') || document.getElementById('repoGrid');
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
                speak("Scrolling down to your repositories.");
            }
            return;
        }

        if (/(scroll up|scroll to top|back to top|top of page)/i.test(text)) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            speak("Scrolling back to top.");
            return;
        }

        // 10. SEARCH AUTOMATION MODES & QUERIES
        // Private search (DuckDuckGo zero-history)
        const privMatch = text.match(/(?:private search|incognito search|secure search|private web)\s+(?:for\s+)?(.+)/i);
        if (privMatch) {
            const query = privMatch[1].trim();
            performVoiceSearch('private_web', query);
            speak(`Searching privately for ${query} with zero history logging.`);
            return;
        }

        // Google clean search
        const googleMatch = text.match(/(?:google search|google)\s+(?:for\s+)?(.+)/i);
        if (googleMatch) {
            const query = googleMatch[1].trim();
            performVoiceSearch('web', query);
            speak(`Opening Google search for ${query} with history disabled.`);
            return;
        }

        // GitHub global search
        const ghAllMatch = text.match(/(?:search all github|global search|github search)\s+(?:for\s+)?(.+)/i);
        if (ghAllMatch) {
            const query = ghAllMatch[1].trim();
            performVoiceSearch('gh_all', query);
            speak(`Searching all public code and repositories on GitHub for ${query}.`);
            return;
        }

        // Clear search
        if (/(clear search|reset search|show all repos|show all projects)/i.test(text)) {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = '';
                const clearBtn = document.getElementById('clearSearchBtn');
                if (clearBtn) clearBtn.style.display = 'none';
            }
            if (typeof window.filterByLanguage === 'function') window.filterByLanguage('all');
            speak("Cleared search and restored all repositories.");
            return;
        }

        // General project search: "search for [query]" or "search [query]"
        const searchMatch = text.match(/^(?:search for|search|find|filter by title)\s+(.+)/i);
        if (searchMatch) {
            const query = searchMatch[1].trim();
            performVoiceSearch('github', query);
            speak(`Searching your repositories for ${query}.`);
            return;
        }

        // 11. PROGRAMMING LANGUAGE FILTERS
        const langMatch = text.match(/(?:filter by|show only|filter language|language)\s+(python|java|javascript|typescript|html|css|c\+\+|c|rust|go|php|ruby|kotlin|swift|dart|shell)/i);
        if (langMatch) {
            const lang = langMatch[1];
            if (typeof window.filterByLanguage === 'function') {
                window.filterByLanguage(lang);
                speak(`Filtering projects by programming language ${lang}.`);
            }
            return;
        }

        // 12. PROJECT-SPECIFIC ACTIONS (Direct Code Access, Web IDE, Readme, Clone)
        // Find matching repo in appState.repositories
        if (window.appState && window.appState.repositories && window.appState.repositories.length > 0) {
            const repos = window.appState.repositories;

            // Direct Access: "open project [name]" or "explore [name]"
            const exploreMatch = text.match(/(?:open project|explore|view code for|open code for|access)\s+(.+)/i);
            if (exploreMatch) {
                const query = exploreMatch[1].trim().toLowerCase();
                const matchedRepo = findBestRepoMatch(repos, query);
                if (matchedRepo && typeof window.openCodeExplorer === 'function') {
                    window.openCodeExplorer(matchedRepo.owner, matchedRepo.name, matchedRepo.default_branch);
                    speak(`Opening Direct Access code explorer for ${matchedRepo.name}.`);
                    return;
                }
            }

            // Web IDE: "web ide for [name]" or "vs code for [name]" or "code [name]"
            const ideMatch = text.match(/(?:web ide|vs code|code)\s+(?:for\s+)?(.+)/i);
            if (ideMatch) {
                const query = ideMatch[1].trim().toLowerCase();
                const matchedRepo = findBestRepoMatch(repos, query);
                if (matchedRepo) {
                    window.open(`https://github.dev/${matchedRepo.owner}/${matchedRepo.name}`, '_blank', 'noopener');
                    speak(`Launching full Web VS Code for ${matchedRepo.name} in a new tab.`);
                    return;
                }
            }

            // Readme: "readme for [name]" or "show readme [name]"
            const readmeMatch = text.match(/(?:readme|read me)\s+(?:for\s+)?(.+)/i);
            if (readmeMatch) {
                const query = readmeMatch[1].trim().toLowerCase();
                const matchedRepo = findBestRepoMatch(repos, query);
                if (matchedRepo && typeof window.viewReadme === 'function') {
                    window.viewReadme(matchedRepo.owner, matchedRepo.name);
                    speak(`Opening rendered README documentation for ${matchedRepo.name}.`);
                    return;
                }
            }

            // Clone: "clone [name]" or "copy clone for [name]"
            const cloneMatch = text.match(/(?:clone|copy clone link)\s+(?:for\s+)?(.+)/i);
            if (cloneMatch) {
                const query = cloneMatch[1].trim().toLowerCase();
                const matchedRepo = findBestRepoMatch(repos, query);
                if (matchedRepo && typeof window.copyCloneCommand === 'function') {
                    window.copyCloneCommand(matchedRepo.clone_url);
                    speak(`Copied git clone command for ${matchedRepo.name} to your clipboard.`);
                    return;
                }
            }
        }

        // 13. VOICE AGENT CONTROLS
        if (/(mute voice|mute assistant|be quiet|silence)/i.test(text)) {
            setMute(true);
            speak("Voice feedback muted.");
            return;
        }

        if (/(unmute voice|unmute assistant|enable voice)/i.test(text)) {
            setMute(false);
            speak("Voice feedback enabled.");
            return;
        }

        if (/(stop listening|go to sleep|sleep|pause voice|goodbye)/i.test(text)) {
            stopListening();
            speak("Voice Agent going to sleep. Click the microphone or press Control M whenever you need me.");
            return;
        }

        // 14. FALLBACK: Treat as a search query if text has substance
        if (text.length > 2) {
            performVoiceSearch('github', text);
            speak(`Searching for ${text}.`);
            return;
        }

        playChime('error');
        speak("I didn't quite catch that command. Say 'help' or 'commands' to see everything I can do.");
    }

    // Helper: Execute Search
    function performVoiceSearch(mode, query) {
        if (typeof window.selectSearchMode === 'function') {
            window.selectSearchMode(mode);
        }
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = query;
            const clearBtn = document.getElementById('clearSearchBtn');
            if (clearBtn) clearBtn.style.display = 'block';
        }
        if (typeof window.executeSearch === 'function') {
            window.executeSearch();
        }
    }

    // Helper: Fuzzy matching repository names
    function findBestRepoMatch(repos, query) {
        const cleanQuery = query.replace(/\s+/g, '-').toLowerCase();
        // Exact match
        let found = repos.find(r => r.name.toLowerCase() === cleanQuery || r.name.toLowerCase() === query);
        if (found) return found;

        // Substring match
        found = repos.find(r => r.name.toLowerCase().includes(cleanQuery) || cleanQuery.includes(r.name.toLowerCase()));
        if (found) return found;

        // Word match
        found = repos.find(r => query.split(' ').some(w => w.length > 2 && r.name.toLowerCase().includes(w)));
        return found || null;
    }

    // ----------------------------------------------------------------------
    // Voice Agent UI & HUD Management
    // ----------------------------------------------------------------------
    function initUI() {
        micSearchBtn = document.getElementById('voiceSearchMicBtn');
        voiceDockBtn = document.getElementById('voiceAgentDockBtn');
        voiceHud = document.getElementById('voiceAgentHud');
        voiceTranscriptText = document.getElementById('voiceTranscriptText');
        voiceReplyText = document.getElementById('voiceReplyText');
        voiceVisualizer = document.getElementById('voiceVisualizer');
        voiceStatusText = document.getElementById('voiceStatusText');
        voiceCommandsModal = document.getElementById('voiceCommandsModal');

        // Mic in search input
        if (micSearchBtn) {
            micSearchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                toggleListening();
            });
        }

        // Floating dock button
        if (voiceDockBtn) {
            voiceDockBtn.addEventListener('click', (e) => {
                e.preventDefault();
                toggleListening();
            });
        }

        // HUD control buttons
        const hudCloseBtn = document.getElementById('voiceHudCloseBtn');
        if (hudCloseBtn) {
            hudCloseBtn.addEventListener('click', closeHud);
        }

        const voiceMuteBtn = document.getElementById('voiceMuteBtn');
        if (voiceMuteBtn) {
            updateMuteButtonUI();
            voiceMuteBtn.addEventListener('click', () => {
                setMute(!voiceState.isMuted);
            });
        }

        const voiceHelpBtn = document.getElementById('voiceHelpBtn');
        if (voiceHelpBtn) {
            voiceHelpBtn.addEventListener('click', openCommandsModal);
        }

        // Global hotkey: Ctrl+M (or Cmd+M) to toggle listening
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                toggleListening();
            }
        });
    }

    function openHud() {
        if (voiceHud) voiceHud.classList.add('active');
    }

    function closeHud() {
        if (voiceHud) voiceHud.classList.remove('active');
    }

    function openCommandsModal() {
        if (voiceCommandsModal) voiceCommandsModal.classList.add('active');
    }

    function closeCommandsModal() {
        if (voiceCommandsModal) voiceCommandsModal.classList.remove('active');
    }

    function updateListeningUI(isListening) {
        if (micSearchBtn) {
            micSearchBtn.classList.toggle('active', isListening);
            micSearchBtn.title = isListening ? 'Listening... Click to pause (Ctrl+M)' : 'Click to speak (Ctrl+M)';
        }
        if (voiceDockBtn) {
            voiceDockBtn.classList.toggle('listening', isListening);
        }
        if (voiceVisualizer) {
            voiceVisualizer.classList.toggle('active', isListening || voiceState.isSpeaking);
        }
    }

    function updateVisualizer(isActive) {
        if (voiceVisualizer) {
            voiceVisualizer.classList.toggle('active', isActive || voiceState.isListening);
        }
    }

    function setStatus(text) {
        if (voiceStatusText) voiceStatusText.textContent = text;
    }

    function setUserTranscript(text) {
        if (voiceTranscriptText) voiceTranscriptText.textContent = text;
    }

    function setAgentReply(text) {
        if (voiceReplyText) voiceReplyText.textContent = `🤖 ${text}`;
    }

    function setMute(muted) {
        voiceState.isMuted = muted;
        localStorage.setItem('devsearch_voice_muted', muted ? 'true' : 'false');
        if (muted && voiceState.synth) voiceState.synth.cancel();
        updateMuteButtonUI();
        playChime('toggle');
    }

    function updateMuteButtonUI() {
        const btn = document.getElementById('voiceMuteBtn');
        if (btn) {
            btn.innerHTML = voiceState.isMuted 
                ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/></svg>' 
                : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
            btn.title = voiceState.isMuted ? 'Unmute voice feedback' : 'Mute voice feedback';
        }
    }

    // Public window API
    window.DevSearchVoice = {
        start: startListening,
        stop: stopListening,
        toggle: toggleListening,
        speak: speak,
        openHelp: openCommandsModal,
        closeHelp: closeCommandsModal,
        closeHud: closeHud
    };

    // Initialize on DOM Ready
    function init() {
        initVoices();
        initRecognition();
        initUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
