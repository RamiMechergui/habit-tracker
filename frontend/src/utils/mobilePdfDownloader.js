/**
 * mobilePdfDownloader.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Cross-platform PDF download and native Android APK export helper.
 *
 * In web browsers:
 *   Triggers standard client-side browser file download via pdfMake or blob link.
 *
 * In Android APK (Capacitor native platform):
 *   1. Obtains base64 string from pdfMake.
 *   2. Writes the PDF file to device cache directory using @capacitor/filesystem.
 *   3. Resolves native file URI using FileProvider.
 *   4. Invokes @capacitor/share to allow the user to save to Downloads,
 *      open in Google PDF Viewer / Acrobat, or share to other apps.
 */

import { Capacitor } from '@capacitor/core';

/**
 * Downloads or shares a pdfMake document definition across web and Android.
 *
 * @param {Object} pdfMakeDoc  - pdfMake instance with createPdf(doc) available
 * @param {string} fileName    - Output file name (e.g., 'german_report.pdf')
 * @param {string} [title]     - Share / document title
 * @returns {Promise<{ success: boolean, method: 'native-share' | 'browser-download', uri?: string }>}
 */
export async function downloadPdfDocument(pdfMakeDoc, fileName = 'german_report.pdf', title = 'German Learning Report') {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');

      const base64Data = await new Promise((resolve, reject) => {
        try {
          pdfMakeDoc.getBase64((data) => {
            if (data) resolve(data);
            else reject(new Error('Failed to generate base64 for PDF'));
          });
        } catch (err) {
          reject(err);
        }
      });

      // Write file to device cache / documents directory
      const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const writeResult = await Filesystem.writeFile({
        path: cleanFileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      // Get native URI for Android intent / FileProvider
      const fileUri = await Filesystem.getUri({
        path: cleanFileName,
        directory: Directory.Cache,
      });

      const uriToShare = fileUri?.uri || writeResult?.uri;

      if (uriToShare) {
        await Share.share({
          title: title || cleanFileName,
          text: title || 'German Learning Report',
          url: uriToShare,
          dialogTitle: 'Download & Open German Report',
        });
        return { success: true, method: 'native-share', uri: uriToShare };
      }
    } catch (nativeErr) {
      console.warn('[mobilePdfDownloader] Native export failed, falling back to browser download:', nativeErr);
    }
  }

  // Web fallback or standard desktop browser download
  return new Promise((resolve, reject) => {
    try {
      pdfMakeDoc.download(fileName);
      resolve({ success: true, method: 'browser-download' });
    } catch (e) {
      // Fallback via getBlob
      try {
        pdfMakeDoc.getBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 200);
          resolve({ success: true, method: 'browser-download' });
        });
      } catch (blobErr) {
        reject(blobErr);
      }
    }
  });
}

/**
 * Downloads or shares a jsPDF document instance across web and Android.
 *
 * @param {Object} jsPdfDoc   - jsPDF instance
 * @param {string} fileName   - Output file name (e.g., 'report.pdf')
 * @param {string} [title]    - Share / document title
 * @returns {Promise<{ success: boolean, method: 'native-share' | 'browser-download', uri?: string }>}
 */
export async function downloadJsPdfDocument(jsPdfDoc, fileName = 'report.pdf', title = 'Evolvio PDF Report') {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');

      // Get base64 string from jsPDF
      const dataUri = jsPdfDoc.output('datauristring');
      const base64Data = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;

      const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const writeResult = await Filesystem.writeFile({
        path: cleanFileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      const fileUri = await Filesystem.getUri({
        path: cleanFileName,
        directory: Directory.Cache,
      });

      const uriToShare = fileUri?.uri || writeResult?.uri;

      if (uriToShare) {
        await Share.share({
          title: title || cleanFileName,
          text: title || 'Evolvio PDF Report',
          url: uriToShare,
          dialogTitle: 'Download & Open PDF Report',
        });
        return { success: true, method: 'native-share', uri: uriToShare };
      }
    } catch (nativeErr) {
      console.warn('[mobilePdfDownloader] Native jsPDF export failed, falling back to browser download:', nativeErr);
    }
  }

  // Web browser fallback
  try {
    jsPdfDoc.save(fileName);
    return { success: true, method: 'browser-download' };
  } catch (err) {
    console.error('[mobilePdfDownloader] Failed to save jsPDF:', err);
    throw err;
  }
}

