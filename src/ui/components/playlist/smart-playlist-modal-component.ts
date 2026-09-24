import type { Playlist } from '../../../domain/entities/models';
import type {
  SmartPlaylistDefinition,
  SmartRule,
  SmartRuleField,
  SmartRuleOperator,
  SmartMatchMode,
  SmartSortField,
  SmartSortOrder
} from '../../../domain/value-objects/smart-playlist-types';
import { getIconSvg } from '../../icons/icon-registry';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface SmartPlaylistModalOptions {
  playlist?: Playlist | undefined;
  definition?: SmartPlaylistDefinition | undefined;
  onSave: (
    name: string,
    description: string | undefined,
    rules: SmartRule[],
    matchMode: SmartMatchMode,
    sort: { field: SmartSortField; order: SmartSortOrder },
    limit: number | null
  ) => Promise<void> | void;
  onCancel?: (() => void) | undefined;
}

export class SmartPlaylistModalComponent {
  public static show(options: SmartPlaylistModalOptions): HTMLElement {
    const isEdit = !!options.playlist;
    const titleText = isEdit ? 'Edit Smart Playlist' : 'Create Smart Playlist';
    const submitText = isEdit ? 'Save Changes' : 'Create Smart Playlist';

    const initialDef = options.definition;
    const initialRules: SmartRule[] = initialDef?.rules
      ? [...initialDef.rules]
      : [{ field: 'genre', operator: 'equals', value: 'Rock' }];
    let currentMatchMode: SmartMatchMode = initialDef?.matchMode ?? 'all';
    let currentSortField: SmartSortField = initialDef?.sort?.field ?? 'title';
    let currentSortOrder: SmartSortOrder = initialDef?.sort?.order ?? 'asc';
    let currentLimit: number | null = initialDef?.limit ?? null;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    overlay.style.backdropFilter = 'blur(12px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '1000';
    overlay.style.padding = 'var(--space-4)';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'glass-panel modal-content';
    modal.style.width = '100%';
    modal.style.maxWidth = '640px';
    modal.style.maxHeight = '90vh';
    modal.style.overflowY = 'auto';
    modal.style.borderRadius = 'var(--radius-2xl)';
    modal.style.padding = 'var(--space-6)';
    modal.style.boxShadow = '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(124, 58, 237, 0.25)';
    modal.style.border = '1px solid var(--glass-border-interactive)';
    modal.style.background = 'linear-gradient(135deg, rgba(20, 15, 45, 0.98) 0%, rgba(10, 14, 28, 0.98) 100%)';
    modal.style.boxSizing = 'border-box';

    modal.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--color-accent-purple); display: flex;">
            ${getIconSvg('sparkles', { size: 20 })}
          </span>
          <h2 style="font-size: var(--font-size-lg); font-weight: var(--font-weight-extrabold); color: #ffffff; margin: 0;">
            ${titleText}
          </h2>
        </div>
        <button class="modal-close-btn" aria-label="Close dialog" style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 6px;">
          ${getIconSvg('close', { size: 16 })}
        </button>
      </div>

      <form class="smart-playlist-form" style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          <label style="font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary);">
            Playlist Name <span style="color: var(--color-accent-pink);">*</span>
          </label>
          <input
            id="sp-name-input"
            type="text"
            required
            placeholder="e.g. 80s Rock Classics"
            value="${escapeHtml(options.playlist?.name ?? initialDef?.name ?? '')}"
            style="width: 100%; box-sizing: border-box; padding: 10px 14px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); color: #ffffff; font-size: var(--font-size-sm); outline: none;"
          />
          <span class="sp-error" style="font-size: 12px; color: var(--color-status-error); display: none;"></span>
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          <label style="font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary);">
            Description (optional)
          </label>
          <textarea
            id="sp-desc-input"
            rows="2"
            placeholder="Dynamic smart playlist rules..."
            style="width: 100%; box-sizing: border-box; padding: 10px 14px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); color: #ffffff; font-size: var(--font-size-sm); outline: none; font-family: inherit;"
          >${escapeHtml(options.playlist?.description ?? initialDef?.description ?? '')}</textarea>
        </div>

        <!-- Rules Section -->
        <div style="display: flex; flex-direction: column; gap: var(--space-3); background: rgba(255, 255, 255, 0.03); padding: var(--space-4); border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: var(--color-accent-cyan);">
              MATCH RULES
            </span>
            <div style="display: flex; gap: var(--space-3); font-size: 12px; color: var(--color-text-secondary);">
              <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <input type="radio" name="sp-match" value="all" ${currentMatchMode === 'all' ? 'checked' : ''} /> Match ALL
              </label>
              <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
                <input type="radio" name="sp-match" value="any" ${currentMatchMode === 'any' ? 'checked' : ''} /> Match ANY
              </label>
            </div>
          </div>

          <div id="sp-rules-container" style="display: flex; flex-direction: column; gap: 8px;"></div>

          <button
            type="button"
            id="sp-add-rule-btn"
            style="align-self: flex-start; padding: 6px 14px; background: rgba(124, 58, 237, 0.2); border: 1px dashed var(--color-accent-purple); border-radius: var(--radius-md); color: var(--color-accent-purple-glow); font-size: 12px; font-weight: 600; cursor: pointer;"
          >
            + Add Rule
          </button>
        </div>

        <!-- Sort & Limit Section -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-3);">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 600; color: var(--color-text-secondary);">Sort By</label>
            <select id="sp-sort-field" style="padding: 8px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 12px;">
              <option value="title" ${currentSortField === 'title' ? 'selected' : ''}>Title</option>
              <option value="artist" ${currentSortField === 'artist' ? 'selected' : ''}>Artist</option>
              <option value="album" ${currentSortField === 'album' ? 'selected' : ''}>Album</option>
              <option value="duration" ${currentSortField === 'duration' ? 'selected' : ''}>Duration</option>
              <option value="dateAdded" ${currentSortField === 'dateAdded' ? 'selected' : ''}>Date Added</option>
              <option value="lastPlayed" ${currentSortField === 'lastPlayed' ? 'selected' : ''}>Last Played</option>
              <option value="playCount" ${currentSortField === 'playCount' ? 'selected' : ''}>Play Count</option>
              <option value="random" ${currentSortField === 'random' ? 'selected' : ''}>Random</option>
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 600; color: var(--color-text-secondary);">Order</label>
            <select id="sp-sort-order" style="padding: 8px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 12px;">
              <option value="asc" ${currentSortOrder === 'asc' ? 'selected' : ''}>Ascending</option>
              <option value="desc" ${currentSortOrder === 'desc' ? 'selected' : ''}>Descending</option>
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 600; color: var(--color-text-secondary);">Limit (optional)</label>
            <input
              id="sp-limit-input"
              type="number"
              min="1"
              max="5000"
              placeholder="e.g. 50"
              value="${currentLimit ?? ''}"
              style="padding: 8px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 12px;"
            />
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-3);">
          <button type="button" class="modal-cancel-btn" style="padding: 8px 18px; background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-full); color: var(--color-text-secondary); font-size: 12px; cursor: pointer;">
            Cancel
          </button>
          <button type="submit" class="modal-submit-btn" style="padding: 8px 22px; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); border: 1px solid var(--glass-border-interactive); border-radius: var(--radius-full); color: #ffffff; font-size: 12px; font-weight: 700; cursor: pointer;">
            ${submitText}
          </button>
        </div>
      </form>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const rulesContainer = modal.querySelector<HTMLElement>('#sp-rules-container')!;
    const addRuleBtn = modal.querySelector<HTMLButtonElement>('#sp-add-rule-btn')!;
    const form = modal.querySelector<HTMLFormElement>('.smart-playlist-form')!;
    const closeBtn = modal.querySelector('.modal-close-btn');
    const cancelBtn = modal.querySelector('.modal-cancel-btn');
    const errorSpan = modal.querySelector<HTMLElement>('.sp-error');

    let activeRules: SmartRule[] = [...initialRules];

    const renderRules = () => {
      rulesContainer.innerHTML = '';
      activeRules.forEach((rule, idx) => {
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1.2fr 1.2fr 2fr 32px';
        row.style.gap = '8px';
        row.style.alignItems = 'center';

        row.innerHTML = `
          <select class="sp-rule-field" data-index="${idx}" style="padding: 6px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: 6px; color: #ffffff; font-size: 12px;">
            <option value="genre" ${rule.field === 'genre' ? 'selected' : ''}>Genre</option>
            <option value="artist" ${rule.field === 'artist' ? 'selected' : ''}>Artist</option>
            <option value="album" ${rule.field === 'album' ? 'selected' : ''}>Album</option>
            <option value="title" ${rule.field === 'title' ? 'selected' : ''}>Title</option>
            <option value="playCount" ${rule.field === 'playCount' ? 'selected' : ''}>Play Count</option>
            <option value="skipCount" ${rule.field === 'skipCount' ? 'selected' : ''}>Skip Count</option>
            <option value="duration" ${rule.field === 'duration' ? 'selected' : ''}>Duration (sec)</option>
            <option value="addedAt" ${rule.field === 'addedAt' ? 'selected' : ''}>Added (days)</option>
            <option value="lastPlayedAt" ${rule.field === 'lastPlayedAt' ? 'selected' : ''}>Last Played (days)</option>
            <option value="favorite" ${rule.field === 'favorite' ? 'selected' : ''}>Favorite</option>
          </select>

          <select class="sp-rule-operator" data-index="${idx}" style="padding: 6px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: 6px; color: #ffffff; font-size: 12px;">
            ${this.getOperatorOptions(rule.field, rule.operator)}
          </select>

          <input class="sp-rule-value" data-index="${idx}" type="text" value="${escapeHtml(String(rule.value))}" style="padding: 6px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: 6px; color: #ffffff; font-size: 12px;" />

          <button type="button" class="sp-rule-remove-btn" data-index="${idx}" style="background: transparent; border: none; color: var(--color-status-error); cursor: pointer; padding: 4px;">
            ${getIconSvg('close', { size: 14 })}
          </button>
        `;

        rulesContainer.appendChild(row);
      });

      // Bind row listeners
      rulesContainer.querySelectorAll<HTMLSelectElement>('.sp-rule-field').forEach(sel => {
        sel.addEventListener('change', e => {
          const i = parseInt((e.target as HTMLElement).getAttribute('data-index') || '0', 10);
          const newField = sel.value as SmartRuleField;
          const defaultOp = this.getDefaultOperator(newField);
          const defaultValue = this.getDefaultValue(newField);
          activeRules[i] = { field: newField, operator: defaultOp, value: defaultValue };
          renderRules();
        });
      });

      rulesContainer.querySelectorAll<HTMLSelectElement>('.sp-rule-operator').forEach(sel => {
        sel.addEventListener('change', () => {
          const i = parseInt(sel.getAttribute('data-index') || '0', 10);
          if (activeRules[i]) {
            activeRules[i] = { ...activeRules[i]!, operator: sel.value as SmartRuleOperator };
          }
        });
      });

      rulesContainer.querySelectorAll<HTMLInputElement>('.sp-rule-value').forEach(inp => {
        inp.addEventListener('input', () => {
          const i = parseInt(inp.getAttribute('data-index') || '0', 10);
          if (activeRules[i]) {
            let val: string | number | boolean = inp.value;
            if (activeRules[i]!.field === 'favorite') {
              val = inp.value === 'true';
            } else if (['playCount', 'skipCount', 'duration', 'addedAt', 'lastPlayedAt'].includes(activeRules[i]!.field)) {
              val = parseFloat(inp.value) || 0;
            }
            activeRules[i] = { ...activeRules[i]!, value: val };
          }
        });
      });

      rulesContainer.querySelectorAll<HTMLButtonElement>('.sp-rule-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = parseInt(btn.getAttribute('data-index') || '0', 10);
          activeRules.splice(i, 1);
          renderRules();
        });
      });
    };

    renderRules();

    addRuleBtn.addEventListener('click', () => {
      activeRules.push({ field: 'genre', operator: 'equals', value: '' });
      renderRules();
    });

    const close = () => {
      overlay.remove();
      if (options.onCancel) options.onCancel();
    };

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) close();
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const nameInput = modal.querySelector<HTMLInputElement>('#sp-name-input')!;
      const descInput = modal.querySelector<HTMLTextAreaElement>('#sp-desc-input')!;
      const sortFieldInput = modal.querySelector<HTMLSelectElement>('#sp-sort-field')!;
      const sortOrderInput = modal.querySelector<HTMLSelectElement>('#sp-sort-order')!;
      const limitInput = modal.querySelector<HTMLInputElement>('#sp-limit-input')!;

      const name = nameInput.value.trim();
      const description = descInput.value.trim() || undefined;
      const matchModeRadio = modal.querySelector<HTMLInputElement>('input[name="sp-match"]:checked');
      const matchMode = (matchModeRadio?.value as SmartMatchMode) || 'all';
      const sort = {
        field: sortFieldInput.value as SmartSortField,
        order: sortOrderInput.value as SmartSortOrder
      };
      const limitVal = limitInput.value.trim() ? parseInt(limitInput.value.trim(), 10) : null;

      if (!name) {
        if (errorSpan) {
          errorSpan.textContent = 'Playlist name is required.';
          errorSpan.style.display = 'block';
        }
        return;
      }

      try {
        await options.onSave(name, description, activeRules, matchMode, sort, limitVal);
        close();
      } catch (err: any) {
        if (errorSpan) {
          errorSpan.textContent = err?.message || 'Failed to save Smart Playlist.';
          errorSpan.style.display = 'block';
        }
      }
    });

    return overlay;
  }

  private static getOperatorOptions(field: SmartRuleField, currentOp: SmartRuleOperator): string {
    let ops: { val: string; label: string }[] = [];

    if (['title', 'artist', 'album', 'genre', 'folder', 'codec', 'format'].includes(field)) {
      ops = [
        { val: 'equals', label: 'Equals' },
        { val: 'contains', label: 'Contains' },
        { val: 'startsWith', label: 'Starts with' },
        { val: 'endsWith', label: 'Ends with' }
      ];
    } else if (['playCount', 'skipCount', 'duration'].includes(field)) {
      ops = [
        { val: 'equals', label: 'Equals (=)' },
        { val: 'greaterThan', label: 'Greater than (>)' },
        { val: 'greaterThanOrEqual', label: 'Greater or equal (>=)' },
        { val: 'lessThan', label: 'Less than (<)' },
        { val: 'lessThanOrEqual', label: 'Less or equal (<=)' }
      ];
    } else if (['addedAt', 'lastPlayedAt'].includes(field)) {
      ops = [
        { val: 'withinLast', label: 'Within last (days)' },
        { val: 'after', label: 'After (timestamp)' },
        { val: 'before', label: 'Before (timestamp)' }
      ];
    } else if (field === 'favorite') {
      ops = [
        { val: 'is', label: 'Is' },
        { val: 'isNot', label: 'Is not' }
      ];
    }

    return ops
      .map(o => `<option value="${o.val}" ${o.val === currentOp ? 'selected' : ''}>${o.label}</option>`)
      .join('');
  }

  private static getDefaultOperator(field: SmartRuleField): SmartRuleOperator {
    if (['title', 'artist', 'album', 'genre', 'folder', 'codec', 'format'].includes(field)) return 'equals';
    if (['playCount', 'skipCount', 'duration'].includes(field)) return 'greaterThan';
    if (['addedAt', 'lastPlayedAt'].includes(field)) return 'withinLast';
    if (field === 'favorite') return 'is';
    return 'equals';
  }

  private static getDefaultValue(field: SmartRuleField): string | number | boolean {
    if (['title', 'artist', 'album', 'genre', 'folder', 'codec', 'format'].includes(field)) return '';
    if (['playCount', 'skipCount'].includes(field)) return 0;
    if (field === 'duration') return 180;
    if (['addedAt', 'lastPlayedAt'].includes(field)) return 30;
    if (field === 'favorite') return true;
    return '';
  }
}
