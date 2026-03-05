"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";

export default function ReaderPage() {
  const { mangaId } = useParams();
  const router = useRouter();
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ocrActive, setOcrActive] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [showOcrPanel, setShowOcrPanel] = useState(false);
  const [pencilMode, setPencilMode] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const [cachedOCR, setCachedOCR] = useState({});
  const [autoOCRLoaded, setAutoOCRLoaded] = useState(new Set());
  
  const imageRef = useRef(null);
  const startPos = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem(`manga_pages_${mangaId}`);
    if (stored) setPages(JSON.parse(stored));
  }, [mangaId]);

  // Background OCR caching (N+1 strategy)
  useEffect(() => {
    if (pages.length > 0 && !autoOCRLoaded.has(currentPage)) {
      // Auto OCR current page
      performBackgroundOCR(currentPage);
      
      // Pre-cache next 2 pages
      if (currentPage + 1 < pages.length) {
        performBackgroundOCR(currentPage + 1);
      }
      if (currentPage + 2 < pages.length) {
        performBackgroundOCR(currentPage + 2);
      }
    }
  }, [currentPage, pages]);

  const performBackgroundOCR = useCallback(async (pageIndex) => {
    if (cachedOCR[pageIndex] || autoOCRLoaded.has(pageIndex)) return;
    
    try {
      const response = await fetch(pages[pageIndex]);
      const blob = await response.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

      const res = await fetch("/api/readTextAndReplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, language: "en" }),
      });
      
      if (res.ok) {
        const data = await res.json();
        const text = data?.data?.map(r => r.text).join(" ") || "";
        setCachedOCR(prev => ({ ...prev, [pageIndex]: text }));
        setAutoOCRLoaded(prev => new Set([...prev, pageIndex]));
      }
    } catch (err) {
      console.error(`Background OCR failed for page ${pageIndex}:`, err);
    }
  }, [pages, cachedOCR, autoOCRLoaded]);

  const prevPage = () => setCurrentPage(p => Math.max(0, p - 1));
  const nextPage = () => setCurrentPage(p => Math.min(pages.length - 1, p + 1));

  // Selection handlers for pencil mode
  const handleMouseDown = (e) => {
    if (!pencilMode) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    startPos.current = { x, y };
    setIsSelecting(true);
    setSelectionBox({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e) => {
    if (!isSelecting || !pencilMode) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = x - startPos.current.x;
    const height = y - startPos.current.y;
    setSelectionBox({
      x: Math.min(startPos.current.x, x),
      y: Math.min(startPos.current.y, y),
      width: Math.abs(width),
      height: Math.abs(height)
    });
  };

  const handleMouseUp = async () => {
    if (!isSelecting || !pencilMode || !selectionBox) return;
    setIsSelecting(false);
    
    // Perform localized OCR on selection
    await performLocalizedOCR(selectionBox);
    setSelectionBox(null);
  };

  const performLocalizedOCR = async (box) => {
    if (!pages[currentPage]) return;
    
    setOcrActive(true);
    setShowOcrPanel(true);
    setOcrText("Scanning selection...");
    
    try {
      const response = await fetch(pages[currentPage]);
      const blob = await response.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

      const res = await fetch("/api/readTextAndReplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          imageBase64: base64, 
          language: "en",
          cropRegion: box // Send selection coordinates
        }),
      });
      
      const data = await res.json();
      console.log("Localized OCR Response:", data);
      
      if (!res.ok) {
        setOcrText(`Error: ${data.error || "Failed to process selection"}`);
        return;
      }

      const text = data?.data?.map(r => r.text).join(" ") || "No text found in selection.";
      setOcrText(text);
      if (text !== "No text found in selection.") {
        speak(text);
      }
    } catch (err) {
      console.error("Localized OCR error:", err);
      setOcrText("OCR failed. Try again.");
    } finally {
      setOcrActive(false);
    }
  };

  const speak = (text) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utt);
  };

  const stopSpeech = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const handleOCR = async () => {
    // Use cached OCR if available
    if (cachedOCR[currentPage]) {
      setOcrText(cachedOCR[currentPage]);
      setShowOcrPanel(true);
      speak(cachedOCR[currentPage]);
      return;
    }

    if (!pages[currentPage]) return;
    setOcrActive(true);
    setShowOcrPanel(true);
    setOcrText("Scanning page...");
    try {
      const response = await fetch(pages[currentPage]);
      const blob = await response.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

      const res = await fetch("/api/readTextAndReplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, language: "en" }),
      });
      
      const data = await res.json();
      console.log("OCR Response:", data);
      
      if (!res.ok) {
        setOcrText(`Error: ${data.error || "Failed to process image"}`);
        return;
      }

      const text = data?.data?.map(r => r.text).join(" ") || "No text found.";
      setOcrText(text);
      setCachedOCR(prev => ({ ...prev, [currentPage]: text }));
      if (text !== "No text found.") {
        speak(text);
      }
    } catch (err) {
      console.error("OCR error:", err);
      setOcrText("OCR failed. Try again.");
    } finally {
      setOcrActive(false);
    }
  };

  const togglePencilMode = () => {
    setPencilMode(!pencilMode);
    if (pencilMode) {
      setSelectionBox(null);
      setIsSelecting(false);
    }
  };

  if (pages.length === 0) {
    return (
      <div className="h-screen bg-black flex items-center justify-center text-white/40">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white overflow-hidden select-none relative flex flex-col">
      {/* Manga Image */}
      <div className="flex-1 flex items-center justify-center relative">
        <img
          ref={imageRef}
          src={pages[currentPage]}
          alt={`Page ${currentPage + 1}`}
          className="h-full w-full object-contain"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ 
            cursor: pencilMode ? (isSelecting ? 'crosshair' : 'pointer') : 'default',
            userSelect: 'none'
          }}
        />

        {/* Pencil mode overlay */}
        {pencilMode && (
          <div className="absolute inset-0 bg-black/20 pointer-events-none">
            <div className="absolute top-4 left-4 bg-black/80 text-white px-3 py-1 rounded-lg text-sm">
              📝 Select text area by dragging
            </div>
          </div>
        )}

        {/* Selection box */}
        {selectionBox && (
          <div
            className="absolute border-2 border-purple-400 bg-purple-400/20 pointer-events-none"
            style={{
              left: selectionBox.x,
              top: selectionBox.y,
              width: selectionBox.width,
              height: selectionBox.height,
            }}
          />
        )}

        {/* Top buttons */}
        <div className="absolute top-0 left-0 right-0 p-5 flex justify-between pointer-events-none">
          <button
            onClick={() => router.push("/")}
            className="pointer-events-auto size-12 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)" }}
          >🏠</button>
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            className="pointer-events-auto size-12 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)" }}
          >⛶</button>
        </div>
      </div>

      {/* OCR text panel */}
      {showOcrPanel && (
        <div className="absolute bottom-40 left-4 right-4 rounded-xl p-4 text-sm text-white/90 max-h-40 overflow-y-auto"
          style={{ background: "rgba(19,16,34,0.95)", border: "1px solid rgba(75,43,238,0.4)" }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] uppercase tracking-widest text-purple-400">OCR Text</span>
            <button onClick={() => { setShowOcrPanel(false); stopSpeech(); }} className="text-white/40 text-xs">✕</button>
          </div>
          <p>{ocrText}</p>
          {ocrText && ocrText !== "Scanning page..." && (
            <button onClick={() => speak(ocrText)} className="mt-2 text-[10px] text-purple-400">▶ Read aloud</button>
          )}
        </div>
      )}

      {/* Bottom Controls */}
      <div className="px-6 pb-10 flex flex-col items-center gap-4">
        {/* Slider */}
        <input
          type="range" min={0} max={pages.length - 1} value={currentPage}
          onChange={e => setCurrentPage(Number(e.target.value))}
          className="w-full accent-white"
          style={{ height: "4px" }}
        />
        {/* Nav bar */}
        <div className="flex items-center gap-4 p-2 rounded-xl"
          style={{ background: "rgba(19,16,34,0.6)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <button onClick={prevPage} className="size-14 rounded-xl flex items-center justify-center text-2xl hover:bg-white/10 transition-colors">‹</button>

          {/* Pencil mode button */}
          <div className="relative">
            <button
              onClick={togglePencilMode}
              className="size-16 rounded-xl flex items-center justify-center text-2xl transition-transform active:scale-95"
              style={{
                background: pencilMode ? "#f59e0b" : "#6b7280",
                boxShadow: pencilMode ? "0 0 15px rgba(245,158,11,0.5)" : "0 0 15px rgba(107,114,128,0.3)",
              }}
            >
              ✏️
            </button>
            {pencilMode && (
              <div className="absolute -top-1 -right-1 size-3 bg-orange-400 rounded-full border-2 border-black"></div>
            )}
          </div>

          {/* OCR / TTS button */}
          <div className="relative">
            <button
              onClick={isSpeaking ? stopSpeech : handleOCR}
              className="size-16 rounded-xl flex items-center justify-center text-2xl transition-transform active:scale-95"
              style={{
                background: isSpeaking ? "#dc2626" : "#4b2bee",
                boxShadow: isSpeaking ? "0 0 15px rgba(220,38,38,0.5)" : "0 0 15px rgba(75,43,238,0.5)",
              }}
            >
              {ocrActive ? "⏳" : isSpeaking ? "⏹" : "🧠"}
            </button>
            {isSpeaking && (
              <div className="absolute -top-1 -right-1 size-3 bg-green-400 rounded-full border-2 border-black"></div>
            )}
          </div>

          <button onClick={nextPage} className="size-14 rounded-xl flex items-center justify-center text-2xl hover:bg-white/10 transition-colors">›</button>
        </div>
        {/* Page indicator */}
        <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold">
          Page {currentPage + 1} of {pages.length}
        </p>
      </div>
    </div>
  );
}
