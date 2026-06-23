"""
scripts/ingest-pdf-knowledge.py

Chunks and embeds the full KMS PDF into the pdf_knowledge Supabase table.
Skips nothing by default — indexes everything including pages 75-253
(the prose/Quranic explanations there are different from the bare criteria names
already in cia_criteria).

REQUIREMENTS:
  pip install pymupdf requests python-dotenv

RUN:
  python3 scripts/ingest-pdf-knowledge.py --pdf /path/to/FullQCB.pdf

OPTIONS:
  --pdf          <path>   Path to the PDF  [REQUIRED]
  --chunk-words  <n>      Target words per chunk  [default: 300]
  --clear                 Delete all existing rows before ingesting
"""

import argparse
import os
import sys
import time
import json
import re
import requests
import fitz  # pymupdf
from dotenv import load_dotenv

load_dotenv(".env.local")

# ── Config ────────────────────────────────────────────────────────────────────

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
SUPABASE_URL       = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY       = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
EMBEDDING_MODEL    = "openai/text-embedding-3-small"

if not OPENROUTER_API_KEY:
    sys.exit("❌  OPENROUTER_API_KEY missing in .env.local")
if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit("❌  Supabase credentials missing in .env.local")

# ── Section map (from the PDF table of contents) ──────────────────────────────

SECTIONS = [
    (1,   3,   "Daftar Isi"),
    (4,   14,  "Puzzle Kesuksesan"),
    (15,  74,  "Dasar Teori QCB QMB QSB"),
    (75,  141, "Quran Character Building (QCB)"),
    (142, 217, "Quran Mental Building (QMB)"),
    (218, 253, "Quran Soft Skill Building (QSB)"),
    (254, 258, "Cara Menanamkan KMS Quranik"),
    (259, 271, "Simulasi: Berpisah dengan Orangtua"),
    (272, 284, "Simulasi: Tekanan Akademik"),
    (285, 296, "Simulasi: Konflik Sosial"),
    (297, 309, "Simulasi: Perubahan Lingkungan"),
    (310, 321, "Simulasi: Kegagalan atau Penolakan"),
    (322, 333, "Simulasi: Situasi Tidak Terduga"),
    (334, 344, "Simulasi: Tekanan Moral atau Etika"),
    (345, 356, "Simulasi: Medsos dan Perbandingan Diri"),
    (357, 368, "Simulasi: Pengambilan Keputusan"),
    (369, 380, "Simulasi: Kehilangan atau Duka"),
    (381, 392, "Simulasi: Tantangan Identitas Diri"),
    (393, 403, "Simulasi: Kompetisi dan Persaingan"),
    (404, 419, "Simulasi: Kritik atau Teguran"),
    (420, 436, "Simulasi: Penolakan"),
    (437, 454, "Simulasi: Permintaan Bantuan"),
    (455, 474, "Simulasi: Tidak Adil atau Diskriminatif"),
    (475, 493, "Simulasi: Situasi Menyebalkan"),
    (494, 512, "Simulasi: Dominan atau Terlalu Mengatur"),
    (513, 528, "Simulasi: Pasif atau Tidak Kooperatif"),
    (529, 542, "Simulasi: Meremehkan atau Merendahkan"),
    (543, 558, "Simulasi: Emosional atau Marah"),
    (559, 570, "Simulasi: Manipulatif atau Memperalat"),
    (571, 587, "Simulasi: Tidak Konsisten"),
    (588, 596, "Simulasi: Kompetitif Berlebihan"),
    (597, 597, "Catatan Penutup"),
]

def get_section(page_number: int) -> str:
    for start, end, name in SECTIONS:
        if start <= page_number <= end:
            return name
    return f"Halaman {page_number}"

# ── PDF extraction ─────────────────────────────────────────────────────────────

def extract_pages(pdf_path: str) -> list[dict]:
    doc = fitz.open(pdf_path)
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text("text").replace("\n", " ").strip()
        text = re.sub(r"\s+", " ", text)
        pages.append({"page": i + 1, "text": text})
    print(f"    Extracted {len(pages)} pages from PDF")
    return pages

# ── Chunking ───────────────────────────────────────────────────────────────────

def chunk_pages(pages: list[dict], chunk_words: int) -> list[dict]:
    # Group pages by section
    groups: dict[str, list[dict]] = {}
    order: list[str] = []

    for p in pages:
        section = get_section(p["page"])
        if section not in groups:
            groups[section] = []
            order.append(section)
        groups[section].append(p)

    chunks = []
    for section in order:
        group = groups[section]
        full_text = " ".join(p["text"] for p in group)
        full_text = re.sub(r"\s+", " ", full_text).strip()
        if not full_text:
            continue

        words = full_text.split()
        start = 0
        while start < len(words):
            end = min(start + chunk_words, len(words))
            chunk_text = " ".join(words[start:end]).strip()

            if len(chunk_text) > 80:  # skip near-empty chunks
                chunks.append({
                    "content": f"[{section}]\n{chunk_text}",
                    "section": section,
                    "page_start": group[0]["page"],
                    "page_end": group[-1]["page"],
                })
            start = end

    return chunks

# ── Embedding ──────────────────────────────────────────────────────────────────

def embed_text(text: str) -> list[float]:
    response = requests.post(
        "https://openrouter.ai/api/v1/embeddings",
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        },
        json={"model": EMBEDDING_MODEL, "input": text},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["data"][0]["embedding"]

# ── Supabase helpers ───────────────────────────────────────────────────────────

def supabase_delete_all():
    response = requests.delete(
        f"{SUPABASE_URL}/rest/v1/pdf_knowledge?id=gt.0",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        },
        timeout=15,
    )
    response.raise_for_status()

def supabase_insert(row: dict):
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/pdf_knowledge",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=row,
        timeout=30,
    )
    response.raise_for_status()

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True, help="Path to the full PDF")
    parser.add_argument("--chunk-words", type=int, default=300)
    parser.add_argument("--clear", action="store_true")
    args = parser.parse_args()

    print(f"\n📖  Reading PDF: {args.pdf}")
    pages = extract_pages(args.pdf)
    chunks = chunk_pages(pages, args.chunk_words)
    print(f"    Chunks created: {len(chunks)} (~{args.chunk_words} words each)\n")

    if args.clear:
        print("🗑️   --clear flag set. Deleting existing rows...")
        supabase_delete_all()
        print("    ✓ Table cleared\n")

    success = 0
    failed = 0

    for i, chunk in enumerate(chunks):
        label = f"[{i+1}/{len(chunks)}]"
        try:
            embedding = embed_text(chunk["content"])
            supabase_insert({
                "content":    chunk["content"],
                "section":    chunk["section"],
                "page_start": chunk["page_start"],
                "page_end":   chunk["page_end"],
                "embedding":  embedding,
            })
            print(f"  {label} ✓  {chunk['section']} (p.{chunk['page_start']}–{chunk['page_end']})")
            success += 1
        except Exception as e:
            print(f"  {label} ✗  {chunk['section']}: {e}")
            failed += 1

        time.sleep(0.12)  # avoid rate limits

    print(f"\n✅  Done! {success} chunks ingested, {failed} failed.")
    if failed:
        print("    Re-run with --clear to retry from scratch.")

if __name__ == "__main__":
    main()
