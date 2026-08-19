/**
 * exportGermanReport.js
 *
 * Client-side PDF export utility for the German Learning Report.
 * Uses the GermanReport template's buildPdfDefinition + pdfmake for generation.
 * 100% client-side — no server dependency.
 */

import { buildPdfDefinition } from './germanPdfBuilder';
import { withCircularAvatars } from './circularAvatar';

let pdfMakeInstance = null;

async function getPdfMake() {
  if (pdfMakeInstance) return pdfMakeInstance;
  const { default: pdfMake } = await import('pdfmake/build/pdfmake');
  const fontModule = await import('pdfmake/build/vfs_fonts');
  const fonts = fontModule.default || fontModule;
  const vfs = (fonts && fonts.pdfMake && fonts.pdfMake.vfs) || fonts || {};
  const { PDF_FONTS } = await import('../pdf/fonts');
  const { AMIRI_FONT } = await import('../pdf/arabicFont');
  const mergedVfs = Object.assign({}, vfs, PDF_FONTS, AMIRI_FONT);
  if (pdfMake.addVirtualFileSystem) pdfMake.addVirtualFileSystem(mergedVfs);
  else pdfMake.vfs = mergedVfs;
  pdfMake.fonts = {
    Roboto: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
    'Liberation Sans': {
      normal: 'LiberationSans-Regular.ttf',
      bold: 'LiberationSans-Bold.ttf',
      italics: 'LiberationSans-Italic.ttf',
      bolditalics: 'LiberationSans-BoldItalic.ttf',
    },
    'Liberation Serif': {
      normal: 'LiberationSerif-Regular.ttf',
      bold: 'LiberationSerif-Bold.ttf',
      italics: 'LiberationSerif-Italic.ttf',
      bolditalics: 'LiberationSerif-BoldItalic.ttf',
    },
    'Liberation Mono': {
      normal: 'LiberationMono-Regular.ttf',
      bold: 'LiberationMono-Bold.ttf',
      italics: 'LiberationMono-Italic.ttf',
      bolditalics: 'LiberationMono-BoldItalic.ttf',
    },
    Amiri: {
      normal: 'Amiri-Regular.ttf',
      bold: 'Amiri-Regular.ttf',
      italics: 'Amiri-Regular.ttf',
      bolditalics: 'Amiri-Regular.ttf',
    },
  };
  pdfMakeInstance = pdfMake;
  return pdfMake;
}

/**
 * Transform the app's germanData + study + progress into the flat record
 * array that GermanReport.buildPdfDefinition expects.
 *
 * @param {Array} germanData  - Records from the Store (vocab, grammar, verb, note, etc.)
 * @param {Object} germanStudy - Study statistics ({ totalMs, days, updatedAt })
 * @param {Object} germanProgress - Progress ({ currentLevel, levelsCompleted })
 * @returns {Array} Combined record array for the report template
 */
export function buildReportData(germanData, germanStudy, germanProgress) {
  const records = Array.isArray(germanData) ? [...germanData] : [];

  // Inject study record if available
  if (germanStudy) {
    records.push({
      type: 'study',
      totalMs: germanStudy.totalMs || 0,
      days: germanStudy.days || {},
      updatedAt: germanStudy.updatedAt || new Date().toISOString(),
    });
  }

  // Inject progress record if available
  if (germanProgress) {
    records.push({
      type: 'progress',
      currentLevel: germanProgress.currentLevel || '',
      levelsCompleted: germanProgress.levelsCompleted || [],
    });
  }

  return records;
}

/**
 * Build a report record array scoped to a single chapter.
 * Includes the chapter record itself plus every item whose chapterId
 * matches the selected chapter's recordId, plus study & progress.
 */
export function buildChapterReportData(germanData, chapter, germanStudy, germanProgress) {
  const records = Array.isArray(germanData) ? germanData : [];
  const chapterId = chapter?.recordId;

  const filtered = records.filter(
    (r) => r.type === 'chapter' ? r.recordId === chapterId : r.chapterId === chapterId
  );

  if (germanStudy) {
    filtered.push({
      type: 'study',
      totalMs: germanStudy.totalMs || 0,
      days: germanStudy.days || {},
      updatedAt: germanStudy.updatedAt || new Date().toISOString(),
    });
  }

  if (germanProgress) {
    filtered.push({
      type: 'progress',
      currentLevel: germanProgress.currentLevel || '',
      levelsCompleted: germanProgress.levelsCompleted || [],
    });
  }

  return filtered;
}

/**
 * Generate and download the German Learning Report PDF.
 *
 * @param {Object} options
 * @param {Array}  options.germanData      - Records from the Store
 * @param {Object} options.germanStudy     - Study statistics
 * @param {Object} options.germanProgress  - Progress data
 * @param {string} [options.fileName]      - Download file name
 * @param {string} [options.title]         - Report title
 * @param {string} [options.subtitle]      - Report subtitle
 * @returns {Promise<void>}
 */
async function getLogoBase64() {
  if (typeof window === 'undefined') return null;
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = '/logo_circle.png';
    });
  } catch (e) {
    return null;
  }
}

export async function exportGermanReportPDF({
  germanData,
  germanStudy,
  germanProgress,
  fileName = 'german_report.pdf',
  title = 'DEUTSCH LERNEN',
  subtitle = 'My German Learning Journey',
  user,
  userName = '',
}) {
  const data = await withCircularAvatars(buildReportData(germanData, germanStudy, germanProgress));

  if (!data.length) {
    throw new Error('No data available to generate the report.');
  }

  const logoBase64 = await getLogoBase64();
  const userFullName = userName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || user?.surname || '';
  const doc = buildPdfDefinition(data, { title, subtitle, logoBase64, userFullName });
  const pdfMake = await getPdfMake();
  pdfMake.createPdf(doc).download(fileName);
}

/**
 * Generate the PDF and return it as a Blob (for preview or custom handling).
 *
 * @param {Object} options - Same as exportGermanReportPDF
 * @returns {Promise<Blob>} PDF blob
 */
export async function generateGermanReportBlob({
  germanData,
  germanStudy,
  germanProgress,
  title = 'DEUTSCH LERNEN',
  subtitle = 'My German Learning Journey',
  user,
  userName = '',
}) {
  const data = await withCircularAvatars(buildReportData(germanData, germanStudy, germanProgress));

  if (!data.length) {
    throw new Error('No data available to generate the report.');
  }

  const logoBase64 = await getLogoBase64();
  const userFullName = userName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || user?.surname || '';
  const doc = buildPdfDefinition(data, { title, subtitle, logoBase64, userFullName });
  const pdfMake = await getPdfMake();

  return new Promise((resolve) => {
    pdfMake.createPdf(doc).getBlob((blob) => {
      resolve(blob);
    });
  });
}
