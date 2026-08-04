import { format } from 'date-fns';
import { nativeFetch } from '../config';

export async function exportGermanPDF() {
  const res = await nativeFetch('/api/german/report/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.message) msg = body.message;
    } catch (_) { /* ignore non-JSON body */ }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `German_Learning_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
