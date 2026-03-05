

I have an existing Next.js manga reader project. I want you to completely transform it. Here is exactly what to do, step by step. Do not skip any step.

---

### STEP 1 — DELETE all MangaDex-related files

Delete these files and folders entirely:
- `app/(core)/manga-list/` (entire folder)
- `app/(core)/manga/` (entire folder)
- `app/(core)/search/` (entire folder)
- `app/api/manga/` (entire folder)
- `app/api/comments/` (entire folder)
- `app/api/translate/` (entire folder)
- `app/api/proxy/` (entire folder)
- `app/Components/MangaListComponents/` (entire folder)
- `app/Components/MangaChaptersComponents/` (entire folder)
- `app/Components/SearchPageComponents/` (entire folder)
- `app/Components/HomeComponents/` (entire folder)
- `app/Components/TopNavbar.jsx`
- `app/Components/TopNavbarComponents/` (entire folder)
- `app/hooks/useMangaFetch.js`
- `app/hooks/useChaptersFetch.js`
- `app/hooks/useMangaFilters.js`
- `app/hooks/useMangaTitle.js`
- `app/constants/TopFavouriteMangas.js`
- `app/util/MangaList/` (entire folder)
- `app/lib/gtag.ts`
- `app/Components/AnalyticsClient.tsx`

---

### STEP 2 — Replace `app/page.jsx` with a new Library page

Replace the entire content of `app/page.jsx` with this:

```jsx
"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import JSZip from "jszip";

export default function LibraryPage() {
  const [library, setLibrary] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("manga_library") || "[]");
    } catch { return []; }
  });
  const fileInputRef = useRef(null);
  const router = useRouter();

  const saveLibrary = (updated) => {
    setLibrary(updated);
    localStorage.setItem("manga_library", JSON.stringify(updated));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    const imageFiles = Object.keys(contents.files)
      .filter(name => /\.(jpg|jpeg|png|webp|gif)$/i.test(name))
      .sort();
    const pages = await Promise.all(
      imageFiles.map(async (name) => {
        const blob = await contents.files[name].async("blob");
        return URL.createObjectURL(blob);
      })
    );
    const manga = {
      id: Date.now().toString(),
      title: file.name.replace(/\.(cbz|zip)$/i, ""),
      cover: pages[0] || null,
      pages,
      addedAt: new Date().toISOString(),
    };
    const updated = [manga, ...library];
    saveLibrary(updated);
    localStorage.setItem(`manga_pages_${manga.id}`, JSON.stringify(pages));
  };

  const openManga = (manga) => {
    localStorage.setItem(`manga_pages_${manga.id}`, JSON.stringify(manga.pages));
    router.push(`/read/${manga.id}`);
  };

  const deleteManga = (id, e) => {
    e.stopPropagation();
    const updated = library.filter(m => m.id !== id);
    saveLibrary(updated);
    localStorage.removeItem(`manga_pages_${id}`);
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 px-6 py-6 bg-black/80 backdrop-blur-md">
        <h1 className="text-3xl font-bold" style={{ background: "linear-gradient(to right, #a78bfa, #4b2bee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Library
        </h1>
      </header>

      {/* Grid */}
      <main className="px-4 pb-32">
        {library.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-white/30">
            <span className="text-6xl mb-4">📚</span>
            <p className="text-lg">No manga yet</p>
            <p className="text-sm mt-1">Tap + to import a CBZ or ZIP file</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {library.map(manga => (
              <div
                key={manga.id}
                onClick={() => openManga(manga)}
                className="relative aspect-[2/3] overflow-hidden rounded-xl bg-white/5 active:scale-95 transition-transform cursor-pointer"
              >
                {manga.cover ? (
                  <img src={manga.cover} alt={manga.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-white/10 text-white/30 text-4xl">📖</div>
                )}
                {/* Title overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                  <p className="text-xs font-semibold truncate text-white">{manga.title}</p>
                  <p className="text-[10px] text-white/40">{manga.pages?.length || 0} pages</p>
                </div>
                {/* Delete button */}
                <button
                  onClick={(e) => deleteManga(manga.id, e)}
                  className="absolute top-2 right-2 size-7 rounded-full bg-black/60 flex items-center justify-center text-white/60 hover:text-red-400 text-xs"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Import Button */}
      <input ref={fileInputRef} type="file" accept=".cbz,.zip" className="hidden" onChange={handleFileUpload} />
      <button
        onClick={() => fileInputRef.current.click()}
        className="fixed bottom-8 right-6 z-50 size-14 rounded-full text-white text-3xl flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        style={{ background: "#4b2bee", boxShadow: "0 0 20px rgba(75,43,238,0.5)" }}
      >+</button>
    </div>
  );
}
```

---

### STEP 3 — Create a new Reader page at `app/read/[mangaId]/page.jsx`

Create this file (and the folder structure `app/read/[mangaId]/`):

```jsx
"use client";
import { useState, useEffect, useRef } from "react";
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

  useEffect(() => {
    const stored = localStorage.getItem(`manga_pages_${mangaId}`);
    if (stored) setPages(JSON.parse(stored));
  }, [mangaId]);

  const prevPage = () => setCurrentPage(p => Math.max(0, p - 1));
  const nextPage = () => setCurrentPage(p => Math.min(pages.length - 1, p + 1));

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
    if (!pages[currentPage]) return;
    setOcrActive(true);
    setShowOcrPanel(true);
    setOcrText("Scanning page...");
    try {
      const res = await fetch("/api/readTextAndReplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: pages[currentPage], language: "en" }),
      });
      const data = await res.json();
      const text = data?.result?.map(r => r.text).join(" ") || "No text found.";
      setOcrText(text);
      speak(text);
    } catch {
      setOcrText("OCR failed. Try again.");
    } finally {
      setOcrActive(false);
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
          src={pages[currentPage]}
          alt={`Page ${currentPage + 1}`}
          className="h-full w-full object-contain"
        />

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
```

---

### STEP 4 — Install JSZip

Run this in the terminal:
```bash
npm install jszip
```

---

### STEP 5 — Update `app/layout.jsx`

Replace the entire content of `app/layout.jsx` with this minimal version:

```jsx
import "./globals.css";

export const metadata = {
  title: "Manga Reader",
  description: "Read your manga offline",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#000", color: "#fff" }}>
        {children}
      </body>
    </html>
  );
}
```

---

### STEP 6 — Keep the OCR API route

Do NOT delete `app/api/readTextAndReplace/`. This is the OCR engine and must stay exactly as it is.

---

### STEP 7 — Run the app

```bash
npm run dev
```

The app should now start cleanly with no MangaDex errors. The homepage is the Library. Tap + to import a CBZ or ZIP file. Tap any manga to read it. In the reader, tap the 🧠 button to OCR the current page and have it read aloud.

---


