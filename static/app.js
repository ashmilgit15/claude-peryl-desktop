document.addEventListener('DOMContentLoaded', () => {
    if (typeof mermaid !== 'undefined') {
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });
    }

    // DOM Elements
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('btn-sidebar-toggle');
    const chatContainer = document.getElementById('messages-container');
    const welcomeScreen = document.getElementById('welcome-screen');
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('btn-send');
    const newChatBtn = document.getElementById('btn-new-chat');
    const modelSelect = document.getElementById('model-select');
    const styleSelect = document.getElementById('style-select');
    const modeBtns = document.querySelectorAll('.mode-btn');
    const threadTitle = document.getElementById('current-thread-title');
    const activeModeBadge = document.getElementById('active-mode-badge');
    const deepResearchToggle = document.getElementById('btn-toggle-deep-research');
    const webSearchToggle = document.getElementById('btn-toggle-web-search');
    const subagentStatusBar = document.getElementById('subagent-status-bar');
    const subagentStatusText = document.getElementById('subagent-status-text');

    // Attachment DOM
    const attachFileBtn = document.getElementById('btn-attach-file');
    const fileInput = document.getElementById('file-input');
    const attachmentPreview = document.getElementById('attachment-preview');

    // Thread Search & History DOM
    const searchThreadsInput = document.getElementById('search-threads-input');
    const threadsList = document.getElementById('chat-threads-list');
    const exportChatBtn = document.getElementById('btn-export-chat');

    // Artifact DOM & Resizer
    const artifactsPanel = document.getElementById('artifacts-panel');
    const artifactsResizer = document.getElementById('artifacts-resizer');
    const toggleArtifactsBtn = document.getElementById('btn-toggle-artifacts');
    const artifactCountSpan = document.getElementById('artifact-count');
    const artifactActiveTitle = document.getElementById('artifact-active-title');
    const artifactIframe = document.getElementById('artifact-iframe');
    const artifactCodeBlock = document.getElementById('artifact-code-block');
    const closeArtifactsBtn = document.getElementById('btn-close-artifacts');
    const tabPreviewBtn = document.getElementById('btn-artifact-tab-preview');
    const tabCodeBtn = document.getElementById('btn-artifact-tab-code');
    const copyArtifactBtn = document.getElementById('btn-copy-artifact');
    const downloadArtifactBtn = document.getElementById('btn-download-artifact');

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
    let attachedFiles = [];
    let artifactsMap = new Map();
    let activeArtifactId = null;
    let savedThreads = JSON.parse(localStorage.getItem('claude_peryl_threads') || '[]');

    const THINKING_WORDS = [
        'Pondering...', 'Thinking...', 'Synthesizing...', 
        'Flabbergasting...', 'Contemplating...', 'Architecting...', 
        'Deconstructing...', 'Analyzing...'
    ];

    function getRandomThinkingWord() {
        return THINKING_WORDS[Math.floor(Math.random() * THINKING_WORDS.length)];
    }

    const WINDOW_STORAGE_SCRIPT = `
        <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
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

    renderThreadsList();

    sidebarToggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    promptInput.addEventListener('input', () => {
        promptInput.style.height = 'auto';
        promptInput.style.height = Math.min(promptInput.scrollHeight, 150) + 'px';
    });

    attachFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                attachedFiles.push({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    content: evt.target.result
                });
                renderAttachmentChips();
            };
            if (file.type.startsWith('image/')) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
        });
        fileInput.value = '';
    });

    function renderAttachmentChips() {
        attachmentPreview.innerHTML = '';
        attachedFiles.forEach((f, idx) => {
            const chip = document.createElement('div');
            chip.className = 'attachment-chip';
            chip.innerHTML = `
                <i class="fa-solid fa-file-code"></i>
                <span>${escapeHtml(f.name)}</span>
                <i class="fa-solid fa-xmark" style="cursor:pointer;" data-idx="${idx}"></i>
            `;
            chip.querySelector('.fa-xmark').addEventListener('click', () => {
                attachedFiles.splice(idx, 1);
                renderAttachmentChips();
            });
            attachmentPreview.appendChild(chip);
        });
    }

    webSearchToggle.addEventListener('click', () => {
        isWebSearchEnabled = !isWebSearchEnabled;
        webSearchToggle.classList.toggle('active', isWebSearchEnabled);
        webSearchToggle.innerHTML = isWebSearchEnabled 
            ? '<i class="fa-solid fa-globe"></i> Web Search ON' 
            : '<i class="fa-solid fa-globe" style="opacity:0.5;"></i> Web Search OFF';
    });

    deepResearchToggle.addEventListener('click', () => {
        isDeepResearch = !isDeepResearch;
        deepResearchToggle.classList.toggle('active', isDeepResearch);
        activeModeBadge.innerText = isDeepResearch ? 'Deep Dive Research' : 'Standard Chat';
        modelSelect.value = isDeepResearch ? 'claude-peryl-deep-research' : 'claude-peryl';
    });

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
        saveCurrentThread();
        conversationHistory = [];
        attachedFiles = [];
        artifactsMap.clear();
        renderAttachmentChips();
        chatContainer.innerHTML = '';
        welcomeScreen.style.display = 'flex';
        chatContainer.appendChild(welcomeScreen);
        artifactsPanel.classList.add('collapsed');
        artifactsResizer.style.display = 'none';
        toggleArtifactsBtn.style.display = 'none';
        threadTitle.innerText = 'New Conversation';
    });

    searchThreadsInput.addEventListener('input', (e) => {
        renderThreadsList(e.target.value.toLowerCase().trim());
    });

    exportChatBtn.addEventListener('click', () => {
        if (conversationHistory.length === 0) return;
        let exportText = `# ${threadTitle.innerText}\n\n`;
        conversationHistory.forEach(msg => {
            exportText += `### ${msg.role === 'user' ? 'User' : 'Claude Peryl'}\n${msg.content}\n\n`;
        });
        const blob = new Blob([exportText], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${threadTitle.innerText.replace(/[^a-z0-9]/gi, '_')}.md`;
        a.click();
    });

    function renderThreadsList(filterText = '') {
        threadsList.innerHTML = '';
        savedThreads.filter(t => t.title.toLowerCase().includes(filterText)).forEach((thread, idx) => {
            const li = document.createElement('li');
            li.className = 'thread-item';
            li.innerHTML = `
                <div style="display:flex;align-items:center;gap:6px;overflow:hidden;">
                    <i class="fa-regular fa-message" style="font-size:11px;"></i>
                    <span style="overflow:hidden;text-overflow:ellipsis;">${escapeHtml(thread.title)}</span>
                </div>
                <div class="thread-actions">
                    <button class="thread-action-btn delete-thread" data-idx="${idx}" title="Delete chat"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            li.addEventListener('click', (e) => {
                if (e.target.closest('.delete-thread')) {
                    savedThreads.splice(idx, 1);
                    localStorage.setItem('claude_peryl_threads', JSON.stringify(savedThreads));
                    renderThreadsList();
                    return;
                }
                loadThread(thread);
            });
            threadsList.appendChild(li);
        });
    }

    function saveCurrentThread() {
        if (conversationHistory.length > 0) {
            const title = threadTitle.innerText;
            const existingIdx = savedThreads.findIndex(t => t.title === title);
            const threadObj = { title, history: conversationHistory };
            if (existingIdx >= 0) {
                savedThreads[existingIdx] = threadObj;
            } else {
                savedThreads.unshift(threadObj);
            }
            localStorage.setItem('claude_peryl_threads', JSON.stringify(savedThreads));
            renderThreadsList();
        }
    }

    function loadThread(thread) {
        conversationHistory = thread.history || [];
        threadTitle.innerText = thread.title;
        welcomeScreen.style.display = 'none';
        chatContainer.innerHTML = '';

        conversationHistory.forEach(msg => {
            if (msg.role === 'user') {
                appendUserMessage(msg.content);
            } else {
                const assistantMessageObj = appendAssistantMessage();
                renderMarkdown(assistantMessageObj.contentDiv, msg.content);
                checkForArtifacts(msg.content, assistantMessageObj.contentDiv);
            }
        });
    }

    async function sendMessage(overrideText = null) {
        let text = overrideText || promptInput.value.trim();
        if (!text && attachedFiles.length === 0) return;

        if (welcomeScreen.style.display !== 'none') {
            welcomeScreen.style.display = 'none';
        }

        const selectedStyle = styleSelect.value;
        if (!overrideText && selectedStyle && selectedStyle !== 'normal') {
            text += `\n\n[Writing Style Constraint: Please answer in a ${selectedStyle} tone.]`;
        }

        if (!overrideText && attachedFiles.length > 0) {
            let fileAttachmentText = '\n\n<attached_files>\n';
            attachedFiles.forEach(f => {
                fileAttachmentText += `<file name="${f.name}">\n${f.content}\n</file>\n`;
            });
            fileAttachmentText += '</attached_files>';
            text = text + fileAttachmentText;
        }

        if (conversationHistory.length === 0) {
            threadTitle.innerText = text.length > 28 ? text.slice(0, 28) + '...' : text;
        }

        if (!overrideText) {
            appendUserMessage(text);
            conversationHistory.push({ role: 'user', content: text });
            promptInput.value = '';
            promptInput.style.height = 'auto';
            attachedFiles = [];
            renderAttachmentChips();
        }

        const assistantMessageObj = appendAssistantMessage();
        const contentDiv = assistantMessageObj.contentDiv;
        const subagentProgressBox = assistantMessageObj.subagentProgressBox;
        const thinkingBadge = assistantMessageObj.thinkingBadge;

        thinkingBadge.style.display = 'inline-flex';
        thinkingBadge.innerHTML = `<i class="fa-solid fa-brain"></i> <span>${getRandomThinkingWord()}</span>`;

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
                                checkForArtifacts(fullAssistantText, contentDiv, false);
                                chatContainer.scrollTop = chatContainer.scrollHeight;
                            }
                        } catch (e) {}
                    }
                }
            }

            thinkingBadge.style.display = 'none';
            conversationHistory.push({ role: 'assistant', content: fullAssistantText });
            saveCurrentThread();
            checkForArtifacts(fullAssistantText, contentDiv, true);

            if (fullAssistantText.includes('```') && (fullAssistantText.match(/```/g) || []).length % 2 !== 0) {
                appendContinueButton(contentDiv);
            }

        } catch (err) {
            subagentStatusBar.style.display = 'none';
            thinkingBadge.style.display = 'none';
            contentDiv.innerText = 'Error connecting to Claude Peryl backend engine.';
        }
    }

    function appendContinueButton(container) {
        const btn = document.createElement('button');
        btn.className = 'btn-primary';
        btn.style.marginTop = '12px';
        btn.style.fontSize = '12px';
        btn.style.padding = '6px 12px';
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Continue Generating';
        btn.addEventListener('click', () => {
            btn.remove();
            sendMessage('Please continue your previous response right from where you got cut off without repeating.');
        });
        container.appendChild(btn);
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
            <div class="avatar assistant">
                <img src="/static/logo.svg" alt="Claude Peryl Emblem" class="avatar-logo-img">
            </div>
            <div style="flex: 1; max-width: 85%;">
                <div class="thinking-badge" style="display: none;"></div>
                <div class="subagent-card" style="display: none;"></div>
                <div class="message-bubble assistant-text"></div>
            </div>
        `;
        chatContainer.appendChild(wrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        return {
            contentDiv: wrapper.querySelector('.assistant-text'),
            subagentProgressBox: wrapper.querySelector('.subagent-card'),
            thinkingBadge: wrapper.querySelector('.thinking-badge')
        };
    }

    function preprocessMath(text) {
        const mathMap = [];

        // 1. Block math: $$...$$ or \[...\]
        let processed = text.replace(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/g, (match) => {
            const key = `%%%MATH_BLOCK_${mathMap.length}%%%`;
            mathMap.push({ key, value: match });
            return key;
        });

        // 2. Inline math: $...$ or \(...\)
        processed = processed.replace(/(\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g, (match) => {
            const key = `%%%MATH_INLINE_${mathMap.length}%%%`;
            mathMap.push({ key, value: match });
            return key;
        });

        return { processedText: processed, mathMap };
    }

    function restoreMath(html, mathMap) {
        let restored = html;
        mathMap.forEach(item => {
            restored = restored.replace(item.key, item.value);
        });
        return restored;
    }

    function renderMarkdown(element, markdownText) {
        if (typeof marked !== 'undefined') {
            const { processedText, mathMap } = preprocessMath(markdownText);
            let parsedHtml = marked.parse(processedText);
            parsedHtml = restoreMath(parsedHtml, mathMap);
            element.innerHTML = parsedHtml;

            element.querySelectorAll('pre code').forEach((block) => {
                if (typeof hljs !== 'undefined') hljs.highlightElement(block);
            });

            if (typeof renderMathInElement !== 'undefined') {
                try {
                    renderMathInElement(element, {
                        delimiters: [
                            {left: '$$', right: '$$', display: true},
                            {left: '\\[', right: '\\]', display: true},
                            {left: '$', right: '$', display: false},
                            {left: '\\(', right: '\\)', display: false}
                        ],
                        throwOnError: false
                    });
                } catch(e) {}
            }

            if (typeof mermaid !== 'undefined') {
                element.querySelectorAll('code.language-mermaid').forEach((block, idx) => {
                    const mermaidDiv = document.createElement('div');
                    mermaidDiv.className = 'mermaid';
                    mermaidDiv.textContent = block.textContent;
                    block.parentNode.replaceWith(mermaidDiv);
                });
                try { mermaid.run(); } catch(e) {}
            }
        } else {
            element.innerText = markdownText;
        }
    }

    function checkForArtifacts(text, parentElement, isFinal = false) {
        let codeBlocks = [];

        const closedRegex = /```(html|jsx|tsx|svg|mermaid|markdown)\s*\n([\s\S]*?)```/g;
        let match;
        while ((match = closedRegex.exec(text)) !== null) {
            codeBlocks.push({ type: match[1], content: match[2].trim() });
        }

        if (codeBlocks.length === 0) {
            const openRegex = /```(html|jsx|tsx|svg|mermaid|markdown)\s*\n([\s\S]+)$/i;
            const openMatch = openRegex.exec(text);
            if (openMatch) {
                let unclosedCode = openMatch[2].trim();
                if (unclosedCode.length > 50) {
                    codeBlocks.push({ type: openMatch[1], content: unclosedCode, isUnclosed: true });
                }
            }
        }

        let index = 1;
        codeBlocks.forEach(item => {
            const type = item.type;
            let code = item.content;
            if (code.length < 40) return;

            const artId = `art_${type}_${index++}`;
            const artifactObj = {
                id: artId,
                title: `Interactive ${type.toUpperCase()} Artifact ${item.isUnclosed ? '(Live Preview)' : ''}`,
                type: type,
                content: code
            };

            const existing = parentElement.querySelector(`.artifact-banner[data-art-id="${artId}"]`);
            if (!existing) {
                artifactsMap.set(artId, artifactObj);

                const banner = document.createElement('div');
                banner.className = 'artifact-card-banner artifact-banner';
                banner.dataset.artId = artId;
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
            } else {
                artifactsMap.set(artId, artifactObj);
                if (activeArtifactId === artId) {
                    openArtifact(artId);
                }
            }
        });

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
        artifactsResizer.style.display = 'block';

        artifactCodeBlock.className = `language-${artifact.type}`;
        artifactCodeBlock.textContent = artifact.content;
        if (typeof hljs !== 'undefined') hljs.highlightElement(artifactCodeBlock);

        let docContent = artifact.content;

        if (!docContent.includes('</html>') && docContent.includes('<html')) docContent += '</body></html>';

        if (artifact.type === 'jsx' || artifact.type === 'tsx') {
            docContent = `<!DOCTYPE html><html><head><style>body{font-family:sans-serif;padding:20px;background:#18181b;color:#fff;}</style></head><body>${WINDOW_STORAGE_SCRIPT}<div id="root"></div><script type="text/babel">${docContent}\nReactDOM.createRoot(document.getElementById('root')).render(<App />);</script></body></html>`;
        } else if (artifact.type === 'html' || artifact.type === 'svg') {
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

    downloadArtifactBtn.addEventListener('click', () => {
        if (activeArtifactId && artifactsMap.has(activeArtifactId)) {
            const artifact = artifactsMap.get(activeArtifactId);
            const extMap = { html: 'html', jsx: 'jsx', svg: 'svg', mermaid: 'mmd', markdown: 'md' };
            const ext = extMap[artifact.type] || 'txt';
            const blob = new Blob([artifact.content], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `artifact_${activeArtifactId}.${ext}`;
            a.click();
        }
    });

    let isResizing = false;
    artifactsResizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        artifactsResizer.classList.add('active');
        document.body.style.cursor = 'col-resize';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const newWidth = document.body.clientWidth - e.clientX;
        if (newWidth > 300 && newWidth < 900) {
            artifactsPanel.style.width = `${newWidth}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            artifactsResizer.classList.remove('active');
            document.body.style.cursor = 'default';
        }
    });

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
        artifactsResizer.style.display = 'none';
    });

    toggleArtifactsBtn.addEventListener('click', () => {
        artifactsPanel.classList.toggle('collapsed');
        artifactsResizer.style.display = artifactsPanel.classList.contains('collapsed') ? 'none' : 'block';
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

    sendBtn.addEventListener('click', () => sendMessage());
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
