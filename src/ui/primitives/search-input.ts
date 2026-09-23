import { getIconSvg } from '../icons/icon-registry';

export interface SearchInputProps {
  id: string;
  placeholder?: string;
  ariaLabel?: string;
  showShortcutBadge?: boolean;
  shortcutText?: string;
  className?: string;
  value?: string;
}

export function renderSearchInput(props: SearchInputProps): string {
  const {
    id,
    placeholder = 'Search...',
    ariaLabel = 'Search',
    showShortcutBadge = true,
    shortcutText = 'Ctrl + K',
    className = '',
    value = ''
  } = props;

  const shortcutHtml = showShortcutBadge
    ? `<span class="search-shortcut-badge" aria-hidden="true">${shortcutText}</span>`
    : '';

  return `
    <div class="app-search-input-wrapper ${className}">
      <span class="search-input-icon" aria-hidden="true">
        ${getIconSvg('search', { size: 16 })}
      </span>
      <input
        type="search"
        id="${id}"
        placeholder="${placeholder}"
        aria-label="${ariaLabel}"
        value="${value}"
        class="app-search-input"
        autocomplete="off"
        spellcheck="false"
      />
      ${shortcutHtml}
    </div>
  `;
}
