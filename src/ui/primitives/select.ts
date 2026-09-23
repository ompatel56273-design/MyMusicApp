import { getIconSvg } from '../icons/icon-registry';

export interface SelectOption {
  value: string;
  label: string;
  selected?: boolean;
}

export interface SelectProps {
  id: string;
  options: SelectOption[];
  ariaLabel: string;
  className?: string;
}

export function renderSelect(props: SelectProps): string {
  const { id, options, ariaLabel, className = '' } = props;

  const optionsHtml = options
    .map(opt => `<option value="${opt.value}"${opt.selected ? ' selected' : ''}>${opt.label}</option>`)
    .join('');

  return `
    <div class="app-select-container ${className}">
      <select id="${id}" aria-label="${ariaLabel}" class="app-select">
        ${optionsHtml}
      </select>
      <span class="select-chevron" aria-hidden="true">
        ${getIconSvg('chevron-down', { size: 14 })}
      </span>
    </div>
  `;
}
