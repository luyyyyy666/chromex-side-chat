import { createSnapshot, MAX_SIDE_CHAT_CONTEXT, type SideChatSnapshot } from './context.js';

export function mountSideChat(getId: () => string, newChat: () => Promise<void>) {
  const snapshots = new Map<string, SideChatSnapshot>();
  const ready = chrome.storage.local.get('sideChatSnapshots').then(result => {
    for (const [id, value] of Object.entries(result.sideChatSnapshots ?? {})) {
      const snapshot = value as SideChatSnapshot;
      if (typeof snapshot.text === 'string' && typeof snapshot.url === 'string') snapshots.set(id, snapshot);
    }
  });
  const panel = document.createElement('details');
  panel.id = 'side-chat-context';
  panel.innerHTML = `<summary>Side Chat · 网页上下文</summary><div class="side-chat-controls"><button type="button" data-action="new">新建页面侧聊</button><button type="button" data-action="update">更新上下文</button><button type="button" data-action="clear">清空</button></div><p class="side-chat-source"></p><label>发送时携带以下快照（可编辑）<textarea aria-label="网页上下文预览" maxlength="${MAX_SIDE_CHAT_CONTEXT}" rows="7"></textarea></label><p class="side-chat-status" role="status"></p>`;
  document.body.prepend(panel);
  const textarea = panel.querySelector('textarea')!;
  const source = panel.querySelector<HTMLParagraphElement>('.side-chat-source')!;
  const status = panel.querySelector<HTMLParagraphElement>('.side-chat-status')!;
  let displayedId = '\0';
  let busy = false;
  const persist = () => chrome.storage.local.set({ sideChatSnapshots: Object.fromEntries(snapshots) });
  function sync() {
    const id = getId();
    if (id === displayedId) return;
    displayedId = id;
    const snapshot = snapshots.get(id);
    textarea.value = snapshot?.text ?? '';
    source.textContent = snapshot ? `${snapshot.title} · ${snapshot.url}` : '尚未添加网页上下文';
    status.textContent = snapshot ? `${snapshot.text.length} 字符 · ${new Date(snapshot.capturedAt).toLocaleTimeString()}${snapshot.truncated ? ' · 已截断至 48,000 字符' : ''}` : '选文后右键侧边追问，或点击“新建页面侧聊”。';
  }
  async function set(snapshot: SideChatSnapshot) {
    await ready;
    const id = getId();
    if (!id) throw new Error('请先创建侧聊会话');
    snapshots.delete(id);
    snapshots.set(id, snapshot);
    while (snapshots.size > 50) snapshots.delete(snapshots.keys().next().value!);
    await persist();
    displayedId = '';
    sync();
    panel.open = true;
  }
  async function capture() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:\/\//.test(tab.url ?? '')) throw new Error('请在普通 HTTP/HTTPS 网页上使用侧聊。');
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ url: location.href, title: document.title, text: document.body.innerText }),
    });
    const page = results[0]?.result;
    if (!page?.text?.trim()) throw new Error('当前页面没有可读取的文字');
    return createSnapshot(page.url, page.title, page.text);
  }
  textarea.addEventListener('input', () => {
    const snapshot = snapshots.get(getId());
    if (!snapshot) return;
    snapshot.text = textarea.value;
    status.textContent = `${snapshot.text.length} 字符 · 已编辑`;
    void persist().catch(error => { status.textContent = String(error); });
  });
  panel.addEventListener('click', async event => {
    const action = (event.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.action;
    if (!action || busy) return;
    busy = true;
    for (const button of Array.from(panel.querySelectorAll('button'))) button.disabled = true;
    try {
      await ready;
      if (action === 'clear') {
        snapshots.delete(getId());
        await persist();
        displayedId = '';
        sync();
      } else {
        const targetId = getId();
        const snapshot = await capture();
        if (action === 'update' && targetId !== getId()) throw new Error('会话已切换，请重新更新上下文');
        if (action === 'new' || !getId()) await newChat();
        await set(snapshot);
      }
    } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
    finally {
      busy = false;
      for (const button of Array.from(panel.querySelectorAll('button'))) button.disabled = false;
    }
  });
  void ready.then(() => { displayedId = '\0'; sync(); }).catch(error => { status.textContent = String(error); });
  return {
    sync,
    set,
    capture,
    async get(id = getId()) { await ready; const snapshot = snapshots.get(id); return snapshot ? { ...snapshot } : undefined; },
  };
}
