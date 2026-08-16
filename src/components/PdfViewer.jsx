import { useEffect, useRef, useState } from "react";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Converte um data URI (data:application/pdf;base64,...) em Uint8Array
function decodePdfDataUri(dataUri) {
  const commaIndex = dataUri.indexOf(",");
  if (commaIndex === -1) return null;

  const payload = dataUri.slice(commaIndex + 1);
  let binary;
  try {
    binary = atob(payload);
  } catch {
    // Caso o payload esteja URL-encoded
    try {
      binary = atob(decodeURIComponent(payload));
    } catch {
      return null;
    }
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export default function PdfViewer({ dataUri, title }) {
  const containerRef = useRef(null);
  const pdfRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pages, setPages] = useState([]);
  const [error, setError] = useState(null);

  // Observa a largura do container para renderizar as páginas na largura correta
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let resizeTimer = null;
    const updateWidth = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setContainerWidth(el.clientWidth);
      }, 150);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, []);

  // Renderiza cada página do PDF como imagem em largura total
  useEffect(() => {
    if (!containerWidth) return;

    let cancelled = false;

    const renderPages = async () => {
      setError(null);
      try {
        const data = decodePdfDataUri(dataUri);
        if (!data) throw new Error("PDF inválido");

        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

        const loadingTask = pdfjs.getDocument({
          data,
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
        });
        const pdf = await loadingTask.promise;

        if (cancelled) {
          pdf.destroy();
          return;
        }
        pdfRef.current = pdf;

        const dpr = window.devicePixelRatio || 1;
        const rendered = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (cancelled) break;

          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = (containerWidth / baseViewport.width) * dpr;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);

          await page.render({ canvasContext: context, viewport }).promise;

          rendered.push({
            pageNumber,
            dataUrl: canvas.toDataURL("image/png"),
            width: viewport.width,
            height: viewport.height,
          });
        }

        if (!cancelled) setPages(rendered);
      } catch (err) {
        console.error("Falha ao renderizar PDF:", err);
        if (!cancelled) setError("Não foi possível exibir este PDF.");
      }
    };

    renderPages();

    return () => {
      cancelled = true;
      if (pdfRef.current) {
        pdfRef.current.destroy();
        pdfRef.current = null;
      }
    };
  }, [dataUri, containerWidth]);

  if (error) {
    return (
      <div className="flex items-center justify-center bg-white p-8 text-sm text-slate-500">
        {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="block w-full select-none bg-white">
      {pages.length === 0 ? (
        <div className="flex items-center justify-center p-8 text-sm text-slate-400">
          Carregando PDF…
        </div>
      ) : (
        pages.map((page) => (
          <img
            key={page.pageNumber}
            src={page.dataUrl}
            alt={title ? `Página ${page.pageNumber} de ${title}` : `Página ${page.pageNumber} do PDF`}
            className="block w-full h-auto select-none"
          />
        ))
      )}
    </div>
  );
}
