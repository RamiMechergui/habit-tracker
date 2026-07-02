export const AVATAR_COLORS = [
  '#3b82f6', '#ec4899', '#8b5cf6', '#10b981',
  '#f97316', '#eab308', '#06b6d4', '#ef4444',
  '#14b8a6', '#f43f5e', '#6366f1', '#84cc16',
];

export function generateAvatarDataUri(name, bgColor) {
  const initial = (name || '?').charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="${bgColor}"/><text x="50" y="50" text-anchor="middle" dy="0.35em" fill="white" font-size="42" font-weight="bold" font-family="sans-serif">${initial}</text></svg>`;
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

export function isDataUri(str) {
  return typeof str === 'string' && str.startsWith('data:image/svg+xml');
}

export function isMinIoUrl(str) {
  return typeof str === 'string' && str.startsWith('/api/german/images/');
}
