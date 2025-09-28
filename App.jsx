import React, { useState } from 'react';

/**

FlashCardGen React component

Single-file prototype intended to run as a web app / PWA on phone.

TailwindCSS classes are used for styling (no import needed in the canvas preview)


Accepts PDF or image uploads, extracts text (PDF via pdfjs, images via Tesseract.js if available)


Generates simple flashcards automatically from the extracted text using heuristics


Allows CSV export (for Anki import or other flashcard apps)


Notes / next steps:

This is a client-side prototype. For better question/answer generation you can plug


a server-side AI (OpenAI) by creating an endpoint /api/generate that accepts text

and returns higher-quality Q/A pairs.

For large PDFs use server-side extraction to avoid blocking the phone. */



export default function FlashCardGen() { const [files, setFiles] = useState([]); const [text, setText] = useState(''); const [cards, setCards] = useState([]); const [status, setStatus] = useState('');

// simple list of stopwords in Hungarian + English to ignore when picking keywords const stopwords = new Set([ 'és','vagy','a','az','azt','azok','egy','ez','hogy','nem','de','ha','mert','is','én','te','mi','ők', 'the','and','or','is','are','it','that','this','of','to','in','on','for','with' ]);

function handleFilesChange(e) { const f = Array.from(e.target.files || []); setFiles(f); // try to extract text client-side extractTextFromFiles(f); }

async function extractTextFromFiles(flist) { setStatus('Szöveg kinyerése...'); let full = ''; for (const f of flist) { if (f.type === 'application/pdf') { // try to use pdfjs if present try { // dynamic import to avoid bundler issues in prototype const pdfjsLib = await import('pdfjs-dist/build/pdf'); // worker is needed for pdfjs; in production set workerSrc properly pdfjsLib.GlobalWorkerOptions.workerSrc = //cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js; const array = await f.arrayBuffer(); const pdf = await pdfjsLib.getDocument({data: array}).promise; let pdftxt = ''; for (let p = 1; p <= pdf.numPages; ++p) { const page = await pdf.getPage(p); const content = await page.getTextContent(); const strings = content.items.map(i => i.str); pdftxt += strings.join(' ') + '\n\n'; } full += '\n' + pdftxt; } catch (err) { full += \n[PDF feldolgozási hiba: ${f.name}]\n; console.error(err); } } else if (f.type.startsWith('image/') || f.type === 'application/octet-stream') { // try Tesseract.js if available try { const Tesseract = await import('tesseract.js'); const { data: { text: ocrText } } = await Tesseract.recognize(await f.arrayBuffer(), 'hun', { logger: m => {/* optional */} }); full += '\n' + ocrText; } catch (err) { // fallback: we can't OCR, so note it full += \n[OCR nem elérhető vagy hiba: ${f.name}]\n; console.error(err); } } else { // other types (text) - try to read as text try { const t = await f.text(); full += '\n' + t; } catch (err) { full += \n[Fájl olvasási hiba: ${f.name}]\n; console.error(err); } } } setText(prev => (prev + '\n' + full).trim()); setStatus('Szöveg kinyerve. Lapozz le és generálj kártyákat!'); }

// very simple heuristic flashcard generator function generateCardsFromText(sourceText, maxCards = 50) { setStatus('Kártyák generálása...'); // split into sentences (naive) const sentences = sourceText .replace(/\n+/g, ' ') // collapse newlines .split(/(?<=[.!?])\s+/) .map(s => s.trim()) .filter(s => s.length > 20);

const generated = [];
for (const s of sentences) {
  if (generated.length >= maxCards) break;
  // pick a keyword: longest word >5 letters and not a stopword
  const words = s.split(/[^\p{L}0-9'-]+/u).filter(Boolean);
  let candidate = '';
  for (const w of words) {
    const wl = w.toLowerCase();
    if (wl.length > candidate.length && wl.length > 5 && !stopwords.has(wl)) candidate = w;
  }
  if (!candidate) continue;
  // create cloze-style question by replacing first occurrence of candidate with ____
  const re = new RegExp(candidate.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
  const question = s.replace(re, '_____');
  const answer = candidate;
  // avoid duplicates
  if (generated.some(c => c.question === question && c.answer === answer)) continue;
  generated.push({ question, answer, source: s });
}
setCards(generated);
setStatus(`Kész — ${generated.length} kártya létrehozva.`);

}

function downloadCSV() { // simple CSV: Front,Back const rows = cards.map(c => "${c.question.replace(/"/g,'""')}","${c.answer.replace(/"/g,'""')}"); const csv = 'Front,Back\n' + rows.join('\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'flashcards.csv'; a.click(); URL.revokeObjectURL(url); }

return ( <div className="max-w-3xl mx-auto p-4"> <h1 className="text-2xl font-bold mb-2">FlashCardGen — PDF / kép → tanulókártyák</h1> <p className="mb-4">Tölts fel PDF-et vagy képet. A prototípus kinyeri a szöveget és egyszerű heuristikával kártyákat készít (cloze / kitöltős). Ha szeretnéd, tudok segíteni AI-alapú, jobb kérdés/felelet generálás beépítésében is.</p>

<div className="mb-4 p-3 border rounded-lg">
    <label className="block mb-2 font-medium">Fájl kiválasztása (több is lehet)</label>
    <input type="file" accept="application/pdf,image/*,text/*" multiple onChange={handleFilesChange} />
    <p className="mt-2 text-sm text-gray-600">Fájlok: {files.map(f => f.name).join(', ') || 'nincs'}</p>
  </div>

  <div className="mb-4 p-3 border rounded-lg">
    <label className="block mb-2 font-medium">Kinyert szöveg (szerkeszthető)</label>
    <textarea value={text} onChange={e => setText(e.target.value)} rows={8} className="w-full p-2 border rounded"></textarea>
    <div className="flex gap-2 mt-2">
      <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => generateCardsFromText(text)}>Kártyák generálása</button>
      <button className="px-3 py-2 bg-gray-200 rounded" onClick={() => { setText(''); setCards([]); setFiles([]); setStatus(''); }}>Törlés</button>
    </div>
  </div>

  <div className="mb-4">
    <h2 className="text-xl font-semibold">Generált kártyák</h2>
    <p className="text-sm text-gray-600 mb-2">{status}</p>
    {cards.length === 0 && <p className="text-sm">Nincs még kártya. Generálj a fenti gombbal.</p>}
    <ul className="space-y-2">
      {cards.map((c, i) => (
        <li key={i} className="p-3 border rounded">
          <div className="font-medium">Q: {c.question}</div>
          <div className="text-gray-700 mt-1">A: {c.answer}</div>
          <details className="mt-1 text-sm text-gray-500"><summary>Forrás mondat</summary><div className="mt-1">{c.source}</div></details>
        </li>
      ))}
    </ul>
    {cards.length > 0 && (
      <div className="mt-3 flex gap-2">
        <button className="px-3 py-2 bg-green-600 text-white rounded" onClick={downloadCSV}>CSV letöltése (Anki importhoz)</button>
      </div>
    )}
  </div>

  <div className="mt-6 p-3 text-sm text-gray-600 border rounded">
    <strong>Javasolt továbbfejlesztések:</strong>
    <ul className="list-disc ml-5">
      <li>AI-alapú Q/A (OpenAI) a pontos, szemléletes kérdésekhez — szerver oldali hívás szükséges.</li>
      <li>Jobb NLP kulcsszó-kiválasztás (POS tagging, Named Entity Recognition).</li>
      <li>Integráció AnkiConnect vagy memrise/quizlet exporttal.</li>
      <li>Mobil PWA csomagolás, offline OCR és gyorsabb PDF-feldolgozás szerveren.</li>
    </ul>
  </div>
</div>

); }

