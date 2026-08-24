(() => {
  'use strict';

  const STORAGE_PREFIX = 'live-editor.project.';
  const INDEX_KEY = 'live-editor.projects';
  const FONT_SIZE_KEY = 'live-editor.editor-font-size';
  const THEME_KEY = 'live-editor.theme';
  const MIN_EDITOR_FONT_SIZE = 12;
  const MAX_EDITOR_FONT_SIZE = 22;
  const DEFAULT_TITLE = 'Meu projeto';
  const editorDefinitions = [
    { name: 'html', textarea: 'html-code', mode: 'htmlmixed' },
    { name: 'css', textarea: 'css-code', mode: 'css' },
    { name: 'javascript', textarea: 'javascript-code', mode: 'javascript' },
  ];
  const editors = {};
  let projectAssets = [];
  let projectDescription = '';
  let renderTimer;
  let toastTimer;

  const titleInput = document.querySelector('#project-title');
  const projectDescriptionButton = document.querySelector('#project-description-button');
  const projectDescriptionDialog = document.querySelector('#project-description-dialog');
  const projectDescriptionInput = document.querySelector('#project-description');
  const descriptionCount = document.querySelector('#description-count');
  const preview = document.querySelector('#preview-frame');
  const previewError = document.querySelector('#preview-error');
  const projectsButton = document.querySelector('#projects-button');
  const projectsPopover = document.querySelector('#projects-popover');
  const projectsList = document.querySelector('#projects-list');
  const examplesButton = document.querySelector('#examples-button');
  const examplesPopover = document.querySelector('#examples-popover');
  const examplesList = document.querySelector('#examples-list');
  const fileMenuButton = document.querySelector('#file-menu-button');
  const filePopover = document.querySelector('#file-popover');
  const toast = document.querySelector('#toast');
  const workspace = document.querySelector('.workspace');
  const workspaceResizer = document.querySelector('#workspace-resizer');
  const fontDecrease = document.querySelector('#font-decrease');
  const fontIncrease = document.querySelector('#font-increase');
  const fontSizeValue = document.querySelector('#font-size-value');
  const themeSelect = document.querySelector('#theme-select');
  const assetsButton = document.querySelector('#assets-button');
  const assetsDialog = document.querySelector('#assets-dialog');
  const assetsForm = document.querySelector('#assets-form');
  const assetType = document.querySelector('#asset-type');
  const assetUrl = document.querySelector('#asset-url');
  const assetList = document.querySelector('#asset-list');
  const assetFormError = document.querySelector('#asset-form-error');
  const importButton = document.querySelector('#import-button');
  const importDialog = document.querySelector('#import-dialog');
  const codePenUrl = document.querySelector('#codepen-url');
  const importLinkButton = document.querySelector('#import-link-button');
  const importZipFile = document.querySelector('#import-zip-file');
  const importZipButton = document.querySelector('#import-zip-button');
  const importError = document.querySelector('#import-error');
  let editorFontSize = MIN_EDITOR_FONT_SIZE;
  let themePreference = 'system';
  const prefersDarkTheme = window.matchMedia('(prefers-color-scheme: dark)');

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function safeTitle() {
    return titleInput.value.trim().slice(0, 100) || DEFAULT_TITLE;
  }

  function getCode(name) {
    return editors[name] ? editors[name].getValue() : document.querySelector(`#${name}-code`).value;
  }

  function getProject() {
    return { title: safeTitle(), description: projectDescription, html: getCode('html'), css: getCode('css'), javascript: getCode('javascript'), assets: projectAssets.map((asset) => ({ ...asset })), updatedAt: new Date().toISOString() };
  }

  function escapeClosingTag(code, tagName) {
    return code.replace(new RegExp(`</${tagName}`, 'gi'), `<\\/${tagName}`);
  }

  function escapeAttribute(value) {
    return value.replace(/[<>&"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[char]);
  }

  function normalizeAssets(assets) {
    if (!Array.isArray(assets)) return [];
    return assets.flatMap((asset) => {
      if (!asset || !['css', 'javascript', 'font'].includes(asset.type) || typeof asset.url !== 'string') return [];
      try {
        const url = new URL(asset.url.trim());
        return ['https:', 'http:'].includes(url.protocol) ? [{ type: asset.type, url: url.href }] : [];
      } catch { return []; }
    });
  }

  function createDocument(project = getProject()) {
    const css = escapeClosingTag(project.css, 'style');
    const javascript = escapeClosingTag(project.javascript, 'script');
    const title = project.title.replace(/[<>&"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[char]);
    const assets = normalizeAssets(project.assets);
    const styleAssets = assets.filter((asset) => asset.type === 'css' || asset.type === 'font').map((asset) => `<link rel="stylesheet" href="${escapeAttribute(asset.url)}">`).join('');
    const scriptAssets = assets.filter((asset) => asset.type === 'javascript').map((asset) => `<script src="${escapeAttribute(asset.url)}"></script>`).join('');
    const errorBridge = `window.addEventListener('error', function (event) { parent.postMessage({ source: 'live-editor', type: 'error', message: event.message || 'Erro no JavaScript.' }, '*'); }); window.addEventListener('unhandledrejection', function (event) { parent.postMessage({ source: 'live-editor', type: 'error', message: String(event.reason || 'Promise rejeitada.') }, '*'); });`;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>${styleAssets}<style>${css}</style></head><body>${project.html}${scriptAssets}<script>${errorBridge}</script><script>${javascript}</script></body></html>`;
  }

  function renderPreview() {
    previewError.hidden = true;
    preview.srcdoc = createDocument();
  }

  function queueRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderPreview, 220);
  }

  function initEditors() {
    const hasCodeMirror = typeof window.CodeMirror === 'function';
    editorDefinitions.forEach(({ name, textarea, mode }) => {
      const element = document.querySelector(`#${textarea}`);
      if (!hasCodeMirror) {
        element.addEventListener('input', queueRender);
        return;
      }
      const editor = window.CodeMirror.fromTextArea(element, { mode, theme: 'dracula', lineNumbers: true, lineWrapping: true, tabSize: 2, indentWithTabs: false });
      editor.on('change', queueRender);
      editors[name] = editor;
    });
    if (!hasCodeMirror) showToast('O editor avançado não carregou. Você ainda pode editar normalmente.');
  }

  function applyEditorFontSize(size) {
    editorFontSize = Math.min(MAX_EDITOR_FONT_SIZE, Math.max(MIN_EDITOR_FONT_SIZE, size));
    document.documentElement.style.setProperty('--editor-font-size', `${editorFontSize}px`);
    fontSizeValue.value = `${editorFontSize} px`;
    fontDecrease.disabled = editorFontSize === MIN_EDITOR_FONT_SIZE;
    fontIncrease.disabled = editorFontSize === MAX_EDITOR_FONT_SIZE;
    try { localStorage.setItem(FONT_SIZE_KEY, String(editorFontSize)); } catch { /* Preference is optional. */ }
    Object.values(editors).forEach((editor) => editor.refresh());
  }

  function restoreEditorFontSize() {
    let storedSize = 15;
    try { storedSize = Number(localStorage.getItem(FONT_SIZE_KEY)) || 15; } catch { /* Use the default. */ }
    applyEditorFontSize(storedSize);
  }

  function resolvedTheme(preference) {
    return preference === 'system' ? (prefersDarkTheme.matches ? 'dark' : 'light') : preference;
  }

  function applyTheme(preference, persist = true) {
    themePreference = ['system', 'light', 'dark'].includes(preference) ? preference : 'system';
    const actualTheme = resolvedTheme(themePreference);
    document.documentElement.dataset.theme = actualTheme;
    themeSelect.value = themePreference;
    Object.values(editors).forEach((editor) => editor.setOption('theme', actualTheme === 'dark' ? 'dracula' : 'default'));
    if (persist) { try { localStorage.setItem(THEME_KEY, themePreference); } catch { /* Preference is optional. */ } }
  }

  function restoreTheme() {
    let storedTheme = 'system';
    try { storedTheme = localStorage.getItem(THEME_KEY) || 'system'; } catch { /* Use the system preference. */ }
    applyTheme(storedTheme, false);
  }

  function setProject(project) {
    titleInput.value = project.title || DEFAULT_TITLE;
    projectDescription = typeof project.description === 'string' ? project.description.slice(0, 1000) : '';
    projectAssets = normalizeAssets(project.assets);
    renderAssets();
    editorDefinitions.forEach(({ name }) => {
      const value = project[name] || '';
      if (editors[name]) editors[name].setValue(value);
      else document.querySelector(`#${name}-code`).value = value;
    });
    openPanel('html');
    queueRender();
  }

  function newProject() {
    if (!window.confirm('Iniciar um novo projeto? O código atual que não foi salvo será perdido.')) return;
    setProject({ title: 'Novo projeto', description: '', html: '', css: '', javascript: '', assets: [] });
    titleInput.focus();
    titleInput.select();
    showToast('Novo projeto iniciado.');
  }

  function getProjectNames() {
    try {
      const names = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
      return Array.isArray(names) ? names.filter((name) => typeof name === 'string') : [];
    } catch { return []; }
  }

  function saveProject() {
    const project = getProject();
    const key = STORAGE_PREFIX + project.title;
    if (localStorage.getItem(key) && !window.confirm(`Já existe um projeto chamado “${project.title}”. Deseja substituí-lo?`)) return;
    try {
      localStorage.setItem(key, JSON.stringify(project));
      const names = getProjectNames().filter((name) => name !== project.title);
      names.unshift(project.title);
      localStorage.setItem(INDEX_KEY, JSON.stringify(names));
      renderProjects();
      showToast(`“${project.title}” foi salvo neste dispositivo.`);
    } catch { showToast('Não foi possível salvar: o armazenamento local está indisponível ou cheio.'); }
  }

  function renderProjects() {
    projectsList.replaceChildren();
    const names = getProjectNames();
    if (!names.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-projects';
      empty.textContent = 'Ainda não há projetos salvos.';
      projectsList.append(empty);
      return;
    }
    names.forEach((name) => {
      const row = document.createElement('div');
      row.className = 'saved-project';
      const load = document.createElement('button');
      load.className = 'load-project';
      load.type = 'button';
      load.textContent = name;
      load.title = `Carregar ${name}`;
      load.addEventListener('click', () => loadProject(name));
      const remove = document.createElement('button');
      remove.className = 'delete-project';
      remove.type = 'button';
      remove.textContent = '×';
      remove.title = `Excluir ${name}`;
      remove.setAttribute('aria-label', `Excluir ${name}`);
      remove.addEventListener('click', () => deleteProject(name));
      row.append(load, remove);
      projectsList.append(row);
    });
  }

  function loadProject(name) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + name);
      if (!raw) throw new Error('Projeto não encontrado');
      setProject(JSON.parse(raw));
      closeProjects();
      showToast(`“${name}” foi carregado.`);
    } catch { showToast('Não foi possível carregar este projeto.'); }
  }

  function deleteProject(name) {
    if (!window.confirm(`Excluir permanentemente o projeto “${name}”?`)) return;
    localStorage.removeItem(STORAGE_PREFIX + name);
    localStorage.setItem(INDEX_KEY, JSON.stringify(getProjectNames().filter((item) => item !== name)));
    renderProjects();
    showToast(`“${name}” foi excluído.`);
  }

  function toggleProjects() {
    const willOpen = projectsPopover.hidden;
    projectsPopover.hidden = !willOpen;
    projectsButton.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) {
      closeExamples();
      closeFileMenu();
      renderProjects();
    }
  }

  function closeProjects() {
    projectsPopover.hidden = true;
    projectsButton.setAttribute('aria-expanded', 'false');
  }

  function toggleFileMenu() {
    const willOpen = filePopover.hidden;
    filePopover.hidden = !willOpen;
    fileMenuButton.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) {
      closeProjects();
      closeExamples();
    }
  }

  function closeFileMenu() {
    filePopover.hidden = true;
    fileMenuButton.setAttribute('aria-expanded', 'false');
  }

  function closeExamples() {
    examplesPopover.hidden = true;
    examplesButton.setAttribute('aria-expanded', 'false');
  }

  function catalogSlug(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function renderExamples(items) {
    examplesList.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-projects';
      empty.textContent = 'Nenhum exemplo disponível.';
      examplesList.append(empty);
      return;
    }
    items.forEach((item) => {
      const button = document.createElement('button');
      button.className = 'example-item';
      button.type = 'button';
      const type = document.createElement('span');
      type.className = `example-type example-type-${item.type.toLowerCase()}`;
      type.textContent = item.type;
      const title = document.createElement('span');
      title.className = 'example-title';
      title.textContent = item.title;
      button.append(type, title);
      button.addEventListener('click', () => loadExample(item));
      examplesList.append(button);
    });
  }

  async function toggleExamples() {
    const willOpen = examplesPopover.hidden;
    examplesPopover.hidden = !willOpen;
    examplesButton.setAttribute('aria-expanded', String(willOpen));
    if (!willOpen) return;
    closeProjects();
    closeFileMenu();
    examplesList.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'empty-projects';
    loading.textContent = 'Carregando exemplos…';
    examplesList.append(loading);
    try {
      const response = await fetch('catalog/index.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Índice indisponível');
      const items = await response.json();
      if (!Array.isArray(items)) throw new Error('Índice inválido');
      const typeOrder = { HTML: 0, CSS: 1, JS: 2 };
      const validItems = items
        .filter((item) => item && typeof item.type === 'string' && typeof item.title === 'string')
        .sort((first, second) => (typeOrder[first.type] ?? 99) - (typeOrder[second.type] ?? 99) || first.title.localeCompare(second.title, 'pt-BR'));
      renderExamples(validItems);
    } catch {
      examplesList.replaceChildren();
      const error = document.createElement('p');
      error.className = 'empty-projects';
      error.textContent = 'Não foi possível carregar o catálogo. Abra o editor por um servidor local ou hospedado.';
      examplesList.append(error);
    }
  }

  async function loadExample(item) {
    try {
      const response = await fetch(`catalog/${catalogSlug(`${item.type}-${item.title}`)}.json`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Exemplo indisponível');
      const example = await response.json();
      if (!window.confirm(`Carregar o exemplo “${item.title}”? O projeto atual que não foi salvo será substituído.`)) return;
      setProject({
        title: typeof example.title === 'string' ? example.title : item.title,
        description: typeof example.description === 'string' ? example.description : '',
        html: typeof example.html === 'string' ? example.html : '',
        css: typeof example.css === 'string' ? example.css : '',
        javascript: typeof example.javascript === 'string' ? example.javascript : '',
        assets: normalizeAssets(example.assets),
      });
      closeExamples();
      showToast(`Exemplo “${item.title}” carregado.`);
    } catch {
      showToast('Não foi possível carregar este exemplo. Verifique o arquivo correspondente na pasta catalog.');
    }
  }
  function updateDescriptionCount() {
    descriptionCount.value = String(projectDescriptionInput.value.length);
  }

  function openProjectDescription() {
    projectDescriptionInput.value = projectDescription;
    updateDescriptionCount();
    projectDescriptionDialog.showModal();
    projectDescriptionInput.focus();
  }

  function closeProjectDescription() {
    projectDescriptionDialog.close();
  }

  function saveProjectDescription() {
    projectDescription = projectDescriptionInput.value.slice(0, 1000);
    closeProjectDescription();
    showToast('Descrição atualizada. Salve o projeto para mantê-la neste dispositivo.');
  }

  function openPanel(panelName) {
    document.querySelectorAll('.code-panel').forEach((panel) => {
      const open = panel.dataset.panel === panelName;
      panel.classList.toggle('is-open', open);
      panel.querySelector('.panel-toggle').setAttribute('aria-expanded', String(open));
    });
    window.setTimeout(() => editors[panelName]?.refresh(), 240);
  }

  function assetTypeLabel(type) {
    return ({ css: 'CSS', javascript: 'JS', font: 'FONTE' })[type];
  }

  function renderAssets() {
    assetList.replaceChildren();
    if (!projectAssets.length) {
      const empty = document.createElement('p');
      empty.className = 'asset-empty';
      empty.textContent = 'Nenhum asset externo incluído.';
      assetList.append(empty);
      return;
    }
    projectAssets.forEach((asset, index) => {
      const row = document.createElement('div');
      row.className = 'asset-row';
      const kind = document.createElement('span');
      kind.className = 'asset-kind';
      kind.textContent = assetTypeLabel(asset.type);
      const url = document.createElement('span');
      url.className = 'asset-url-text';
      url.textContent = asset.url;
      url.title = asset.url;
      const remove = document.createElement('button');
      remove.className = 'remove-asset';
      remove.type = 'button';
      remove.textContent = '×';
      remove.title = `Remover ${assetTypeLabel(asset.type)}`;
      remove.setAttribute('aria-label', `Remover ${asset.url}`);
      remove.addEventListener('click', () => { projectAssets.splice(index, 1); renderAssets(); queueRender(); });
      row.append(kind, url, remove);
      assetList.append(row);
    });
  }

  function showAssetError(message = '') {
    assetFormError.textContent = message;
    assetFormError.hidden = !message;
  }

  function addAsset() {
    const url = assetUrl.value.trim();
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error();
      projectAssets.push({ type: assetType.value, url: parsed.href });
      assetUrl.value = '';
      showAssetError();
      renderAssets();
      queueRender();
      assetUrl.focus();
    } catch { showAssetError('Informe uma URL válida que comece com http:// ou https://.'); }
  }

  function openAssetsDialog() {
    renderAssets();
    showAssetError();
    assetsDialog.showModal();
    assetUrl.focus();
  }

  function showImportError(message = '') {
    importError.textContent = message;
    importError.hidden = !message;
  }

  function openImportDialog() {
    showImportError();
    importDialog.showModal();
    codePenUrl.focus();
  }

  function closeImportDialog() {
    importDialog.close();
    showImportError();
  }

  function confirmImport() {
    return window.confirm('Importar este projeto? O código atual que não foi salvo será substituído.');
  }

  function bodyFromMarkup(markup) {
    return new DOMParser().parseFromString(markup, 'text/html').body.innerHTML;
  }

  function externalAssetsFromMarkup(markup) {
    const documentContent = new DOMParser().parseFromString(markup, 'text/html');
    const assets = [];
    documentContent.querySelectorAll('link[rel~="stylesheet"][href]').forEach((link) => {
      try {
        const url = new URL(link.href);
        if (['https:', 'http:'].includes(url.protocol)) assets.push({ type: /font/i.test(url.hostname) ? 'font' : 'css', url: url.href });
      } catch { /* Ignore relative and malformed resource URLs. */ }
    });
    documentContent.querySelectorAll('script[src]').forEach((script) => {
      try {
        const url = new URL(script.src);
        if (['https:', 'http:'].includes(url.protocol)) assets.push({ type: 'javascript', url: url.href });
      } catch { /* Ignore relative and malformed resource URLs. */ }
    });
    return normalizeAssets(assets);
  }

  function parseCodePenUrl(value) {
    const url = new URL(value.trim());
    if (!/^(www\.)?codepen\.io$/i.test(url.hostname)) throw new Error('Use uma URL de Pen no formato codepen.io/usuario/pen/slug.');
    const match = url.pathname.match(/^\/([^/]+)\/pen\/([^/]+)\/?$/);
    if (!match) throw new Error('Use uma URL de Pen no formato codepen.io/usuario/pen/slug.');
    return { user: match[1], slug: match[2], baseUrl: `https://codepen.io/${match[1]}/pen/${match[2]}` };
  }

  async function importCodePenLink() {
    let pen;
    try { pen = parseCodePenUrl(codePenUrl.value); } catch (error) { showImportError(error.message); return; }
    if (!confirmImport()) return;
    importLinkButton.disabled = true;
    importLinkButton.textContent = 'Importando…';
    showImportError();
    try {
      const responses = await Promise.all(['html', 'css', 'js'].map(async (extension) => {
        const response = await fetch(`${pen.baseUrl}.${extension}`);
        if (!response.ok) throw new Error(`O CodePen respondeu com ${response.status}.`);
        return response.text();
      }));
      const [html, css, javascript] = await Promise.all(responses);
      setProject({ title: `${pen.user}-${pen.slug}`, html: bodyFromMarkup(html), css, javascript, assets: [] });
      closeImportDialog();
      showToast('Projeto importado do CodePen.');
    } catch {
      showImportError('Não foi possível ler este Pen. O CodePen pode bloquear o acesso direto; tente importar o ZIP exportado.');
    } finally {
      importLinkButton.disabled = false;
      importLinkButton.textContent = 'Importar URL';
    }
  }

  function findZipFile(files, extension, preferredName) {
    const sourceFiles = files.filter((file) => /(^|\/)src\//i.test(file.name));
    const candidates = sourceFiles.length ? sourceFiles : files;
    return candidates.find((file) => new RegExp(`(^|/)${preferredName.replace('.', '\\.')}$$`, 'i').test(file.name))
      || candidates.find((file) => new RegExp(`\\.${extension}$$`, 'i').test(file.name))
      || files.find((file) => new RegExp(`\\.${extension}$$`, 'i').test(file.name));
  }

  async function importCodePenZip() {
    const file = importZipFile.files[0];
    if (!file) { showImportError('Selecione primeiro um arquivo ZIP exportado pelo CodePen.'); return; }
    if (typeof window.JSZip !== 'function') { showImportError('A biblioteca de ZIP ainda não carregou. Tente novamente.'); return; }
    if (!confirmImport()) return;
    importZipButton.disabled = true;
    importZipButton.textContent = 'Importando…';
    showImportError();
    try {
      const zip = await window.JSZip.loadAsync(file);
      const files = Object.values(zip.files).filter((entry) => !entry.dir);
      const htmlFile = findZipFile(files, 'html', 'index.html');
      if (!htmlFile) throw new Error('HTML ausente');
      const cssFile = findZipFile(files, 'css', 'style.css');
      const javascriptFile = findZipFile(files, 'js', 'script.js');
      const markup = await htmlFile.async('string');
      const parsedMarkup = new DOMParser().parseFromString(markup, 'text/html');
      const css = cssFile ? await cssFile.async('string') : (parsedMarkup.querySelector('style')?.textContent || '');
      const javascript = javascriptFile ? await javascriptFile.async('string') : [...parsedMarkup.querySelectorAll('script:not([src])')].map((script) => script.textContent).join('\n\n');
      const filenameTitle = file.name.replace(/\.zip$/i, '').replace(/[-_]+/g, ' ').trim();
      setProject({ title: parsedMarkup.title || filenameTitle || 'Projeto importado', html: parsedMarkup.body.innerHTML, css, javascript, assets: externalAssetsFromMarkup(markup) });
      importZipFile.value = '';
      closeImportDialog();
      showToast('Projeto importado do arquivo ZIP.');
    } catch {
      showImportError('Não foi possível encontrar o HTML do projeto neste ZIP. Exporte o Pen pelo menu Exportar do CodePen e tente novamente.');
    } finally {
      importZipButton.disabled = false;
      importZipButton.textContent = 'Importar ZIP';
    }
  }

  function setEditorWidth(width) {
    const bounds = workspace.getBoundingClientRect();
    const minimumWidth = 320;
    const maximumWidth = Math.max(minimumWidth, bounds.width - 332);
    const nextWidth = Math.round(Math.min(maximumWidth, Math.max(minimumWidth, width)));
    workspace.style.setProperty('--editor-width', `${nextWidth}px`);
    workspaceResizer.setAttribute('aria-valuenow', String(Math.round((nextWidth / bounds.width) * 100)));
    Object.values(editors).forEach((editor) => editor.refresh());
  }

  function resizeFromPointer(event) {
    setEditorWidth(event.clientX - workspace.getBoundingClientRect().left);
  }

  function initWorkspaceResizer() {
    workspaceResizer.addEventListener('pointerdown', (event) => {
      workspaceResizer.setPointerCapture(event.pointerId);
      document.body.classList.add('is-resizing');
      resizeFromPointer(event);
    });
    workspaceResizer.addEventListener('pointermove', (event) => {
      if (workspaceResizer.hasPointerCapture(event.pointerId)) resizeFromPointer(event);
    });
    workspaceResizer.addEventListener('pointerup', (event) => {
      if (workspaceResizer.hasPointerCapture(event.pointerId)) workspaceResizer.releasePointerCapture(event.pointerId);
      document.body.classList.remove('is-resizing');
    });
    workspaceResizer.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const bounds = workspace.getBoundingClientRect();
      if (event.key === 'Home') setEditorWidth(320);
      else if (event.key === 'End') setEditorWidth(bounds.width - 332);
      else setEditorWidth(document.querySelector('.editor-column').getBoundingClientRect().width + (event.key === 'ArrowLeft' ? -24 : 24));
    });
  }

  function openInNewWindow() {
    const blob = new Blob([createDocument()], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank', 'noopener');
    if (!newWindow) showToast('O navegador bloqueou a nova janela. Permita pop-ups e tente novamente.');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function exportProject() {
    if (typeof window.JSZip !== 'function') { showToast('A biblioteca de exportação ainda não carregou. Tente novamente em instantes.'); return; }
    const project = getProject();
    const zip = new window.JSZip();
    zip.file('index.html', createDocument(project));
    const blob = await zip.generateAsync({ type: 'blob' });
    const filename = (project.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'meu-projeto');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Arquivo ZIP preparado para download.');
  }

  window.addEventListener('message', (event) => {
    if (event.source !== preview.contentWindow || event.data?.source !== 'live-editor') return;
    previewError.textContent = `JavaScript: ${event.data.message}`;
    previewError.hidden = false;
  });

  document.querySelectorAll('.panel-toggle').forEach((button) => button.addEventListener('click', () => openPanel(button.closest('.code-panel').dataset.panel)));
  document.querySelector('#save-button').addEventListener('click', saveProject);
  document.querySelector('#new-project-button').addEventListener('click', newProject);
  document.querySelector('#open-button').addEventListener('click', openInNewWindow);
  document.querySelector('#export-button').addEventListener('click', exportProject);
  projectsButton.addEventListener('click', toggleProjects);
  examplesButton.addEventListener('click', toggleExamples);
  document.querySelector('#close-examples').addEventListener('click', closeExamples);
  document.querySelector('#close-projects').addEventListener('click', closeProjects);
  fileMenuButton.addEventListener('click', toggleFileMenu);
  projectDescriptionButton.addEventListener('click', openProjectDescription);
  projectDescriptionInput.addEventListener('input', updateDescriptionCount);
  document.querySelector('#close-project-description').addEventListener('click', closeProjectDescription);
  document.querySelector('#cancel-project-description').addEventListener('click', closeProjectDescription);
  document.querySelector('#save-project-description').addEventListener('click', saveProjectDescription);
  fontDecrease.addEventListener('click', () => applyEditorFontSize(editorFontSize - 1));
  fontIncrease.addEventListener('click', () => applyEditorFontSize(editorFontSize + 1));
  themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));
  assetsButton.addEventListener('click', openAssetsDialog);
  assetsForm.addEventListener('submit', (event) => { event.preventDefault(); addAsset(); });
  document.querySelector('#close-assets').addEventListener('click', () => assetsDialog.close());
  document.querySelector('#done-assets').addEventListener('click', () => assetsDialog.close());
  importButton.addEventListener('click', () => { closeFileMenu(); openImportDialog(); });
  importLinkButton.addEventListener('click', importCodePenLink);
  importZipButton.addEventListener('click', importCodePenZip);
  document.querySelector('#close-import').addEventListener('click', closeImportDialog);
  document.querySelector('#cancel-import').addEventListener('click', closeImportDialog);
  prefersDarkTheme.addEventListener('change', () => { if (themePreference === 'system') applyTheme('system', false); });
  document.querySelectorAll('#file-popover button').forEach((button) => button.addEventListener('click', closeFileMenu));
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.projects-menu')) closeProjects();
    if (!event.target.closest('.examples-menu')) closeExamples();
    if (!event.target.closest('.file-menu')) closeFileMenu();
  });

  initEditors();
  renderAssets();
  restoreTheme();
  restoreEditorFontSize();
  initWorkspaceResizer();
  renderPreview();
})();
