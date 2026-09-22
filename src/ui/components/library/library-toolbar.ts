export interface LibraryToolbarState {
  searchQuery: string;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  formatFilter?: string | undefined;
}

export interface LibraryToolbarCallbacks {
  onChange: (state: LibraryToolbarState) => void;
}

export class LibraryToolbar {
  private container: HTMLElement | null = null;
  private state: LibraryToolbarState = {
    searchQuery: '',
    sortBy: 'title',
    sortDirection: 'asc',
    formatFilter: 'all'
  };
  private readonly callbacks: LibraryToolbarCallbacks;

  constructor(callbacks: LibraryToolbarCallbacks, initialState?: Partial<LibraryToolbarState>) {
    this.callbacks = callbacks;
    if (initialState) {
      this.state = { ...this.state, ...initialState };
    }
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  public unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  public getState(): LibraryToolbarState {
    return { ...this.state };
  }

  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div
        class="library-toolbar"
        style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        "
      >
        <!-- Quick Filter Input -->
        <div style="flex: 1; min-width: 200px; max-width: 320px; position: relative;">
          <input
            id="library-filter-input"
            type="search"
            placeholder="Filter library..."
            value="${this.state.searchQuery}"
            aria-label="Filter library"
            style="
              width: 100%;
              padding: 8px 12px;
              background: var(--color-bg-surface-elevated);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              color: var(--color-text-primary);
              font-size: 13px;
              box-sizing: border-box;
            "
          />
        </div>

        <!-- Controls: Format Filter & Sort -->
        <div style="display: flex; align-items: center; gap: var(--space-3);">
          <!-- Format Filter -->
          <label style="display: flex; align-items: center; gap: var(--space-2); font-size: 12px; color: var(--color-text-muted);">
            Format:
            <select
              id="library-format-select"
              aria-label="Filter by format"
              style="
                padding: 6px 10px;
                background: var(--color-bg-surface-elevated);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-sm);
                color: var(--color-text-primary);
                font-size: 12px;
                cursor: pointer;
              "
            >
              <option value="all" ${this.state.formatFilter === 'all' ? 'selected' : ''}>All Formats</option>
              <option value="lossless" ${this.state.formatFilter === 'lossless' ? 'selected' : ''}>Lossless Only</option>
              <option value="flac" ${this.state.formatFilter === 'flac' ? 'selected' : ''}>FLAC</option>
              <option value="mp3" ${this.state.formatFilter === 'mp3' ? 'selected' : ''}>MP3</option>
              <option value="aac" ${this.state.formatFilter === 'aac' ? 'selected' : ''}>AAC</option>
              <option value="wav" ${this.state.formatFilter === 'wav' ? 'selected' : ''}>WAV</option>
            </select>
          </label>

          <!-- Sort Selector -->
          <label style="display: flex; align-items: center; gap: var(--space-2); font-size: 12px; color: var(--color-text-muted);">
            Sort by:
            <select
              id="library-sort-select"
              aria-label="Sort tracks by"
              style="
                padding: 6px 10px;
                background: var(--color-bg-surface-elevated);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-sm);
                color: var(--color-text-primary);
                font-size: 12px;
                cursor: pointer;
              "
            >
              <option value="title" ${this.state.sortBy === 'title' ? 'selected' : ''}>Title</option>
              <option value="artist" ${this.state.sortBy === 'artist' ? 'selected' : ''}>Artist</option>
              <option value="album" ${this.state.sortBy === 'album' ? 'selected' : ''}>Album</option>
              <option value="dateAdded" ${this.state.sortBy === 'dateAdded' ? 'selected' : ''}>Date Added</option>
              <option value="duration" ${this.state.sortBy === 'duration' ? 'selected' : ''}>Duration</option>
              <option value="playCount" ${this.state.sortBy === 'playCount' ? 'selected' : ''}>Play Count</option>
            </select>
          </label>

          <!-- Sort Direction Toggle -->
          <button
            id="library-sort-dir-btn"
            aria-label="Toggle sort direction (${this.state.sortDirection === 'asc' ? 'ascending' : 'descending'})"
            style="
              padding: 6px 10px;
              background: var(--color-bg-surface-elevated);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-sm);
              color: var(--color-text-primary);
              font-size: 12px;
              cursor: pointer;
            "
          >
            ${this.state.sortDirection === 'asc' ? '▲ Asc' : '▼ Desc'}
          </button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.container) return;

    const input = this.container.querySelector<HTMLInputElement>('#library-filter-input');
    input?.addEventListener('input', () => {
      this.state.searchQuery = input.value.trim();
      this.callbacks.onChange(this.getState());
    });

    const formatSelect = this.container.querySelector<HTMLSelectElement>('#library-format-select');
    formatSelect?.addEventListener('change', () => {
      this.state.formatFilter = formatSelect.value;
      this.callbacks.onChange(this.getState());
    });

    const sortSelect = this.container.querySelector<HTMLSelectElement>('#library-sort-select');
    sortSelect?.addEventListener('change', () => {
      this.state.sortBy = sortSelect.value;
      this.callbacks.onChange(this.getState());
    });

    const dirBtn = this.container.querySelector<HTMLButtonElement>('#library-sort-dir-btn');
    dirBtn?.addEventListener('click', () => {
      this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
      dirBtn.textContent = this.state.sortDirection === 'asc' ? '▲ Asc' : '▼ Desc';
      this.callbacks.onChange(this.getState());
    });
  }
}
