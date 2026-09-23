export interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isArtist?: boolean;
  className?: string;
  badge?: string;
}

export function renderAvatar(props: AvatarProps): string {
  const { name, imageUrl, size = 'md', isArtist = false, className = '', badge = '' } = props;
  const initial = (name.trim()[0] || 'O').toUpperCase();

  const sizeClasses = {
    sm: 'avatar-sm',
    md: 'avatar-md',
    lg: 'avatar-lg',
    xl: 'avatar-xl'
  };

  const imageHtml = imageUrl
    ? `<img src="${imageUrl}" alt="${name}" class="avatar-img" loading="lazy" />`
    : `<span class="avatar-initial">${initial}</span>`;

  const artistClass = isArtist ? 'avatar-circle' : 'avatar-rounded';
  const badgeHtml = badge ? `<span class="avatar-badge">${badge}</span>` : '';

  return `
    <div class="app-avatar ${sizeClasses[size]} ${artistClass} ${className}">
      ${imageHtml}
      ${badgeHtml}
    </div>
  `;
}
