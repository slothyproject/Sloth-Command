export function formatNumber(value: number | string | null | undefined) {
  if (value == null || value === "") {
    return "--";
  }

  return Number(value).toLocaleString();
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString();
}

export function formatRelativeDate(value: string | null | undefined) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const minutes = Math.round(diffMs / 60000);

  if (Math.abs(minutes) < 60) {
    return `${Math.abs(minutes)}m ${minutes <= 0 ? "ago" : "from now"}`;
  }

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return `${Math.abs(hours)}h ${hours <= 0 ? "ago" : "from now"}`;
  }

  const days = Math.round(hours / 24);
  return `${Math.abs(days)}d ${days <= 0 ? "ago" : "from now"}`;
}