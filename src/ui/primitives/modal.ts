import { getIconSvg } from '../icons/icon-registry';

export interface ModalProps {
  id: string;
  title: string;
  bodyContent: string;
  footerContent?: string;
  closeBtnId?: string;
  maxWidth?: string;
  className?: string;
}

export function renderModal(props: ModalProps): string {
  const {
    id,
    title,
    bodyContent,
    footerContent = '',
    closeBtnId = `${id}-close-btn`,
    maxWidth = '540px',
    className = ''
  } = props;

  return `
    <div
      id="${id}"
      class="app-modal-backdrop ${className}"
      role="dialog"
      aria-modal="true"
      aria-labelledby="${id}-title"
    >
      <div class="app-modal-container glass-panel-elevated" style="max-width: ${maxWidth};">
        <div class="modal-header">
          <h2 id="${id}-title" class="modal-title text-title-2">${title}</h2>
          <button id="${closeBtnId}" class="modal-close-btn" aria-label="Close dialog">
            ${getIconSvg('close', { size: 20 })}
          </button>
        </div>
        <div class="modal-body">
          ${bodyContent}
        </div>
        ${footerContent ? `<div class="modal-footer">${footerContent}</div>` : ''}
      </div>
    </div>
  `;
}
