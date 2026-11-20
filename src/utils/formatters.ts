const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (value: number) => value.toString().padStart(2, '0');

export const formatters = {
  formatDate(date: Date): string {
    return `${pad(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  },

  formatTime(date: Date): string {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },

  formatDateTime(date: Date): string {
    return `${formatters.formatDate(date)}, ${formatters.formatTime(date)}`;
  },

  formatRelativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatters.formatDate(date);
  },
};
