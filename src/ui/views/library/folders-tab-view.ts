import type { Folder } from '../../../domain/entities/models';
import type { ILibraryService } from '../../../services/contracts/service-contracts';
import { VirtualScroller } from '../../components/virtual-scroller/virtual-scroller';
import { FolderRowComponent } from '../../components/library/folder-row-component';

export interface FoldersTabViewDependencies {
  libraryService: ILibraryService;
  onSelectFolder?: ((folder: Folder) => void) | undefined;
}

export class FoldersTabView {
  private container: HTMLElement | null = null;
  private readonly libraryService: ILibraryService;
  private readonly onSelectFolder?: ((folder: Folder) => void) | undefined;

  private allFolders: Folder[] = [];
  private scroller: VirtualScroller<Folder> | null = null;

  constructor(deps: FoldersTabViewDependencies) {
    this.libraryService = deps.libraryService;
    this.onSelectFolder = deps.onSelectFolder;
  }

  public async mount(container: HTMLElement): Promise<void> {
    this.container = container;
    this.container.innerHTML = `
      <div id="folders-viewport" style="overflow-y: auto; max-height: calc(100vh - 280px); min-height: 300px;">
        <div style="padding: var(--space-8); text-align: center; color: var(--color-text-muted);">
          Loading folders...
        </div>
      </div>
    `;

    await this.loadFolders();
  }

  public unmount(): void {
    if (this.scroller) {
      this.scroller.dispose();
      this.scroller = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private async loadFolders(): Promise<void> {
    try {
      const folders = await this.libraryService.listFolders();
      this.allFolders = [...folders];
      this.setupVirtualScroller();
    } catch (_err) {
      const viewport = this.container?.querySelector('#folders-viewport');
      if (viewport) {
        viewport.innerHTML = `
          <div style="padding: var(--space-8); text-align: center; color: var(--color-status-error);">
            Failed to load library folders.
          </div>
        `;
      }
    }
  }

  private setupVirtualScroller(): void {
    if (!this.container) return;
    const viewport = this.container.querySelector<HTMLElement>('#folders-viewport');
    if (!viewport) return;

    viewport.innerHTML = '';

    if (this.allFolders.length === 0) {
      viewport.innerHTML = `
        <div style="padding: var(--space-8); text-align: center; color: var(--color-text-muted);">
          No indexed folders found.
        </div>
      `;
      return;
    }

    this.scroller = new VirtualScroller<Folder>({
      container: viewport,
      items: this.allFolders,
      itemHeight: 56,
      overscan: 4,
      renderItem: folder => {
        return FolderRowComponent.create(folder, {
          onSelect: f => {
            if (this.onSelectFolder) {
              this.onSelectFolder(f);
            }
          }
        });
      }
    });
  }
}
