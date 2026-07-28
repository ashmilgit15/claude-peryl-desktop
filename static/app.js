/**
 * Claude Desktop Application - Main Frontend Engine
 * Complete interactive implementation matching official Claude Desktop UI & functionality.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- State Variables ---
    let activeThreadId = 'thread_relation_n';
    let selectedModel = 'claude-peryl-opus';
    let isSpeechOutputEnabled = false;
    let isSpeechRecognitionActive = false;
    let recognition = null;

    // Attachments State
    let attachedFiles = [];

    // Projects State
    let projects = JSON.parse(localStorage.getItem('claude_projects') || 'null');
    if (!projects || projects.length === 0) {
        projects = [
            {
                id: 'proj_default',
                name: 'General Workspace',
                instructions: 'Respond as a helpful, precise, and articulate AI assistant.',
                active: true,
                createdAt: Date.now()
            }
        ];
        localStorage.setItem('claude_projects', JSON.stringify(projects));
    }
    let activeProjectId = (projects.find(p => p.active) || projects[0]).id;

    // Custom Settings State
    let customSettings = JSON.parse(localStorage.getItem('claude_custom_settings') || 'null') || {
        systemPrompt: '',
        writingStyle: 'normal',
        tavilyKey: ''
    };

    // Recents Sort & Filter State
    let recentsSortOrder = 'newest'; // 'newest' | 'oldest' | 'title'

    // Active Artifact State
    let activeArtifact = {
        title: 'Artifact Preview',
        code: '',
        lang: 'html'
    };

    // Pre-populated default threads matching official UI
    let threads = JSON.parse(localStorage.getItem('claude_threads') || 'null');
    if (!threads || threads.length === 0) {
        threads = [
            {
                id: 'thread_relation_n',
                title: 'Defining a relation on set N',
                timestamp: Date.now(),
                messages: [
                    {
                        role: 'user',
                        content: 'Explain what it means to define a relation R on the set N with mathematical notation.'
                    },
                    {
                        role: 'assistant',
                        content: `So a general definition looks like:

$$R = \\{(x, y) : rule\\ connecting\\ x\\ and\\ y, restriction\\ on\\ x, x, y \\in N\\}$$

The rule acts like a recipe — for every valid x you plug in, it tells you exactly what y must be for (x, y) to be included in R. The restriction on x keeps the relation finite (natural numbers go on forever, so without a cutoff the relation would be infinite).

That's the general meaning behind the phrase "define a relation R on the set N."`
                    }
                ]
            },
            {
                id: 'thread_ai_think',
                title: 'Can AI actually think?',
                timestamp: Date.now() - 3600000,
                messages: [
                    {
                        role: 'user',
                        content: 'Can AI actually think, or is it just complex pattern matching?'
                    },
                    {
                        role: 'assistant',
                        thinkingDuration: 5,
                        content: `<think>
1. Deconstruct the multi-faceted question: biological cognition vs artificial neural network inference.
2. Evaluate pattern recognition in high-dimensional vector spaces.
3. Contrast functional reasoning vs phenomenological consciousness/qualia.
4. Synthesize structural cognitive capabilities of modern LLMs.
</think>

AI models process language through high-dimensional pattern transformations rather than biological consciousness. However, through deep layer representations, they exhibit genuine functional reasoning, structural abstraction, and dynamic synthesis.`
                    }
                ]
            },
            {
                id: 'thread_context_analysis',
                title: 'Loading context for analysis',
                timestamp: Date.now() - 7200000,
                messages: []
            },
            {
                id: 'thread_meaning_everything',
                title: 'Meaning of "everything has its own...',
                timestamp: Date.now() - 10800000,
                messages: []
            }
        ];
        localStorage.setItem('claude_threads', JSON.stringify(threads));
    }

    // --- DOM Elements ---
    const sidebar = document.getElementById('sidebar');
    const btnSidebarCollapse = document.getElementById('btn-sidebar-collapse');
    const btnSidebarExpand = document.getElementById('btn-sidebar-expand');
    const btnSidebarSearch = document.getElementById('btn-sidebar-search');
    const btnFilterRecents = document.getElementById('btn-filter-recents');
    const btnNewChat = document.getElementById('btn-new-chat');
    const chatThreadsList = document.getElementById('chat-threads-list');
    const threadsSearchContainer = document.getElementById('threads-search-container');
    const searchThreadsInput = document.getElementById('search-threads-input');
    const currentThreadTitle = document.getElementById('current-thread-title');
    const chatTitleBtn = document.getElementById('chat-title-btn');
    const chatTitleMenu = document.getElementById('chat-title-menu');
    const menuRenameChat = document.getElementById('menu-rename-chat');
    const menuExportChat = document.getElementById('menu-export-chat');
    const menuDeleteChat = document.getElementById('menu-delete-chat');
    const messagesContainer = document.getElementById('messages-container');
    const welcomeScreen = document.getElementById('welcome-screen');
    const promptInput = document.getElementById('prompt-input');
    const btnSend = document.getElementById('btn-send');
    const btnAttachFile = document.getElementById('btn-attach-file');
    const fileInput = document.getElementById('file-input');
    const attachmentPreview = document.getElementById('attachment-preview');
    const btnVoiceInput = document.getElementById('btn-voice-input');
    const btnVoiceOutputToggle = document.getElementById('btn-voice-output-toggle');
    const modelSelectBtn = document.getElementById('model-select-btn');
    const selectedModelName = document.getElementById('selected-model-name');
    const modelSelectMenu = document.getElementById('model-select-menu');
    const subagentStatusBar = document.getElementById('subagent-status-bar');
    const subagentStatusText = document.getElementById('subagent-status-text');
    const notificationBanner = document.getElementById('claude-notification-banner');
    const btnNotifyEnable = document.getElementById('btn-notify-enable');
    const btnNotifyClose = document.getElementById('btn-notify-close');
    const btnPlanBannerClose = document.getElementById('btn-dismiss-plan-banner');
    const btnUserDownload = document.getElementById('btn-user-download');

    // Modals & Sidebars
    const btnNavProjects = document.getElementById('btn-nav-projects');
    const btnNavArtifacts = document.getElementById('btn-nav-artifacts');
    const btnNavCode = document.getElementById('btn-nav-code');
    const btnNavCustomize = document.getElementById('btn-nav-customize');

    // Projects Modal Elements
    const projectsModal = document.getElementById('projects-modal');
    const projectNameInput = document.getElementById('project-name-input');
    const btnCreateProject = document.getElementById('btn-create-project');
    const projectsList = document.getElementById('projects-list');
    const projectInstructionsInput = document.getElementById('project-instructions-input');
    const btnSaveProjectContext = document.getElementById('btn-save-project-context');

    // Code Explorer Modal Elements
    const codeModal = document.getElementById('code-modal');
    const codeSnippetsList = document.getElementById('code-snippets-list');

    // Customize Modal Elements
    const customizeModal = document.getElementById('customize-modal');
    const customizeSystemPrompt = document.getElementById('customize-system-prompt');
    const customizeStyleSelect = document.getElementById('customize-style-select');
    const customizeTavilyKey = document.getElementById('customize-tavily-key');
    const btnSaveCustomize = document.getElementById('btn-save-customize');

    // Artifacts Elements
    const artifactsPanel = document.getElementById('artifacts-panel');
    const artifactsResizer = document.getElementById('artifacts-resizer');
    const btnToggleArtifacts = document.getElementById('btn-toggle-artifacts');
    const btnCloseArtifacts = document.getElementById('btn-close-artifacts');
    const artifactActiveTitle = document.getElementById('artifact-active-title');
    const btnArtifactTabPreview = document.getElementById('btn-artifact-tab-preview');
    const btnArtifactTabCode = document.getElementById('btn-artifact-tab-code');
    const btnDownloadArtifact = document.getElementById('btn-download-artifact');
    const btnCopyArtifact = document.getElementById('btn-copy-artifact');
    const artifactIframe = document.getElementById('artifact-iframe');
    const artifactCodeBlock = document.getElementById('artifact-code-block');
    const artifactPreviewContainer = document.getElementById('artifact-preview-container');
    const artifactCodeContainer = document.getElementById('artifact-code-container');

    // --- Helper Utilities ---
    function showToast(message) {
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    function escapeHtml(str) {
        return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function formatBytes(bytes, decimals = 1) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function triggerDownload(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // --- Core Initialization ---
    renderThreadsList();
    loadActiveThread();
    initCustomizeForm();
    initProjectsModal();

    // --- 1. File Attachment Upload Handling ---
    if (btnAttachFile && fileInput) {
        btnAttachFile.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleSelectedFiles(Array.from(e.target.files));
                fileInput.value = '';
            }
        });
    }

    // Drag & Drop on Input Area
    const inputArea = document.getElementById('input-area');
    if (inputArea) {
        inputArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            inputArea.classList.add('drag-over');
        });
        inputArea.addEventListener('dragleave', () => {
            inputArea.classList.remove('drag-over');
        });
        inputArea.addEventListener('drop', (e) => {
            e.preventDefault();
            inputArea.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleSelectedFiles(Array.from(e.dataTransfer.files));
            }
        });
    }

    function handleSelectedFiles(files) {
        files.forEach(file => {
            const isImage = file.type.startsWith('image/');
            const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
            const fileItem = {
                id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                name: file.name,
                size: file.size,
                formattedSize: formatBytes(file.size),
                type: file.type || 'text/plain',
                isImage,
                isPdf,
                dataUrl: null,
                textContent: null
            };

            const reader = new FileReader();
            if (isImage) {
                reader.onload = (e) => {
                    fileItem.dataUrl = e.target.result;
                    attachedFiles.push(fileItem);
                    renderAttachmentPreview();
                };
                reader.readAsDataURL(file);
            } else {
                reader.onload = (e) => {
                    fileItem.textContent = e.target.result;
                    attachedFiles.push(fileItem);
                    renderAttachmentPreview();
                };
                reader.readAsText(file);
            }
        });
    }

    function renderAttachmentPreview() {
        if (!attachmentPreview) return;
        attachmentPreview.innerHTML = '';

        if (attachedFiles.length === 0) {
            attachmentPreview.style.display = 'none';
            return;
        }

        attachmentPreview.style.display = 'flex';
        attachedFiles.forEach(file => {
            const chip = document.createElement('div');
            chip.className = 'attachment-chip';

            let mediaIconHtml = `<i class="fa-solid fa-file-lines chip-icon"></i>`;
            if (file.isImage && file.dataUrl) {
                mediaIconHtml = `<img src="${file.dataUrl}" class="chip-img" alt="${escapeHtml(file.name)}">`;
            } else if (file.isPdf) {
                mediaIconHtml = `<i class="fa-solid fa-file-pdf chip-icon" style="color: #ef4444;"></i>`;
            } else if (file.name.match(/\.(js|py|html|css|json|ts|cpp|java|c|rs|go|php|sh)$/i)) {
                mediaIconHtml = `<i class="fa-solid fa-file-code chip-icon" style="color: #3b82f6;"></i>`;
            }

            chip.innerHTML = `
                ${mediaIconHtml}
                <div class="chip-info">
                    <span class="chip-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                    <span class="chip-size">${file.formattedSize}</span>
                </div>
                <button class="chip-remove" title="Remove file"><i class="fa-solid fa-xmark"></i></button>
            `;

            chip.querySelector('.chip-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                attachedFiles = attachedFiles.filter(f => f.id !== file.id);
                renderAttachmentPreview();
            });

            attachmentPreview.appendChild(chip);
        });
    }

    // --- 2. Projects Modal Management ---
    function initProjectsModal() {
        renderProjectsList();

        if (btnCreateProject) {
            btnCreateProject.addEventListener('click', createNewProject);
        }

        if (projectNameInput) {
            projectNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    createNewProject();
                }
            });
        }

        if (btnSaveProjectContext) {
            btnSaveProjectContext.addEventListener('click', saveProjectInstructions);
        }
    }

    function renderProjectsList() {
        if (!projectsList) return;
        projectsList.innerHTML = '';

        projects.forEach(p => {
            const li = document.createElement('li');
            const isActive = p.id === activeProjectId;
            li.className = `project-item ${isActive ? 'active' : ''}`;

            li.innerHTML = `
                <div class="project-title-info">
                    <i class="fa-regular fa-folder" style="color: ${isActive ? 'var(--accent-terracotta)' : 'var(--text-muted)'};"></i>
                    <strong>${escapeHtml(p.name)}</strong>
                    ${isActive ? '<span class="project-badge">Active Context</span>' : ''}
                </div>
                <button class="btn-delete-project" title="Delete Project"><i class="fa-regular fa-trash-can"></i></button>
            `;

            li.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete-project')) {
                    e.stopPropagation();
                    deleteProject(p.id);
                    return;
                }
                selectProject(p.id);
            });

            projectsList.appendChild(li);
        });

        // Set active project instructions into textarea
        const activeProj = projects.find(p => p.id === activeProjectId) || projects[0];
        if (activeProj && projectInstructionsInput) {
            projectInstructionsInput.value = activeProj.instructions || '';
        }
    }

    function selectProject(projId) {
        activeProjectId = projId;
        projects.forEach(p => p.active = (p.id === projId));
        localStorage.setItem('claude_projects', JSON.stringify(projects));
        renderProjectsList();
        showToast('Active project context switched.');
    }

    function createNewProject() {
        const name = projectNameInput.value.trim();
        if (!name) return;

        const newId = 'proj_' + Date.now();
        projects.forEach(p => p.active = false);

        const newProj = {
            id: newId,
            name: name,
            instructions: '',
            active: true,
            createdAt: Date.now()
        };

        projects.unshift(newProj);
        activeProjectId = newId;
        localStorage.setItem('claude_projects', JSON.stringify(projects));

        projectNameInput.value = '';
        renderProjectsList();
        showToast(`Project "${name}" created & activated!`);
    }

    function deleteProject(projId) {
        if (projects.length <= 1) {
            showToast('You must keep at least one project.');
            return;
        }
        projects = projects.filter(p => p.id !== projId);
        if (activeProjectId === projId) {
            activeProjectId = projects[0].id;
            projects[0].active = true;
        }
        localStorage.setItem('claude_projects', JSON.stringify(projects));
        renderProjectsList();
        showToast('Project deleted.');
    }

    function saveProjectInstructions() {
        const activeProj = projects.find(p => p.id === activeProjectId);
        if (activeProj && projectInstructionsInput) {
            activeProj.instructions = projectInstructionsInput.value.trim();
            localStorage.setItem('claude_projects', JSON.stringify(projects));
            showToast(`Saved instructions for project "${activeProj.name}"!`);
        }
    }

    // --- 3. Customize Settings Modal ---
    function initCustomizeForm() {
        if (customizeSystemPrompt) customizeSystemPrompt.value = customSettings.systemPrompt || '';
        if (customizeStyleSelect) customizeStyleSelect.value = customSettings.writingStyle || 'normal';
        if (customizeTavilyKey) customizeTavilyKey.value = customSettings.tavilyKey || '';

        if (btnSaveCustomize) {
            btnSaveCustomize.addEventListener('click', saveCustomizePreferences);
        }
    }

    async function saveCustomizePreferences() {
        customSettings = {
            systemPrompt: customizeSystemPrompt.value.trim(),
            writingStyle: customizeStyleSelect.value,
            tavilyKey: customizeTavilyKey.value.trim()
        };
        localStorage.setItem('claude_custom_settings', JSON.stringify(customSettings));

        // Sync with backend API
        try {
            await fetch('/api/system_prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ system_prompt: customSettings.systemPrompt })
            });
        } catch (e) {
            console.warn('System prompt backend sync failed:', e);
        }

        showToast('Preferences saved successfully!');
        if (customizeModal) customizeModal.style.display = 'none';
    }

    // --- 4. Code Explorer Modal ---
    if (btnNavCode) {
        btnNavCode.addEventListener('click', () => {
            renderCodeExplorer();
            if (codeModal) codeModal.style.display = 'flex';
        });
    }

    function renderCodeExplorer() {
        if (!codeSnippetsList) return;
        codeSnippetsList.innerHTML = '';

        const currentThread = threads.find(t => t.id === activeThreadId);
        const codeBlocks = [];

        if (currentThread && currentThread.messages) {
            currentThread.messages.forEach(msg => {
                if (msg.role === 'assistant' && msg.content) {
                    const regex = /```(\w+)?\s*\n([\s\S]*?)```/g;
                    let match;
                    while ((match = regex.exec(msg.content)) !== null) {
                        codeBlocks.push({
                            lang: match[1] || 'plaintext',
                            code: match[2].trim()
                        });
                    }
                }
            });
        }

        if (codeBlocks.length === 0) {
            codeSnippetsList.innerHTML = `
                <div class="empty-code-state">
                    <i class="fa-solid fa-code"></i>
                    <div>
                        <strong>No code blocks found</strong>
                        <p>Generate code in this conversation to inspect, copy, or download it here.</p>
                    </div>
                </div>
            `;
            return;
        }

        codeBlocks.forEach((block, index) => {
            const card = document.createElement('div');
            card.className = 'code-snippet-card';

            const langDisplay = block.lang.toUpperCase();
            card.innerHTML = `
                <div class="code-snippet-header">
                    <span><i class="fa-solid fa-code"></i> Snippet #${index + 1} (${langDisplay})</span>
                    <div class="code-snippet-actions">
                        <button class="btn-icon btn-copy-snippet" title="Copy Code"><i class="fa-regular fa-copy"></i> Copy</button>
                        <button class="btn-icon btn-download-snippet" title="Download File"><i class="fa-solid fa-download"></i> Download</button>
                    </div>
                </div>
                <div class="code-snippet-body">
                    <pre><code class="language-${block.lang}">${escapeHtml(block.code)}</code></pre>
                </div>
            `;

            const codeEl = card.querySelector('code');
            if (window.hljs) hljs.highlightElement(codeEl);

            card.querySelector('.btn-copy-snippet').addEventListener('click', () => {
                navigator.clipboard.writeText(block.code);
                showToast(`Snippet #${index + 1} copied to clipboard!`);
            });

            card.querySelector('.btn-download-snippet').addEventListener('click', () => {
                const ext = getExtensionForLang(block.lang);
                triggerDownload(block.code, `snippet_${index + 1}.${ext}`);
                showToast(`Downloaded snippet_${index + 1}.${ext}`);
            });

            codeSnippetsList.appendChild(card);
        });
    }

    function getExtensionForLang(lang) {
        const l = (lang || '').toLowerCase();
        if (l === 'python' || l === 'py') return 'py';
        if (l === 'javascript' || l === 'js') return 'js';
        if (l === 'typescript' || l === 'ts') return 'ts';
        if (l === 'html') return 'html';
        if (l === 'css') return 'css';
        if (l === 'json') return 'json';
        if (l === 'cpp' || l === 'c++') return 'cpp';
        if (l === 'c') return 'c';
        if (l === 'java') return 'java';
        if (l === 'go') return 'go';
        if (l === 'rust' || l === 'rs') return 'rs';
        if (l === 'sql') return 'sql';
        if (l === 'sh' || l === 'bash') return 'sh';
        return 'txt';
    }

    // --- 5. Thread Title Dropdown Menu & Operations ---
    if (chatTitleBtn && chatTitleMenu) {
        chatTitleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chatTitleMenu.style.display = chatTitleMenu.style.display === 'none' ? 'flex' : 'none';
        });
    }

    if (menuRenameChat) {
        menuRenameChat.addEventListener('click', () => {
            if (chatTitleMenu) chatTitleMenu.style.display = 'none';
            const thread = threads.find(t => t.id === activeThreadId);
            if (!thread) return;

            const newTitle = prompt('Enter new conversation title:', thread.title);
            if (newTitle && newTitle.trim()) {
                thread.title = newTitle.trim();
                localStorage.setItem('claude_threads', JSON.stringify(threads));
                currentThreadTitle.textContent = thread.title;
                renderThreadsList();
                showToast('Chat renamed successfully!');
            }
        });
    }

    if (menuExportChat) {
        menuExportChat.addEventListener('click', () => {
            if (chatTitleMenu) chatTitleMenu.style.display = 'none';
            const thread = threads.find(t => t.id === activeThreadId);
            if (!thread) return;

            let markdown = `# ${thread.title}\n\n`;
            markdown += `*Exported from Claude Desktop on ${new Date().toLocaleString()}*\n\n---\n\n`;

            thread.messages.forEach((msg) => {
                const roleName = msg.role === 'user' ? 'User' : 'Claude';
                markdown += `### ${roleName}\n\n${msg.content}\n\n---\n\n`;
            });

            const filename = (thread.title || 'chat_export').replace(/[^a-z0-9_-]/gi, '_').toLowerCase() + '.md';
            triggerDownload(markdown, filename, 'text/markdown');
            showToast(`Exported chat as ${filename}`);
        });
    }

    if (menuDeleteChat) {
        menuDeleteChat.addEventListener('click', () => {
            if (chatTitleMenu) chatTitleMenu.style.display = 'none';
            const thread = threads.find(t => t.id === activeThreadId);
            if (!thread) return;

            if (confirm(`Are you sure you want to delete "${thread.title}"?`)) {
                threads = threads.filter(t => t.id !== activeThreadId);
                if (threads.length > 0) {
                    activeThreadId = threads[0].id;
                } else {
                    const newId = 'thread_' + Date.now();
                    threads = [{ id: newId, title: 'New Conversation', timestamp: Date.now(), messages: [] }];
                    activeThreadId = newId;
                }
                localStorage.setItem('claude_threads', JSON.stringify(threads));
                renderThreadsList();
                loadActiveThread();
                showToast('Chat deleted.');
            }
        });
    }

    // Export User App Data button (#btn-user-download)
    if (btnUserDownload) {
        btnUserDownload.addEventListener('click', () => {
            const data = {
                threads,
                projects,
                customSettings,
                exportDate: new Date().toISOString()
            };
            triggerDownload(JSON.stringify(data, null, 2), 'claude_peryl_desktop_backup.json', 'application/json');
            showToast('Exported desktop backup JSON file!');
        });
    }

    // --- 6. Recents Search Filtering & Sorting ---
    if (btnSidebarSearch && threadsSearchContainer && searchThreadsInput) {
        btnSidebarSearch.addEventListener('click', () => {
            const isHidden = threadsSearchContainer.style.display === 'none';
            threadsSearchContainer.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
                searchThreadsInput.focus();
            } else {
                searchThreadsInput.value = '';
                filterAndRenderThreads();
            }
        });

        searchThreadsInput.addEventListener('input', () => {
            filterAndRenderThreads();
        });
    }

    if (btnFilterRecents) {
        btnFilterRecents.addEventListener('click', () => {
            if (recentsSortOrder === 'newest') recentsSortOrder = 'oldest';
            else if (recentsSortOrder === 'oldest') recentsSortOrder = 'title';
            else recentsSortOrder = 'newest';

            showToast(`Sorted chats by ${recentsSortOrder}`);
            filterAndRenderThreads();
        });
    }

    function filterAndRenderThreads() {
        const query = (searchThreadsInput ? searchThreadsInput.value : '').toLowerCase().trim();

        let filtered = threads.filter(t => {
            if (!query) return true;
            const titleMatch = (t.title || '').toLowerCase().includes(query);
            const msgMatch = (t.messages || []).some(m => (m.content || '').toLowerCase().includes(query));
            return titleMatch || msgMatch;
        });

        if (recentsSortOrder === 'newest') {
            filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        } else if (recentsSortOrder === 'oldest') {
            filtered.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        } else if (recentsSortOrder === 'title') {
            filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        }

        renderThreadsList(filtered);
    }

    function renderThreadsList(threadsToRender = null) {
        if (!chatThreadsList) return;
        chatThreadsList.innerHTML = '';
        const list = threadsToRender || threads;

        list.forEach(t => {
            const li = document.createElement('li');
            li.className = `thread-item ${t.id === activeThreadId ? 'active' : ''}`;
            li.setAttribute('data-id', t.id);

            li.innerHTML = `
                <span>${escapeHtml(t.title)}</span>
                <button class="btn-thread-menu" title="Thread options"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            `;

            li.addEventListener('click', (e) => {
                if (e.target.closest('.btn-thread-menu')) {
                    e.stopPropagation();
                    activeThreadId = t.id;
                    renderThreadsList();
                    loadActiveThread();
                    if (chatTitleBtn) chatTitleBtn.click();
                    return;
                }
                activeThreadId = t.id;
                renderThreadsList();
                loadActiveThread();
            });

            chatThreadsList.appendChild(li);
        });
    }

    // --- 7. Voice STT (Speech Recognition) & Voice TTS (Speech Synthesis) ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isSpeechRecognitionActive = true;
            if (btnVoiceInput) btnVoiceInput.classList.add('recording');
            if (promptInput) promptInput.placeholder = "Listening... Speak now...";
        };

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            if (promptInput) {
                promptInput.value = transcript;
                autoResizeTextarea();
            }
        };

        recognition.onerror = (e) => {
            console.error('Speech Recognition Error:', e);
            stopSpeechRecognition();
        };

        recognition.onend = () => {
            stopSpeechRecognition();
        };
    }

    function toggleSpeechRecognition() {
        if (!recognition) {
            showToast('Voice speech recognition is not supported in this browser environment.');
            return;
        }
        if (isSpeechRecognitionActive) {
            recognition.stop();
        } else {
            recognition.start();
        }
    }

    function stopSpeechRecognition() {
        isSpeechRecognitionActive = false;
        if (btnVoiceInput) btnVoiceInput.classList.remove('recording');
        if (promptInput) promptInput.placeholder = "Write a message...";
    }

    if (btnVoiceInput) {
        btnVoiceInput.addEventListener('click', toggleSpeechRecognition);
    }

    // Web SpeechSynthesis (TTS Response Reader)
    function speakText(text, btnElement) {
        if (!('speechSynthesis' in window)) {
            showToast('Text-to-speech is not supported in this browser.');
            return;
        }

        window.speechSynthesis.cancel();
        if (btnElement && btnElement.classList.contains('active')) {
            btnElement.classList.remove('active');
            return;
        }

        // Clean math and markdown tags for clean voice output
        const cleanText = text
            .replace(/\$\$[\s\S]*?\$\$/g, ' mathematical equation ')
            .replace(/\\\[[\s\S]*?\\\]/g, ' mathematical equation ')
            .replace(/\\\([\s\S]*?\\\)/g, ' math expression ')
            .replace(/```[\s\S]*?```/g, ' code block ')
            .replace(/[*_#`~]/g, '');

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;

        if (btnElement) {
            btnElement.classList.add('active');
            utterance.onend = () => btnElement.classList.remove('active');
            utterance.onerror = () => btnElement.classList.remove('active');
        }

        window.speechSynthesis.speak(utterance);
    }

    if (btnVoiceOutputToggle) {
        btnVoiceOutputToggle.addEventListener('click', () => {
            isSpeechOutputEnabled = !isSpeechOutputEnabled;
            btnVoiceOutputToggle.style.color = isSpeechOutputEnabled ? 'var(--accent-terracotta)' : 'var(--text-muted)';
            showToast(isSpeechOutputEnabled ? 'Audio response read aloud enabled.' : 'Audio read aloud disabled.');
        });
    }

    // --- 8. KaTeX Math Formatting Engine ---
    function triggerKaTeX(element) {
        if (typeof renderMathInElement === 'function') {
            renderMathInElement(element || messagesContainer, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "\\[", right: "\\]", display: true },
                    { left: "\\(", right: "\\)", display: false },
                    { left: "$", right: "$", display: false }
                ],
                ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
                throwOnError: false
            });
        }
    }

    // --- 9. Artifacts Split-View Side Panel & Resizer Bar ---
    function initArtifactsPanel() {
        if (btnToggleArtifacts) {
            btnToggleArtifacts.addEventListener('click', () => {
                toggleArtifactsPanel();
            });
        }

        if (btnCloseArtifacts) {
            btnCloseArtifacts.addEventListener('click', () => {
                closeArtifactsPanel();
            });
        }

        if (btnArtifactTabPreview && btnArtifactTabCode) {
            btnArtifactTabPreview.addEventListener('click', () => {
                btnArtifactTabPreview.classList.add('active');
                btnArtifactTabCode.classList.remove('active');
                artifactPreviewContainer.classList.add('active');
                artifactCodeContainer.classList.remove('active');
            });

            btnArtifactTabCode.addEventListener('click', () => {
                btnArtifactTabCode.classList.add('active');
                btnArtifactTabPreview.classList.remove('active');
                artifactCodeContainer.classList.add('active');
                artifactPreviewContainer.classList.remove('active');
            });
        }

        if (btnCopyArtifact) {
            btnCopyArtifact.addEventListener('click', () => {
                navigator.clipboard.writeText(activeArtifact.code);
                showToast('Artifact code copied to clipboard!');
            });
        }

        if (btnDownloadArtifact) {
            btnDownloadArtifact.addEventListener('click', () => {
                const ext = activeArtifact.lang === 'svg' ? 'svg' : 'html';
                triggerDownload(activeArtifact.code, `artifact.${ext}`, activeArtifact.lang === 'svg' ? 'image/svg+xml' : 'text/html');
                showToast(`Downloaded artifact.${ext}`);
            });
        }

        // Resizer Bar Dragging Logic
        if (artifactsResizer && artifactsPanel) {
            let isResizing = false;

            artifactsResizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                artifactsResizer.classList.add('resizing');
                document.body.style.cursor = 'col-resize';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                const newWidth = window.innerWidth - e.clientX;
                if (newWidth >= 280 && newWidth <= window.innerWidth * 0.75) {
                    artifactsPanel.style.width = newWidth + 'px';
                }
            });

            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    artifactsResizer.classList.remove('resizing');
                    document.body.style.cursor = '';
                }
            });
        }
    }

    function openArtifactsPanel() {
        if (artifactsPanel) {
            artifactsPanel.classList.remove('collapsed');
        }
        if (artifactsResizer) {
            artifactsResizer.style.display = 'block';
        }
    }

    function closeArtifactsPanel() {
        if (artifactsPanel) {
            artifactsPanel.classList.add('collapsed');
        }
        if (artifactsResizer) {
            artifactsResizer.style.display = 'none';
        }
    }

    function toggleArtifactsPanel() {
        if (artifactsPanel && artifactsPanel.classList.contains('collapsed')) {
            openArtifactsPanel();
        } else {
            closeArtifactsPanel();
        }
    }

    window.claudeOpenArtifactPanel = function() {
        openArtifactsPanel();
    };

    function detectAndRenderArtifacts(text, autoOpenPanel = true) {
        if (!text) return null;

        let code = '';
        let lang = '';
        let title = '';

        // 1. Fenced Code Blocks (html, jsx, tsx, svg, xml, mermaid, markdown)
        const fencedMatch = text.match(/```(html|jsx|tsx|svg|xml|mermaid|markdown)\s*\n([\s\S]*?)(?:```|$)/i);
        if (fencedMatch && fencedMatch[2].trim().length > 15) {
            lang = fencedMatch[1].toLowerCase();
            code = fencedMatch[2].trim();
            title = lang === 'svg' ? 'SVG Vector Diagram' : (lang === 'mermaid' ? 'Architecture Diagram' : 'Interactive Application Artifact');
        } 
        // 2. Raw unfenced <svg ...> ... </svg>
        else {
            const rawSvgMatch = text.match(/(<svg[\s\S]+?<\/svg>)/i);
            if (rawSvgMatch && rawSvgMatch[1].length > 30) {
                lang = 'svg';
                code = rawSvgMatch[1].trim();
                title = 'SVG Vector Diagram';
            } else {
                const unclosedSvgMatch = text.match(/(<svg[\s\S]+)$/i);
                if (unclosedSvgMatch && unclosedSvgMatch[1].length > 30) {
                    lang = 'svg';
                    const rawContent = unclosedSvgMatch[1].trim();
                    code = rawContent + (rawContent.includes('</svg>') ? '' : '</svg>');
                    title = 'SVG Vector Diagram (Rendering...)';
                }
            }
        }

        if (code) {
            activeArtifact = {
                title: title,
                code: code,
                lang: lang
            };

            if (artifactActiveTitle) artifactActiveTitle.textContent = activeArtifact.title;

            let iframeContent = code;
            if (lang === 'svg') {
                iframeContent = `<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#faf9f5;padding:20px;box-sizing:border-box;}svg{max-width:100%;max-height:100%;height:auto;}</style></head><body>${code}</body></html>`;
            } else if ((lang === 'html' || lang === 'xml') && !iframeContent.includes('<html')) {
                iframeContent = `<!DOCTYPE html><html><head><style>body{font-family:sans-serif;padding:20px;background:#fff;color:#111;}</style></head><body>${code}</body></html>`;
            }

            if (artifactIframe) artifactIframe.srcdoc = iframeContent;
            if (artifactCodeBlock) {
                artifactCodeBlock.textContent = code;
                if (window.hljs) hljs.highlightElement(artifactCodeBlock);
            }

            if (autoOpenPanel) {
                openArtifactsPanel();
            }

            return activeArtifact;
        }

        return null;
    }

    initArtifactsPanel();

    // --- Message Loading & Rendering Engine ---
    function loadActiveThread() {
        const thread = threads.find(t => t.id === activeThreadId);
        if (!thread) return;

        currentThreadTitle.textContent = thread.title;
        messagesContainer.innerHTML = '';

        if (!thread.messages || thread.messages.length === 0) {
            welcomeScreen.style.display = 'flex';
            messagesContainer.appendChild(welcomeScreen);
            return;
        }

        welcomeScreen.style.display = 'none';

        thread.messages.forEach(msg => {
            appendMessageUI(msg.role, msg.content, false, msg.thinkingDuration);
        });

        triggerKaTeX(messagesContainer);
        scrollToBottom();
    }

    const thinkingVerbs = [
        "Pondering...",
        "Musing...",
        "Flabbergasting...",
        "Enchanting...",
        "Deliberating...",
        "Contemplating...",
        "Synthesizing...",
        "Ruminating...",
        "Brainstorming...",
        "Architecting...",
        "Weaving insights...",
        "Decoding intricacies..."
    ];

    let thinkingInterval = null;
    let thinkingStartTime = 0;
    let currentVerbIndex = 0;

    function renderAssistantMessageContent(content, thinkingDuration = null, isStreaming = false) {
        if (!content) return '';

        const duration = thinkingDuration || 1;
        const durationText = `Thought for ${duration} second${duration === 1 ? '' : 's'}`;

        let processed = content;

        // Automatically replace raw <svg>...</svg> blocks with a clean Artifact Banner Card in the chat bubble
        const rawSvgRegex = /<svg[\s\S]+?<\/svg>/gi;
        processed = processed.replace(rawSvgRegex, () => {
            return `\n\n<div class="artifact-card-banner" onclick="window.claudeOpenArtifactPanel && window.claudeOpenArtifactPanel()">
                <div class="artifact-banner-info">
                    <i class="fa-solid fa-shapes" style="color: var(--accent-terracotta); font-size: 18px;"></i>
                    <div>
                        <strong>SVG Vector Diagram Artifact</strong>
                        <div style="font-size: 11.5px; color: var(--text-muted);">Interactive SVG diagram rendered in background Artifact panel</div>
                    </div>
                </div>
                <button class="btn-icon"><i class="fa-solid fa-expand"></i> View</button>
            </div>\n\n`;
        });

        // Convert closed <think>...</think> or <reasoning>...</reasoning> tags to collapsible Thinking Block
        const thinkRegex = /<(think|reasoning)>([\s\S]*?)<\/\1>/gi;
        processed = processed.replace(thinkRegex, (match, tag, innerReasoning) => {
            const trimmed = innerReasoning.trim();
            const parsedReasoning = marked.parse(trimmed);

            return `
<details class="claude-thinking-block">
    <summary class="thinking-summary">
        <div class="starburst-loader starburst-loader-sm">
            <svg width="18" height="18" viewBox="0 0 100 100" class="starburst-spin">
                <g transform="translate(50,50)">
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(30)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(60)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(90)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(120)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(150)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(180)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(210)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(240)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(270)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(300)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(330)" />
                </g>
            </svg>
        </div>
        <span class="thinking-summary-text">${durationText}</span>
        <i class="fa-solid fa-chevron-down thinking-chevron"></i>
    </summary>
    <div class="thinking-content">
        ${parsedReasoning}
    </div>
</details>
`;
        });

        // Convert unclosed <think> or <reasoning> tags (live during streaming)
        const unclosedRegex = /<(think|reasoning)>([\s\S]*)$/i;
        const unclosedMatch = processed.match(unclosedRegex);
        if (unclosedMatch) {
            const openTagIndex = unclosedMatch.index;
            const innerReasoning = unclosedMatch[2].trim();
            const beforeText = processed.substring(0, openTagIndex);
            const parsedReasoning = marked.parse(innerReasoning);
            const activeVerb = thinkingVerbs[currentVerbIndex] || "Pondering...";

            processed = beforeText + `
<details class="claude-thinking-block" open>
    <summary class="thinking-summary">
        <div class="starburst-loader starburst-loader-sm">
            <svg width="18" height="18" viewBox="0 0 100 100" class="starburst-spin">
                <g transform="translate(50,50)">
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(30)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(60)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(90)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(120)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(150)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(180)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(210)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(240)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(270)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(300)" />
                    <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(330)" />
                </g>
            </svg>
        </div>
        <span class="thinking-summary-text">${activeVerb}</span>
        <i class="fa-solid fa-chevron-down thinking-chevron"></i>
    </summary>
    <div class="thinking-content">
        ${parsedReasoning}
    </div>
</details>
`;
        }

        return marked.parse(processed);
    }

    function appendMessageUI(role, content, isStreaming = false, thinkingDuration = null) {
        const row = document.createElement('div');
        row.className = `message-row ${role === 'user' ? 'user-message-row' : 'assistant-message-row'}`;

        if (role === 'user') {
            row.innerHTML = `
                <div class="user-message-bubble">${escapeHtml(content).replace(/\n/g, '<br>')}</div>
            `;
        } else {
            const renderedHtml = renderAssistantMessageContent(content || '', thinkingDuration, isStreaming);
            row.innerHTML = `
                <div class="assistant-content">${renderedHtml}</div>
                <div class="message-action-bar">
                    <button class="action-icon-btn btn-copy" title="Copy message"><i class="fa-regular fa-copy"></i></button>
                    <button class="action-icon-btn btn-speak" title="Read Aloud"><i class="fa-solid fa-volume-high"></i></button>
                    <button class="action-icon-btn btn-like" title="Good response"><i class="fa-regular fa-thumbs-up"></i></button>
                    <button class="action-icon-btn btn-dislike" title="Bad response"><i class="fa-regular fa-thumbs-down"></i></button>
                    <button class="action-icon-btn btn-retry" title="Retry generation"><i class="fa-solid fa-rotate-right"></i></button>
                </div>
            `;

            // Wire actions
            const btnCopy = row.querySelector('.btn-copy');
            const btnSpeak = row.querySelector('.btn-speak');
            const btnRetry = row.querySelector('.btn-retry');

            if (btnCopy) {
                btnCopy.addEventListener('click', () => {
                    navigator.clipboard.writeText(content);
                    btnCopy.innerHTML = '<i class="fa-solid fa-check"></i>';
                    setTimeout(() => btnCopy.innerHTML = '<i class="fa-regular fa-copy"></i>', 2000);
                });
            }

            if (btnSpeak) {
                btnSpeak.addEventListener('click', () => speakText(content, btnSpeak));
            }

            if (btnRetry) {
                btnRetry.addEventListener('click', () => {
                    const thread = threads.find(t => t.id === activeThreadId);
                    if (thread && thread.messages.length >= 2) {
                        const lastUser = thread.messages[thread.messages.length - 2].content;
                        sendMessage(lastUser);
                    }
                });
            }
        }

        messagesContainer.appendChild(row);
        scrollToBottom();
        return row;
    }

    function showThinkingSpinner() {
        removeThinkingSpinner();
        thinkingStartTime = Date.now();
        currentVerbIndex = Math.floor(Math.random() * thinkingVerbs.length);

        const spinner = document.createElement('div');
        spinner.id = 'active-thinking-spinner';
        spinner.className = 'message-row assistant-message-row thinking-active-row';
        spinner.innerHTML = `
            <div class="thinking-status-wrapper">
                <div class="starburst-loader">
                    <svg width="22" height="22" viewBox="0 0 100 100" class="starburst-spin">
                        <g transform="translate(50,50)">
                            <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" />
                            <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(30)" />
                            <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(60)" />
                            <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(90)" />
                            <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(120)" />
                            <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(150)" />
                            <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(180)" />
                            <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(210)" />
                            <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(240)" />
                            <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(270)" />
                            <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(300)" />
                            <rect x="-6" y="-40" width="12" height="24" rx="6" fill="#d97757" transform="rotate(330)" />
                        </g>
                    </svg>
                </div>
                <span id="thinking-verb-text" class="thinking-verb">${thinkingVerbs[currentVerbIndex]}</span>
            </div>
        `;
        messagesContainer.appendChild(spinner);
        scrollToBottom();

        thinkingInterval = setInterval(() => {
            currentVerbIndex = (currentVerbIndex + 1) % thinkingVerbs.length;
            const verbEl = document.getElementById('thinking-verb-text');
            if (verbEl) {
                verbEl.classList.add('verb-fade-out');
                setTimeout(() => {
                    verbEl.textContent = thinkingVerbs[currentVerbIndex];
                    verbEl.classList.remove('verb-fade-out');
                }, 200);
            }
        }, 2200);
    }

    function removeThinkingSpinner() {
        if (thinkingInterval) {
            clearInterval(thinkingInterval);
            thinkingInterval = null;
        }
        const spinner = document.getElementById('active-thinking-spinner');
        if (spinner) spinner.remove();
    }

    // --- Messaging & Streaming Request Dispatcher ---
    async function sendMessage(overrideText = null) {
        let text = (overrideText || promptInput.value).trim();
        if (!text && attachedFiles.length === 0) return;

        if (!overrideText) {
            promptInput.value = '';
            autoResizeTextarea();
        }

        const thread = threads.find(t => t.id === activeThreadId);
        if (!thread) return;

        // Process attachments into message content if any
        if (attachedFiles.length > 0) {
            const attachmentNotes = attachedFiles.map(f => {
                if (f.isText && f.textContent) {
                    return `[Attachment: ${f.name} (${f.formattedSize})]\n\`\`\`\n${f.textContent}\n\`\`\``;
                } else {
                    return `[Attachment: ${f.name} (${f.formattedSize})]`;
                }
            }).join('\n\n');

            text = text ? `${text}\n\n${attachmentNotes}` : attachmentNotes;
            attachedFiles = [];
            renderAttachmentPreview();
        }

        // Hide welcome screen
        if (welcomeScreen) welcomeScreen.style.display = 'none';

        // Save & append user message
        thread.messages.push({ role: 'user', content: text });
        if (thread.messages.length === 1) {
            thread.title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
            currentThreadTitle.textContent = thread.title;
            renderThreadsList();
        }
        localStorage.setItem('claude_threads', JSON.stringify(threads));
        appendMessageUI('user', text);

        showThinkingSpinner();

        // Check if model is Deep Research Agent
        const isDeepResearch = selectedModel === 'claude-peryl-deep-research';
        if (isDeepResearch) {
            subagentStatusBar.style.display = 'flex';
            subagentStatusText.textContent = `Deep Research Subagents analyzing query: "${text.slice(0, 40)}..."`;
        }

        // Attach active project context & custom settings system instructions
        const activeProj = projects.find(p => p.id === activeProjectId);
        let combinedSystemPrompt = customSettings.systemPrompt || '';
        if (activeProj && activeProj.instructions) {
            combinedSystemPrompt += `\n\nPROJECT WORKSPACE CONTEXT (${activeProj.name}):\n${activeProj.instructions}`;
        }
        if (customSettings.writingStyle && customSettings.writingStyle !== 'normal') {
            combinedSystemPrompt += `\n\nWRITING STYLE PREFERENCE: ${customSettings.writingStyle.toUpperCase()}`;
        }

        try {
            const response = await fetch('/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: thread.messages,
                    system: combinedSystemPrompt,
                    stream: true,
                    deep_research: isDeepResearch
                })
            });

            const elapsedSeconds = Math.max(1, Math.round((Date.now() - thinkingStartTime) / 1000));
            removeThinkingSpinner();

            if (!response.ok) {
                appendMessageUI('assistant', 'An error occurred while connecting to Claude Peryl backend service.');
                subagentStatusBar.style.display = 'none';
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let assistantText = '';
            let assistantRow = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim() || line.startsWith('event:')) continue;
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6).trim();
                        if (dataStr === '[DONE]') break;
                        try {
                            const json = JSON.parse(dataStr);
                            if (json.type === 'content_block_delta') {
                                const deltaText = json.delta?.text || '';
                                assistantText += deltaText;

                                if (!assistantRow) {
                                    assistantRow = appendMessageUI('assistant', assistantText, true, elapsedSeconds);
                                } else {
                                    const contentDiv = assistantRow.querySelector('.assistant-content');
                                    contentDiv.innerHTML = renderAssistantMessageContent(assistantText, elapsedSeconds, true);
                                }
                                detectAndRenderArtifacts(assistantText, true);
                                scrollToBottom();
                            } else if (json.type === 'subagent_step') {
                                subagentStatusText.textContent = json.message;
                            }
                        } catch (err) {
                            // Non-JSON delta line
                        }
                    }
                }
            }

            subagentStatusBar.style.display = 'none';

            // Ensure final render of assistant message row with complete thinking block if present
            if (assistantRow) {
                const contentDiv = assistantRow.querySelector('.assistant-content');
                contentDiv.innerHTML = renderAssistantMessageContent(assistantText, elapsedSeconds, false);
            }

            // Check for Artifact code blocks inside assistant output
            detectAndRenderArtifacts(assistantText);

            // Save completed assistant message with calculated thinkingDuration
            thread.messages.push({
                role: 'assistant',
                content: assistantText,
                thinkingDuration: elapsedSeconds
            });
            localStorage.setItem('claude_threads', JSON.stringify(threads));

            // Trigger KaTeX rendering
            triggerKaTeX(messagesContainer);

            // Read aloud if enabled
            if (isSpeechOutputEnabled && assistantText) {
                speakText(assistantText, null);
            }

        } catch (e) {
            console.error('Messaging error:', e);
            removeThinkingSpinner();
            subagentStatusBar.style.display = 'none';
            appendMessageUI('assistant', 'Network error. Failed to complete stream.');
        }
    }

    // --- General Event Listeners & UI Wire-up ---
    if (btnSend) btnSend.addEventListener('click', () => sendMessage());

    if (promptInput) {
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        promptInput.addEventListener('input', autoResizeTextarea);
    }

    function autoResizeTextarea() {
        if (!promptInput) return;
        promptInput.style.height = 'auto';
        promptInput.style.height = Math.min(promptInput.scrollHeight, 200) + 'px';
    }

    // Sidebar Toggles
    if (btnSidebarCollapse) {
        btnSidebarCollapse.addEventListener('click', () => {
            sidebar.classList.add('collapsed');
            btnSidebarExpand.style.display = 'flex';
        });
    }

    if (btnSidebarExpand) {
        btnSidebarExpand.addEventListener('click', () => {
            sidebar.classList.remove('collapsed');
            btnSidebarExpand.style.display = 'none';
        });
    }

    // New Chat Button
    if (btnNewChat) {
        btnNewChat.addEventListener('click', () => {
            const newId = 'thread_' + Date.now();
            threads.unshift({
                id: newId,
                title: 'New Conversation',
                timestamp: Date.now(),
                messages: []
            });
            activeThreadId = newId;
            localStorage.setItem('claude_threads', JSON.stringify(threads));
            renderThreadsList();
            loadActiveThread();
        });
    }

    // Suggestion Cards
    document.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
            const prompt = card.getAttribute('data-prompt');
            if (prompt) sendMessage(prompt);
        });
    });

    // Model Selector Dropdown
    if (modelSelectBtn && modelSelectMenu) {
        modelSelectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            modelSelectMenu.style.display = modelSelectMenu.style.display === 'none' ? 'flex' : 'none';
        });

        modelSelectMenu.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                selectedModel = item.getAttribute('data-model');
                selectedModelName.textContent = item.querySelector('.model-option-title').textContent;
                modelSelectMenu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                modelSelectMenu.style.display = 'none';
            });
        });
    }

    // Dismiss Dropdowns on outside click
    document.addEventListener('click', () => {
        if (modelSelectMenu) modelSelectMenu.style.display = 'none';
        if (chatTitleMenu) chatTitleMenu.style.display = 'none';
    });

    // Notifications Banner
    if (btnNotifyClose && notificationBanner) {
        btnNotifyClose.addEventListener('click', () => notificationBanner.style.display = 'none');
    }
    if (btnNotifyEnable && notificationBanner) {
        btnNotifyEnable.addEventListener('click', () => {
            notificationBanner.style.display = 'none';
            if ('Notification' in window) {
                Notification.requestPermission();
                showToast('Notifications enabled!');
            }
        });
    }

    // Header Plan Upgrade Banner & Buttons
    const btnPlanUpgrade = document.getElementById('btn-plan-upgrade');
    if (btnPlanUpgrade) {
        btnPlanUpgrade.addEventListener('click', () => {
            showToast('You are running Claude Peryl 5 Mythos engine with full desktop capabilities.');
        });
    }

    if (btnPlanBannerClose) {
        btnPlanBannerClose.addEventListener('click', () => {
            const banner = btnPlanBannerClose.closest('.plan-upgrade-banner');
            if (banner) banner.style.display = 'none';
        });
    }

    // Header Share Chat Button
    const btnShareChat = document.getElementById('btn-share-chat');
    if (btnShareChat) {
        btnShareChat.addEventListener('click', () => {
            const thread = threads.find(t => t.id === activeThreadId);
            if (thread && thread.messages && thread.messages.length > 0) {
                let markdown = `# ${thread.title}\n\n`;
                thread.messages.forEach((msg) => {
                    const roleName = msg.role === 'user' ? 'User' : 'Claude';
                    markdown += `### ${roleName}\n\n${msg.content}\n\n`;
                });
                navigator.clipboard.writeText(markdown);
                showToast('Chat transcript copied to clipboard!');
            } else {
                showToast('No messages to share in this chat.');
            }
        });
    }

    // User Footer Menu Button
    const btnUserMenu = document.getElementById('btn-user-menu');
    if (btnUserMenu) {
        btnUserMenu.addEventListener('click', () => {
            if (customizeModal) customizeModal.style.display = 'flex';
        });
    }

    // Sidebar Products - Design button
    const btnProductDesign = document.getElementById('btn-product-design');
    if (btnProductDesign) {
        btnProductDesign.addEventListener('click', () => {
            openArtifactsPanel();
            showToast('Opened Design & Artifacts split panel.');
        });
    }

    // Sidebar Nav View Switching
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');
            if (view === 'chats') {
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
            }
        });
    });

    // Navigation Modals Trigger
    if (btnNavProjects) btnNavProjects.addEventListener('click', () => {
        if (projectsModal) projectsModal.style.display = 'flex';
    });
    if (btnNavArtifacts) btnNavArtifacts.addEventListener('click', () => openArtifactsPanel());
    if (btnNavCustomize) btnNavCustomize.addEventListener('click', () => {
        if (customizeModal) customizeModal.style.display = 'flex';
    });

    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-modal');
            if (targetId) document.getElementById(targetId).style.display = 'none';
        });
    });
});

