function createMockStyle(): any {
  const store: Record<string, string> = {};
  const styleObj: any = {
    setProperty: (prop: string, val: string) => {
      store[prop] = val;
      styleObj[prop] = val;
    },
    getPropertyValue: (prop: string) => store[prop] || styleObj[prop] || '',
    removeProperty: (prop: string) => {
      delete store[prop];
      delete styleObj[prop];
    }
  };
  return new Proxy(styleObj, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return store[prop] || '';
    },
    set(target, prop: string, val: any) {
      target[prop] = val;
      store[prop] = String(val);
      return true;
    }
  });
}

export class MockElement {
  public tagName: string;
  public id: string = '';
  public className: string = '';
  public value: string = '0';
  public max: string = '100';
  public min: string = '0';
  public scrollTop: number = 0;
  public clientHeight: number = 600;
  public style: any = createMockStyle();
  public attributes = new Map<string, string>();
  public children: MockElement[] = [];
  public parent: MockElement | null = null;
  public paused: boolean = true;
  public currentTime: number = 0;
  public duration: number = 0;
  public volume: number = 1;
  public playbackRate: number = 1;
  public preload: string = 'auto';
  public crossOrigin: string = '';
  public src: string = '';
  private _textContent: string = '';
  private _innerHTML: string = '';
  private eventListeners = new Map<string, Array<(e: any) => void>>();

  public play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }

  public pause(): void {
    this.paused = true;
  }

  public load(): void {
    const list = this.eventListeners.get('canplay');
    if (list) {
      for (const h of list) h({ type: 'canplay', target: this });
    }
  }

  constructor(tagName: string = 'div') {
    this.tagName = tagName.toUpperCase();
  }

  public get parentElement(): MockElement | null {
    return this.parent;
  }

  public get innerHTML(): string {
    return this._innerHTML;
  }

  public set innerHTML(html: string) {
    this._innerHTML = html;
    this.children = [];
    parseHtmlToTree(html, this);
  }

  public get textContent(): string {
    if (this.children.length === 0) {
      return this._textContent;
    }
    return this.children.map(c => c.textContent).join('');
  }

  public set textContent(val: string) {
    this._textContent = val;
    this.children = [];
  }

  public get classList(): {
    add: (...classes: string[]) => void;
    remove: (...classes: string[]) => void;
    contains: (cls: string) => boolean;
    toggle: (cls: string) => boolean;
  } {
    const getClasses = () => this.className.split(/\s+/).filter(Boolean);
    return {
      add: (...classes: string[]) => {
        const current = new Set(getClasses());
        classes.forEach(c => current.add(c));
        this.className = Array.from(current).join(' ');
      },
      remove: (...classes: string[]) => {
        const current = new Set(getClasses());
        classes.forEach(c => current.delete(c));
        this.className = Array.from(current).join(' ');
      },
      contains: (cls: string) => getClasses().includes(cls),
      toggle: (cls: string, force?: boolean) => {
        const current = new Set(getClasses());
        const shouldAdd = force !== undefined ? Boolean(force) : !current.has(cls);
        if (shouldAdd) {
          current.add(cls);
        } else {
          current.delete(cls);
        }
        this.className = Array.from(current).join(' ');
        return shouldAdd;
      }
    };
  }

  public get placeholder(): string {
    return this.getAttribute('placeholder') || '';
  }

  public get dataset(): Record<string, string> {
    const ds: Record<string, string> = {};
    for (const [key, val] of this.attributes.entries()) {
      if (key.startsWith('data-')) {
        const camelKey = key.slice(5).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
        ds[camelKey] = val;
      }
    }
    return ds;
  }

  public getContext(type: string, _options?: any): any {
    if (type === '2d') {
      return {
        clearRect: () => {},
        fillRect: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        scale: () => {},
        save: () => {},
        restore: () => {},
        fillText: () => {},
        strokeText: () => {},
        measureText: () => ({ width: 50 }),
        resetTransform: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textAlign: 'left',
        textBaseline: 'alphabetic',
        shadowBlur: 0,
        shadowColor: ''
      };
    }
    return null;
  }

  public getBoundingClientRect(): { width: number; height: number; top: number; left: number; right: number; bottom: number } {
    return { width: 600, height: 300, top: 0, left: 0, right: 600, bottom: 300 };
  }

  public remove(): void {
    if (this.parent) {
      this.parent.removeChild(this);
    }
  }

  public scrollIntoView(): void {}

  public checked: boolean = false;

  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name.toLowerCase() === 'id') this.id = value;
    if (name.toLowerCase() === 'class') this.className = value;
    if (name.toLowerCase() === 'value') this.value = value;
    if (name.toLowerCase() === 'checked') this.checked = true;
    if (name.toLowerCase() === 'style') {
      const pairs = value.split(';');
      for (const pair of pairs) {
        const idx = pair.indexOf(':');
        if (idx !== -1) {
          const k = pair.slice(0, idx).trim();
          const v = pair.slice(idx + 1).trim();
          if (k) {
            this.style[k] = v;
            const camelK = k.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
            this.style[camelK] = v;
          }
        }
      }
    }
  }

  public getAttribute(name: string): string | null {
    if (name.toLowerCase() === 'id') return this.id || this.attributes.get('id') || null;
    if (name.toLowerCase() === 'class') return this.className || this.attributes.get('class') || null;
    if (name.toLowerCase() === 'checked') return this.checked ? 'true' : null;
    return this.attributes.get(name) ?? null;
  }

  public removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name.toLowerCase() === 'id') this.id = '';
    if (name.toLowerCase() === 'class') this.className = '';
    if (name.toLowerCase() === 'checked') this.checked = false;
  }

  public contains(node: any): boolean {
    if (node === this) return true;
    for (const child of this.children) {
      if (child.contains(node)) return true;
    }
    return false;
  }

  public addEventListener(event: string, handler: (e: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(handler);
  }

  public removeEventListener(event: string, handler: (e: any) => void): void {
    const list = this.eventListeners.get(event);
    if (list) {
      const idx = list.indexOf(handler);
      if (idx !== -1) list.splice(idx, 1);
    }
  }

  public dispatchEvent(event: any): boolean {
    try {
      event.target = this;
    } catch {
      Object.defineProperty(event, 'target', { value: this, configurable: true, writable: true });
    }
    if (!event.stopPropagation) event.stopPropagation = () => {};
    if (!event.preventDefault) event.preventDefault = () => {};
    const list = this.eventListeners.get(event.type);
    if (list) {
      for (const h of list) h(event);
    }
    return true;
  }

  public click(): void {
    if (this.tagName === 'INPUT' && (this.getAttribute('type') === 'checkbox' || (this.attributes.get('type') === 'checkbox'))) {
      this.checked = !this.checked;
      this.dispatchEvent({ type: 'change', target: this, stopPropagation: () => {}, preventDefault: () => {} });
    }
    this.dispatchEvent({ type: 'click', target: this, stopPropagation: () => {}, preventDefault: () => {} });
  }

  public focus(): void {
    this.dispatchEvent({ type: 'focus', target: this });
  }

  public select(): void {}

  public blur(): void {
    this.dispatchEvent({ type: 'blur', target: this });
  }

  public scrollTo(options: any): void {
    if (typeof options === 'object' && options !== null && options.top !== undefined) {
      this.scrollTop = options.top;
    } else if (typeof options === 'number') {
      this.scrollTop = options;
    }
    this.dispatchEvent({ type: 'scroll', target: this });
  }

  public appendChild<T extends MockElement>(child: T): T {
    if (child.tagName === 'FRAGMENT') {
      for (const c of [...child.children]) {
        c.parent = this;
        this.children.push(c);
      }
      return child;
    }
    child.parent = this;
    this.children.push(child);
    return child;
  }

  public removeChild<T extends MockElement>(child: T): T {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parent = null;
    }
    return child;
  }

  public querySelector<T extends MockElement = MockElement>(selector: string): T | null {
    const results = this.querySelectorAll<T>(selector);
    return results.length > 0 ? results[0]! : null;
  }

  public querySelectorAll<T extends MockElement = MockElement>(selector: string): T[] {
    const matched: T[] = [];
    const checkNode = (node: MockElement) => {
      let isMatch = false;
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        if (node.id === id || node.getAttribute('id') === id) isMatch = true;
      } else if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        if (node.className.includes(cls) || (node.getAttribute('class') || '').includes(cls)) isMatch = true;
      } else if (selector.includes('[') && selector.includes(']')) {
        const bracketStart = selector.indexOf('[');
        const prefix = bracketStart > 0 ? selector.slice(0, bracketStart) : '';
        const attrExpr = selector.slice(bracketStart + 1, selector.indexOf(']'));
        let prefixMatch = true;
        if (prefix.startsWith('.')) {
          const cls = prefix.slice(1);
          prefixMatch = node.className.includes(cls) || (node.getAttribute('class') || '').includes(cls);
        } else if (prefix.startsWith('#')) {
          const id = prefix.slice(1);
          prefixMatch = node.id === id || node.getAttribute('id') === id;
        } else if (prefix) {
          prefixMatch = node.tagName.toLowerCase() === prefix.toLowerCase();
        }

        if (prefixMatch) {
          if (attrExpr.includes('=')) {
            const [attrName, attrRawVal] = attrExpr.split('=');
            const cleanVal = (attrRawVal || '').replace(/^["']|["']$/g, '');
            if (node.getAttribute(attrName!.trim()) === cleanVal) isMatch = true;
          } else {
            if (node.getAttribute(attrExpr.trim()) !== null) isMatch = true;
          }
        }
      } else {
        if (node.tagName.toLowerCase() === selector.toLowerCase()) isMatch = true;
      }

      if (isMatch) matched.push(node as unknown as T);

      for (const child of node.children) {
        checkNode(child);
      }
    };

    for (const child of this.children) {
      checkNode(child);
    }
    return matched;
  }

  public closest<T extends MockElement = MockElement>(selector: string): T | null {
    let cur: MockElement | null = this;
    while (cur) {
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        if (cur.className.includes(cls) || (cur.getAttribute('class') || '').includes(cls)) {
          return cur as unknown as T;
        }
      } else if (selector.startsWith('#')) {
        const id = selector.slice(1);
        if (cur.id === id || cur.getAttribute('id') === id) {
          return cur as unknown as T;
        }
      }
      cur = cur.parent;
    }
    return null;
  }
}

function parseHtmlToTree(html: string, root: MockElement): void {
  const tagRegex = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z0-9\-]+)([^>]*)>|([^<]+)/g;
  const stack: MockElement[] = [root];
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(html)) !== null) {
    const [fullMatch, isClosing, tagName, rawAttrs, text] = match;

    if (fullMatch.startsWith('<!--')) {
      continue;
    }

    if (text) {
      const trimmed = text.trim();
      if (trimmed) {
        const current = stack[stack.length - 1];
        if (current) {
          const textNode = new MockElement('#text');
          textNode.textContent = text;
          current.appendChild(textNode);
        }
      }
      continue;
    }

    if (tagName) {
      if (isClosing) {
        if (stack.length > 1 && stack[stack.length - 1]?.tagName.toLowerCase() === tagName.toLowerCase()) {
          stack.pop();
        }
      } else {
        const element = new MockElement(tagName);
        if (rawAttrs) {
          const attrRegex = /([a-zA-Z0-9\-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
          let attrMatch: RegExpExecArray | null;
          while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
            const attrName = attrMatch[1]!;
            const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? 'true';
            element.setAttribute(attrName, attrVal);
          }
        }

        const current = stack[stack.length - 1];
        if (current) {
          current.appendChild(element);
        }

        const isSelfClosing = (rawAttrs || '').trim().endsWith('/') || ['input', 'img', 'br', 'hr', 'meta', 'link', 'path', 'circle', 'line', 'polygon', 'polyline', 'rect', 'stop'].includes(tagName.toLowerCase());
        if (!isSelfClosing) {
          stack.push(element);
        }
      }
    }
  }
}

export function setupMockDomEnvironment(): void {
  if (typeof (globalThis as any).document === 'undefined') {
    const docListeners = new Map<string, Array<(e: any) => void>>();
    const doc = {
      createElement: (tagName: string) => new MockElement(tagName),
      createDocumentFragment: () => new MockElement('fragment'),
      getElementById: (id: string) => {
        return (globalThis as any).document.body.querySelector(`#${id}`);
      },
      querySelector: (sel: string) => {
        return (globalThis as any).document.body.querySelector(sel);
      },
      querySelectorAll: (sel: string) => {
        return (globalThis as any).document.body.querySelectorAll(sel);
      },
      addEventListener: (evt: string, fn: (e: any) => void) => {
        if (!docListeners.has(evt)) docListeners.set(evt, []);
        docListeners.get(evt)!.push(fn);
      },
      removeEventListener: (evt: string, fn: (e: any) => void) => {
        const list = docListeners.get(evt);
        if (list) {
          const idx = list.indexOf(fn);
          if (idx !== -1) list.splice(idx, 1);
        }
      },
      dispatchEvent: (evt: any) => {
        const list = docListeners.get(evt.type);
        if (list) {
          for (const fn of list) fn(evt);
        }
        return true;
      },
      hidden: false,
      visibilityState: 'visible',
      body: new MockElement('body'),
      documentElement: new MockElement('html')
    };
    (globalThis as any).document = doc;
    (globalThis as any).window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      document: doc,
      devicePixelRatio: 1,
      setTimeout: (fn: Function, ms?: number) => globalThis.setTimeout(fn as any, ms),
      clearTimeout: (id: any) => globalThis.clearTimeout(id),
      matchMedia: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {}
      })
    };
    if (typeof (globalThis as any).localStorage === 'undefined') {
      const storage = new Map<string, string>();
      (globalThis as any).localStorage = {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => storage.set(k, String(v)),
        removeItem: (k: string) => storage.delete(k),
        clear: () => storage.clear()
      };
    }
    if (typeof (globalThis as any).URL === 'undefined' || !(globalThis as any).URL.createObjectURL) {
      (globalThis as any).URL = {
        createObjectURL: (_blob?: any) => `blob:mock-url-${Math.random()}`,
        revokeObjectURL: () => {}
      };
    }
    (globalThis as any).KeyboardEvent = class {
      public code: string;
      public key: string;
      public target: any;
      constructor(type: string, init?: any) {
        (this as any).type = type;
        this.code = init?.code || '';
        this.key = init?.key || '';
      }
      public preventDefault() {}
    };
  }
}
