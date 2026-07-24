import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

const COLORS = {
  orange:    [255, 153, 0],
  blue:      [35, 97, 146],
  dark:      [15, 23, 42],
  muted:     [100, 116, 139],
  white:     [255, 255, 255],
  lightGray: [241, 245, 249],
  midGray:   [148, 163, 184],
  green:     [16, 185, 129],
  purple:    [139, 92, 246],
};

function addHeader(doc, title, subtitle) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, W, 36, 'F');
  doc.setFillColor(...COLORS.orange);
  doc.rect(0, 34, W, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.orange);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.midGray);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 14, 27);
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text('EVOLVIO', W - 14, 20, { align: 'right' });
}

function addSectionTitle(doc, text, y, color = COLORS.orange) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...color);
  doc.rect(14, y - 4, 3, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...color);
  doc.text(text, 20, y + 4);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(14, y + 8, W - 14, y + 8);
  return y + 16;
}

function addStatBadge(doc, x, y, label, value, color) {
  doc.setFillColor(color[0], color[1], color[2], 0.08);
  doc.roundedRect(x, y, 54, 24, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...color);
  doc.text(String(value), x + 27, y + 13, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.text(label, x + 27, y + 20, { align: 'center' });
}

export function exportAwsPDF(awsData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  const services = awsData.filter(r => r.type === 'service').sort((a, b) => a.service?.localeCompare(b.service));
  const certs    = awsData.filter(r => r.type === 'cert').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const notes    = awsData.filter(r => r.type === 'note').sort((a, b) => a.date?.localeCompare(b.date));

  const totalStudyMinutes = notes.reduce((acc, n) => acc + (parseInt(n.studyMinutes) || 0), 0);

  addHeader(doc,
    'AWS Learning Report',
    `Generated on ${format(new Date(), 'MMMM d, yyyy – HH:mm')}`
  );

  let y = 52;
  addStatBadge(doc, 14, y, 'AWS Services', services.length, COLORS.orange);
  addStatBadge(doc, 74, y, 'Certifications', certs.length, COLORS.blue);
  addStatBadge(doc, 134, y, 'Study Days', notes.length, COLORS.green);

  y += 36;
  const hours = Math.floor(totalStudyMinutes / 60);
  const mins  = totalStudyMinutes % 60;
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(14, y, W - 28, 14, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.dark);
  doc.text(`Total Study Time:  ${hours}h ${mins}m`, 20, y + 9);
  y += 24;

  if (services.length > 0) {
    y = addSectionTitle(doc, `☁️  AWS Services  (${services.length} services)`, y, COLORS.orange);
    doc.autoTable({
      startY: y,
      head: [['#', 'Service', 'Description', 'Category', 'Pricing', 'Added']],
      body: services.map((s, i) => [
        i + 1,
        s.service || '',
        s.description || '',
        s.category || 'General',
        s.pricing || '—',
        s.createdAt ? format(new Date(s.createdAt), 'MMM d, yyyy') : '—',
      ]),
      headStyles: { fillColor: COLORS.dark, textColor: COLORS.orange, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 50 }, 3: { cellWidth: 22 }, 4: { cellWidth: 22 } },
      margin: { left: 14, right: 14 },
      theme: 'grid',
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  if (certs.length > 0) {
    if (y > 220) { doc.addPage(); addHeader(doc, 'AWS Learning Report', 'Certifications'); y = 46; }
    y = addSectionTitle(doc, `🏅  Certifications  (${certs.length} entries)`, y, COLORS.blue);
    doc.autoTable({
      startY: y,
      head: [['#', 'Certification', 'Provider', 'Status', 'Exam Date', 'Score']],
      body: certs.map((c, i) => [
        i + 1,
        c.certification || '',
        c.provider || 'AWS',
        c.status || 'Planned',
        c.examDate || '—',
        c.score || '—',
      ]),
      headStyles: { fillColor: COLORS.dark, textColor: [100, 160, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 22 }, 3: { cellWidth: 22 }, 4: { cellWidth: 24 }, 5: { cellWidth: 16 } },
      margin: { left: 14, right: 14 },
      theme: 'grid',
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  if (notes.length > 0) {
    if (y > 200) { doc.addPage(); addHeader(doc, 'AWS Learning Report', 'Daily Study Notes'); y = 46; }
    y = addSectionTitle(doc, `📝  Daily Study Notes  (${notes.length} entries)`, y, COLORS.green);
    for (const note of notes) {
      if (y > 255) {
        doc.addPage();
        addHeader(doc, 'AWS Learning Report', 'Daily Study Notes (cont.)');
        y = 46;
      }
      doc.setFillColor(...COLORS.dark);
      doc.roundedRect(14, y, W - 28, 8, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.green);
      const dateLabel = note.date ? format(new Date(note.date + 'T12:00:00'), 'EEEE, MMMM d yyyy') : note.date;
      doc.text(dateLabel, 18, y + 5.5);
      if (note.studyMinutes) {
        doc.setTextColor(...COLORS.muted);
        doc.text(`⏱ ${note.studyMinutes} min`, W - 18, y + 5.5, { align: 'right' });
      }
      y += 11;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.dark);
      const lines = doc.splitTextToSize(note.content || '', W - 36);
      doc.text(lines, 18, y);
      y += lines.length * 4.5 + 8;
    }
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    doc.setFillColor(...COLORS.lightGray);
    doc.rect(0, H - 10, W, 10, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Page ${i} of ${totalPages}`, W / 2, H - 4, { align: 'center' });
    doc.text('Evolvio — AWS Learning System', 14, H - 4);
    doc.text(format(new Date(), 'yyyy-MM-dd'), W - 14, H - 4, { align: 'right' });
  }

  doc.save(`AWS_Learning_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
