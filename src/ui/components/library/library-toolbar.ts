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
        class="library-toolbar glass-panel"
        style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--space-3);
          padding: 12px var(--space-4);
          border-radius: var(--radius-lg);
          background: rgba(18, 24, 38, 0.65);
          backdrop-filter: blur(12px);
          border: 1px solid var(--glass-border);
        "
      >
        <!-- Search songs in library (Template 3) -->
        <div style="flex: 1; min-width: 240px; max-width: 400px; position: relative; display: flex; align-items: center;">
          <span style="position: absolute; left: 14px; font-size: 14px; color: var(--color-text-muted); pointer-events: none;">🔍</span>
          <input
            id="library-filter-input"
            type="search"
            placeholder="Search songs in your library..."
            value="${this.state.searchQuery}"
            aria-label="Search songs in your library"
            style="
              width: 100%;
              padding: 10px 14px 10px 38px;
              background: rgba(10, 14, 23, 0.7);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-full);
              color: var(--color-text-primary);
              font-size: 13px;
              box-sizing: border-box;
              outline: none;
              transition: all var(--duration-fast) var(--ease-smooth);
            "
          />
        </div>

        <!-- Controls: Genre / Format Filter & Sort (Template 3) -->
        <div style="display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; width: 100%; max-width: 100%;">
          <!-- Format / Genre Filter -->
          <div style="position: relative; flex: 1; min-width: 140px;">
            <select
              id="library-format-select"
              aria-label="Filter by format"
              class="app-select"
              style="
                min-height: 44px;
                padding: 8px 14px;
                background: var(--color-bg-surface-elevated);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-full);
                color: var(--color-text-primary);
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                outline: none;
                width: 100%;
                box-sizing: border-box;
              "
            >
              <option value="all" ${this.state.formatFilter === 'all' ? 'selected' : ''}>All Formats</option>
              <option value="lossless" ${this.state.formatFilter === 'lossless' ? 'selected' : ''}>Lossless Hi-Res</option>
              <option value="flac" ${this.state.formatFilter === 'flac' ? 'selected' : ''}>FLAC Audio</option>
              <option value="mp3" ${this.state.formatFilter === 'mp3' ? 'selected' : ''}>MP3 Audio</option>
              <option value="aac" ${this.state.formatFilter === 'aac' ? 'selected' : ''}>AAC Audio</option>
              <option value="wav" ${this.state.formatFilter === 'wav' ? 'selected' : ''}>WAV Audio</option>
            </select>
          </div>

          <!-- Sort Selector (Template 3 "Sort by: ...") -->
          <div style="position: relative; flex: 1; min-width: 160px;">
            <select
              id="library-sort-select"
              aria-label="Sort tracks by"
              class="app-select"
              style="
                min-height: 44px;
                padding: 8px 14px;
                background: var(--color-bg-surface-elevated);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-full);
                color: var(--color-text-primary);
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                outline: none;
                width: 100%;
                box-sizing: border-box;
              "
            >
              <option value="title" ${this.state.sortBy === 'title' ? 'selected' : ''}>Sort by: Title A - Z</option>
              <option value="artist" ${this.state.sortBy === 'artist' ? 'selected' : ''}>Sort by: Artist</option>
              <option value="album" ${this.state.sortBy === 'album' ? 'selected' : ''}>Sort by: Album</option>
              <option value="dateAdded" ${this.state.sortBy === 'dateAdded' ? 'selected' : ''}>Sort by: Date Added</option>
              <option value="duration" ${this.state.sortBy === 'duration' ? 'selected' : ''}>Sort by: Duration</option>
              <option value="playCount" ${this.state.sortBy === 'playCount' ? 'selected' : ''}>Sort by: Most Played</option>
            </select>
          </div>

          <!-- Sort Direction Toggle -->
          <button
            id="library-sort-dir-btn"
            aria-label="Toggle sort direction (${this.state.sortDirection === 'asc' ? 'ascending' : 'descending'})"
            title="Toggle sort direction"
            style="
              padding: 8px 16px;
              background: var(--color-bg-surface-elevated);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-full);
              color: var(--color-text-primary);
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
              transition: all var(--duration-fast) var(--ease-smooth);
              min-height: 44px;
              display: flex;
              align-items: center;
              justify-content: center;
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

