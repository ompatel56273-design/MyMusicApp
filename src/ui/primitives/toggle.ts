export interface ToggleProps {
  id: string;
  checked?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  label?: string;
  description?: string;
}

export function renderToggle(props: ToggleProps): string {
  const {
    id,
    checked = false,
    disabled = false,
    ariaLabel,
    className = '',
    label,
    description
  } = props;

  const checkedAttr = checked ? ' checked aria-checked="true"' : ' aria-checked="false"';
  const disabledAttr = disabled ? ' disabled aria-disabled="true"' : '';

  const labelSection = label
    ? `
      <div class="toggle-text-group">
        <label for="${id}" class="toggle-label text-body-strong">${label}</label>
        ${description ? `<p class="toggle-desc text-caption">${description}</p>` : ''}
      </div>
    `
    : '';

  return `
    <div class="app-toggle-wrapper ${className}">
      ${labelSection}
      <label class="app-toggle-switch">
        <input
          type="checkbox"
          id="${id}"
          role="switch"
          aria-label="${ariaLabel}"
          ${checkedAttr}
          ${disabledAttr}
          class="toggle-input"
        />
        <span class="toggle-slider"></span>
      </label>
    </div>
  `;
}
