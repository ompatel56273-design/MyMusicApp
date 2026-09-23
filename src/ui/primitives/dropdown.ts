import { getIconSvg, type IconName } from '../icons/icon-registry';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: IconName;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
  dividerAbove?: boolean;
}

export interface DropdownProps {
  id: string;
  items: DropdownMenuItem[];
  ariaLabel: string;
  className?: string;
}

export function renderDropdownMenu(props: DropdownProps): string {
  const { id, items, ariaLabel, className = '' } = props;

  const itemsHtml = items
    .map(item => {
      const dividerHtml = item.dividerAbove ? '<div class="dropdown-divider"></div>' : '';
      const iconHtml = item.icon ? `<span class="dropdown-item-icon">${getIconSvg(item.icon, { size: 16 })}</span>` : '';
      const dangerClass = item.danger ? ' item-danger' : '';
      const disabledAttr = item.disabled ? ' disabled aria-disabled="true"' : '';
      const shortcutHtml = item.shortcut ? `<span class="dropdown-item-shortcut">${item.shortcut}</span>` : '';

      return `
        ${dividerHtml}
        <button
          role="menuitem"
          data-action="${item.id}"
          class="dropdown-menu-item${dangerClass}"
          ${disabledAttr}
        >
          ${iconHtml}
          <span class="dropdown-item-label">${item.label}</span>
          ${shortcutHtml}
        </button>
      `;
    })
    .join('');

  return `
    <div id="${id}" role="menu" aria-label="${ariaLabel}" class="app-dropdown-menu glass-panel-elevated ${className}">
      ${itemsHtml}
    </div>
  `;
}
