import { toPng, toSvg } from 'html-to-image';

function downloadFile(dataUrl, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/**
 * Captures the React Flow canvas container as PNG
 */
export async function exportCanvasAsPng(element, filename = 'code-architecture.png') {
  if (!element) return;
  try {
    const dataUrl = await toPng(element, {
      backgroundColor: '#090d16',
      pixelRatio: 2,
      filter: (node) => {
        // Exclude minimap or controls from the clean diagram export if desired, or keep them
        if (node.classList?.contains('react-flow__controls')) return false;
        return true;
      },
    });
    downloadFile(dataUrl, filename);
    return true;
  } catch (error) {
    console.error('Failed to export diagram as PNG:', error);
    throw error;
  }
}

/**
 * Captures the React Flow canvas container as SVG
 */
export async function exportCanvasAsSvg(element, filename = 'code-architecture.svg') {
  if (!element) return;
  try {
    const dataUrl = await toSvg(element, {
      backgroundColor: '#090d16',
      filter: (node) => {
        if (node.classList?.contains('react-flow__controls')) return false;
        return true;
      },
    });
    downloadFile(dataUrl, filename);
    return true;
  } catch (error) {
    console.error('Failed to export diagram as SVG:', error);
    throw error;
  }
}

/**
 * Encodes code and metadata into shareable link hash
 */
export function generateShareableLink(code, language, mode) {
  const payload = {
    c: code,
    l: language,
    m: mode,
  };
  const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
  const url = `${window.location.origin}${window.location.pathname}#share=${encoded}`;
  return url;
}

/**
 * Decodes code and metadata from shareable link hash if present
 */
export function getSharedDataFromUrl() {
  try {
    const hash = window.location.hash;
    if (hash && hash.includes('#share=')) {
      const encoded = hash.split('#share=')[1];
      const jsonStr = decodeURIComponent(atob(encoded));
      const parsed = JSON.parse(jsonStr);
      return {
        code: parsed.c,
        language: parsed.l,
        mode: parsed.m,
      };
    }
  } catch (e) {
    console.warn('Could not parse share hash from URL:', e);
  }
  return null;
}
