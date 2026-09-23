import { getIconSvg } from '../icons/icon-registry';

export interface BottomSheetProps {
  id: string;
  title?: string;
  content: string;
  closeBtnId?: string;
  className?: string;
}

export function renderBottomSheet(props: BottomSheetProps): string {
  const { id, title = '', content, closeBtnId = `${id}-close-btn`, className = '' } = props;

  return `
    <div
      id="${id}"
      class="app-bottom-sheet-backdrop ${className}"
      role="dialog"
      aria-modal="true"
    >
      <div class="app-bottom-sheet-container glass-panel-elevated">
        <div class="bottom-sheet-drag-handle-bar">
          <div class="bottom-sheet-drag-pill"></div>
        </div>
        ${
          title
            ? `
          <div class="bottom-sheet-header">
            <h3 class="bottom-sheet-title text-title-3">${title}</h3>
            <button id="${closeBtnId}" class="bottom-sheet-close-btn" aria-label="Close bottom sheet">
              ${getIconSvg('close', { size: 18 })}
            </button>
          </div>
        `
            : ''
        }
        <div class="bottom-sheet-content">
          ${content}
        </div>
      </div>
    </div>
  `;
}
