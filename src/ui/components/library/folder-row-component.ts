import type { Folder } from '../../../domain/entities/models';

export interface FolderRowCallbacks {
  onSelect: (folder: Folder) => void;
}

export class FolderRowComponent {
  public static create(folder: Folder, callbacks: FolderRowCallbacks): HTMLElement {
    const row = document.createElement('div');
    row.className = 'folder-row glass-panel';
    row.setAttribute('role', 'row');
    row.setAttribute('tabindex', '0');
    row.setAttribute('data-folder-id', folder.id);
    row.setAttribute('aria-label', `Folder: ${folder.name}`);

    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = 'var(--space-3)';
    row.style.padding = 'var(--space-3) var(--space-4)';
    row.style.borderRadius = 'var(--radius-sm)';
    row.style.cursor = 'pointer';
    row.style.height = '52px';
    row.style.boxSizing = 'border-box';
    row.style.transition = 'background-color 0.15s ease';

    row.innerHTML = `
      <span style="font-size: 18px; color: var(--color-accent-primary);">📁</span>
      <div style="display: flex; flex-direction: column; overflow: hidden; flex: 1;">
        <span style="font-size: 13px; font-weight: 500; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${folder.name}
        </span>
        <span style="font-size: 11px; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${folder.path}
        </span>
      </div>
    `;

    row.addEventListener('click', () => callbacks.onSelect(folder));
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        callbacks.onSelect(folder);
      }
    });

    return row;
  }
}
