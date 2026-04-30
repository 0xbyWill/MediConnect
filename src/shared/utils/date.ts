export function dateToISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function timeToHHMM(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatDateBR(iso: string) {
  if (!iso) return '';
  return iso.split('-').reverse().join('/');
}

export function splitApiDateTime(value: string) {
  const direct = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (direct) {
    return { data: direct[1], hora: `${direct[2]}:${direct[3]}` };
  }

  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return { data: '', hora: '' };

  return {
    data: dateToISO(dt),
    hora: timeToHHMM(dt),
  };
}
