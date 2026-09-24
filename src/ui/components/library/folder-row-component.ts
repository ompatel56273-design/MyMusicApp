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
    row.style.padding = 'var(--library-item-padding, 12px 18px)';
    row.style.borderRadius = 'var(--radius-lg)';
    row.style.cursor = 'pointer';
    row.style.height = 'var(--library-row-height, 60px)';
    row.style.boxSizing = 'border-box';
    row.style.background = 'rgba(255, 255, 255, 0.03)';
    row.style.border = '1px solid var(--glass-border)';
    row.style.transition = 'all var(--duration-fast) var(--ease-smooth)';

    row.innerHTML = `
      <div style="width: var(--library-artwork-size, 38px); height: var(--library-artwork-size, 38px); border-radius: var(--radius-sm); background: linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(59, 130, 246, 0.25) 100%); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; border: 1px solid rgba(255, 255, 255, 0.08);">
        <span style="font-size: 18px;">📁</span>
      </div>
      <div style="display: flex; flex-direction: column; overflow: hidden; flex: 1;">
        <span style="font-size: 13px; font-weight: 600; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${folder.name}
        </span>
        <span style="font-size: 11px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">
          ${folder.path}
        </span>
      </div>
      <span style="font-size: 12px; color: var(--color-text-muted); font-weight: 500;">
        ${folder.trackCount ? folder.trackCount + ' songs' : ''}
      </span>
    `;

    row.addEventListener('mouseenter', () => {
      row.style.transform = 'translateY(-2px)';
      row.style.borderColor = 'rgba(168, 85, 247, 0.4)';
      row.style.background = 'rgba(255, 255, 255, 0.06)';
    });

    row.addEventListener('mouseleave', () => {
      row.style.transform = 'none';
      row.style.borderColor = 'var(--glass-border)';
      row.style.background = 'rgba(255, 255, 255, 0.03)';
    });

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

