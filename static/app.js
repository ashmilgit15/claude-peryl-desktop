document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatContainer = document.getElementById('messages-container');
    const welcomeScreen = document.getElementById('welcome-screen');
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('btn-send');
    const newChatBtn = document.getElementById('btn-new-chat');
    const modelSelect = document.getElementById('model-select');
    const modeBtns = document.querySelectorAll('.mode-btn');
    const threadTitle = document.getElementById('current-thread-title');
    const activeModeBadge = document.getElementById('active-mode-badge');
    const deepResearchToggle = document.getElementById('btn-toggle-deep-research');
    const webSearchToggle = document.getElementById('btn-toggle-web-search');
    const subagentStatusBar = document.getElementById('subagent-status-bar');
    const subagentStatusText = document.getElementById('subagent-status-text');

    // Artifact DOM
    const artifactsPanel = document.getElementById('artifacts-panel');
    const toggleArtifactsBtn = document.getElementById('btn-toggle-artifacts');
    const artifactCountSpan = document.getElementById('artifact-count');
    const artifactActiveTitle = document.getElementById('artifact-active-title');
    const artifactIframe = document.getElementById('artifact-iframe');
    const artifactCodeBlock = document.getElementById('artifact-code-block');
    const closeArtifactsBtn = document.getElementById('btn-close-artifacts');
    const tabPreviewBtn = document.getElementById('btn-artifact-tab-preview');
    const tabCodeBtn = document.getElementById('btn-artifact-tab-code');
    const copyArtifactBtn = document.getElementById('btn-copy-artifact');

    // Settings DOM
    const settingsBtn = document.getElementById('btn-settings');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalBtn = document.getElementById('btn-close-modal');
    const saveSettingsBtn = document.getElementById('btn-save-settings');
    const sysPromptEditor = document.getElementById('sys-prompt-editor');

    // State Variables
    let conversationHistory = [];
    let isDeepResearch = false;
    let isWebSearchEnabled = true;
    let artifactsMap = new Map();
    let activeArtifactId = null;

    const WINDOW_STORAGE_SCRIPT = `
        <script>
            (function() {
                const storageStore = new Map();
                window.storage = {
                    async get(key) {
                        return storageStore.has(key) ? { key, value: storageStore.get(key), shared: false } : null;
                    },
                    async set(key, value) {
                        storageStore.set(key, String(value));
                        return { key, value: String(value), shared: false };
                    },
                    async delete(key) {
                        const deleted = storageStore.delete(key);
                        return { key, deleted, shared: false };
                    },
                    async list(prefix = '') {
                        const keys = Array.from(storageStore.keys()).filter(k => k.startsWith(prefix));
                        return { keys, prefix, shared: false };
                    }
                };
            })();
        </script>
    `;

    fetch('/api/system_prompt')
        .then(r => r.json())
        .then(data => {
            if (data.system_prompt) sysPromptEditor.value = data.system_prompt;
        })
        .catch(() => {});

    promptInput.addEventListener('input', () => {
        promptInput.style.height = 'auto';
        promptInput.style.height = Math.min(promptInput.scrollHeight, 150) + 'px';
    });

    // Web Search Selector Toggle
    webSearchToggle.addEventListener('click', () => {
        isWebSearchEnabled = !isWebSearchEnabled;
        webSearchToggle.classList.toggle('active', isWebSearchEnabled);
        webSearchToggle.innerHTML = isWebSearchEnabled 
            ? '<i class="fa-solid fa-globe"></i> Web Search ON' 
            : '<i class="fa-solid fa-globe" style="opacity:0.5;"></i> Web Search OFF';
    });

    // Deep Research Toggle
    deepResearchToggle.addEventListener('click', () => {
        isDeepResearch = !isDeepResearch;
        deepResearchToggle.classList.toggle('active', isDeepResearch);
        activeModeBadge.innerText = isDeepResearch ? 'Deep Dive Research' : 'Standard Chat';
        modelSelect.value = isDeepResearch ? 'claude-peryl-deep-research' : 'claude-peryl';
    });

    // Mode Selector Buttons
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.dataset.mode;
            isDeepResearch = (mode === 'deep-research');
            deepResearchToggle.classList.toggle('active', isDeepResearch);
            activeModeBadge.innerText = isDeepResearch ? 'Deep Dive Research' : 'Standard Chat';
            modelSelect.value = isDeepResearch ? 'claude-peryl-deep-research' : 'claude-peryl';
        });
    });

    document.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
            promptInput.value = card.dataset.prompt;
            sendMessage();
        });
    });

    newChatBtn.addEventListener('click', () => {
        conversationHistory = [];
        artifactsMap.clear();
        chatContainer.innerHTML = '';
        welcomeScreen.style.display = 'flex';
        chatContainer.appendChild(welcomeScreen);
        artifactsPanel.classList.add('collapsed');
        toggleArtifactsBtn.style.display = 'none';
        threadTitle.innerText = 'New Conversation';
    });

    async function sendMessage() {
        const text = promptInput.value.trim();
        if (!text) return;

        if (welcomeScreen.style.display !== 'none') {
            welcomeScreen.style.display = 'none';
        }

        if (conversationHistory.length === 0) {
            threadTitle.innerText = text.length > 28 ? text.slice(0, 28) + '...' : text;
        }

        appendUserMessage(text);
        conversationHistory.push({ role: 'user', content: text });
        promptInput.value = '';
        promptInput.style.height = 'auto';

        const assistantMessageObj = appendAssistantMessage();
        const contentDiv = assistantMessageObj.contentDiv;
        const subagentProgressBox = assistantMessageObj.subagentProgressBox;

        if (isDeepResearch) {
            subagentStatusBar.style.display = 'flex';
            subagentStatusText.innerText = 'Initializing Deep Dive Research Subagents with Tavily...';
        } else if (isWebSearchEnabled) {
            subagentStatusBar.style.display = 'flex';
            subagentStatusText.innerText = 'Searching web via Tavily API...';
        }

        try {
            const response = await fetch('/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: modelSelect.value,
                    messages: conversationHistory,
                    stream: true,
                    deep_research: isDeepResearch,
                    enable_web_search: isWebSearchEnabled
                })
            });

            subagentStatusBar.style.display = 'none';

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullAssistantText = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith(':')) continue;

                    if (trimmed.startsWith('data: ')) {
                        const rawData = trimmed.slice(6).trim();
                        if (rawData === '[DONE]') break;

                        try {
                            const data = JSON.parse(rawData);

                            if (data.type === 'subagent_step' || data.type === 'subagent_start') {
                                subagentProgressBox.style.display = 'flex';
                                subagentProgressBox.innerHTML = `
                                    <i class="fa-solid fa-microchip"></i>
                                    <span><strong>[${data.role || 'Subagent'}]</strong> ${data.message}</span>
                                `;
                            } else if (data.type === 'subagent_complete') {
                                subagentProgressBox.innerHTML += `
                                    <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">✓ ${data.role} complete.</div>
                                `;
                            } else if (data.type === 'content_block_delta') {
                                fullAssistantText += data.delta.text;
                                renderMarkdown(contentDiv, fullAssistantText);
                                chatContainer.scrollTop = chatContainer.scrollHeight;
                            }
                        } catch (e) {}
                    }
                }
            }

            conversationHistory.push({ role: 'assistant', content: fullAssistantText });
            checkForArtifacts(fullAssistantText, contentDiv);

        } catch (err) {
            subagentStatusBar.style.display = 'none';
            contentDiv.innerText = 'Error connecting to Claude Peryl backend engine.';
        }
    }

    function appendUserMessage(text) {
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper user';
        wrapper.innerHTML = `
            <div class="avatar"><i class="fa-solid fa-user"></i></div>
            <div class="message-bubble">${escapeHtml(text)}</div>
        `;
        chatContainer.appendChild(wrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function appendAssistantMessage() {
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper assistant';
        wrapper.innerHTML = `
            <div class="avatar assistant"><i class="fa-solid fa-sparkles"></i></div>
            <div style="flex: 1; max-width: 80%;">
                <div class="subagent-card" style="display: none;"></div>
                <div class="message-bubble assistant-text"></div>
            </div>
        `;
        chatContainer.appendChild(wrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        return {
            contentDiv: wrapper.querySelector('.assistant-text'),
            subagentProgressBox: wrapper.querySelector('.subagent-card')
        };
    }

    function renderMarkdown(element, markdownText) {
        if (typeof marked !== 'undefined') {
            element.innerHTML = marked.parse(markdownText);
            element.querySelectorAll('pre code').forEach((block) => {
                if (typeof hljs !== 'undefined') hljs.highlightElement(block);
            });
        } else {
            element.innerText = markdownText;
        }
    }

    function checkForArtifacts(text, parentElement) {
        const artifactRegex = /```(html|jsx|tsx|svg|mermaid|markdown)\s*\n([\s\S]*?)```/g;
        let match;
        let index = 1;

        while ((match = artifactRegex.exec(text)) !== null) {
            const type = match[1];
            const code = match[2].trim();
            if (code.length < 40) continue;

            const artId = `art_${Date.now()}_${index++}`;
            const artifactObj = {
                id: artId,
                title: `Interactive ${type.toUpperCase()} Artifact`,
                type: type,
                content: code
            };

            artifactsMap.set(artId, artifactObj);

            const banner = document.createElement('div');
            banner.className = 'artifact-card-banner';
            banner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-cube" style="color: var(--accent-color);"></i>
                    <span><strong>Artifact Created:</strong> ${artifactObj.title}</span>
                </div>
                <button class="btn-primary" style="padding: 4px 10px; font-size: 11px;">View Artifact</button>
            `;
            banner.addEventListener('click', () => openArtifact(artId));
            parentElement.appendChild(banner);

            openArtifact(artId);
        }

        updateArtifactButtonState();
    }

    function updateArtifactButtonState() {
        const count = artifactsMap.size;
        if (count > 0) {
            toggleArtifactsBtn.style.display = 'inline-flex';
            artifactCountSpan.innerText = count;
        }
    }

    function openArtifact(artId) {
        const artifact = artifactsMap.get(artId);
        if (!artifact) return;

        activeArtifactId = artId;
        artifactActiveTitle.innerText = artifact.title;
        artifactsPanel.classList.remove('collapsed');

        artifactCodeBlock.className = `language-${artifact.type}`;
        artifactCodeBlock.textContent = artifact.content;
        if (typeof hljs !== 'undefined') hljs.highlightElement(artifactCodeBlock);

        let docContent = artifact.content;
        if (artifact.type === 'html' || artifact.type === 'svg') {
            if (!docContent.includes('<html')) {
                docContent = `<!DOCTYPE html><html><head><style>body{font-family:sans-serif;padding:20px;background:#fff;color:#111;}</style></head><body>${WINDOW_STORAGE_SCRIPT}${docContent}</body></html>`;
            } else {
                docContent = WINDOW_STORAGE_SCRIPT + docContent;
            }
        } else if (artifact.type === 'markdown') {
            docContent = `<!DOCTYPE html><html><head><style>body{font-family:sans-serif;padding:20px;line-height:1.6;}</style></head><body>${WINDOW_STORAGE_SCRIPT}${marked.parse(docContent)}</body></html>`;
        }

        const blob = new Blob([docContent], { type: 'text/html' });
        artifactIframe.src = URL.createObjectURL(blob);
    }

    tabPreviewBtn.addEventListener('click', () => {
        tabPreviewBtn.classList.add('active');
        tabCodeBtn.classList.remove('active');
        document.getElementById('artifact-preview-container').classList.add('active');
        document.getElementById('artifact-code-container').classList.remove('active');
    });

    tabCodeBtn.addEventListener('click', () => {
        tabCodeBtn.classList.add('active');
        tabPreviewBtn.classList.remove('active');
        document.getElementById('artifact-code-container').classList.add('active');
        document.getElementById('artifact-preview-container').classList.remove('active');
    });

    closeArtifactsBtn.addEventListener('click', () => {
        artifactsPanel.classList.add('collapsed');
    });

    toggleArtifactsBtn.addEventListener('click', () => {
        artifactsPanel.classList.toggle('collapsed');
    });

    copyArtifactBtn.addEventListener('click', () => {
        if (activeArtifactId && artifactsMap.has(activeArtifactId)) {
            navigator.clipboard.writeText(artifactsMap.get(activeArtifactId).content);
            copyArtifactBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => { copyArtifactBtn.innerHTML = '<i class="fa-regular fa-copy"></i>'; }, 1500);
        }
    });

    settingsBtn.addEventListener('click', () => settingsModal.style.display = 'flex');
    closeModalBtn.addEventListener('click', () => settingsModal.style.display = 'none');
    saveSettingsBtn.addEventListener('click', () => {
        const newSysPrompt = sysPromptEditor.value;
        fetch('/api/system_prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system_prompt: newSysPrompt })
        });
        settingsModal.style.display = 'none';
    });

    sendBtn.addEventListener('click', sendMessage);
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
});
