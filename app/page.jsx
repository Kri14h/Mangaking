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