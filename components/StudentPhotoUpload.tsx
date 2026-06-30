/**
 * components/StudentPhotoUpload.tsx
 *
 * Client component used on the student detail page (students/[id]).
 * Renders the student's avatar (photo or initial) with a camera-icon overlay
 * button. Tapping the button opens a file picker; the selected image is
 * uploaded to the Supabase Storage bucket "student-photos" and the
 * photo_url column on the students table is updated.
 *
 * Prerequisites (run once in Supabase):
 *   1. Create a public Storage bucket named  student-photos
 *   2. ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url text;
 *      (see scripts/add_photo_url.sql)
 */
"use client";

import React, { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { StudentAvatar } from "@/components/StudentAvatar";

interface StudentPhotoUploadProps {
  studentId: string;
  studentName: string;
  initialPhotoUrl?: string | null;
  colorIndex?: number;
}

export function StudentPhotoUpload({
  studentId,
  studentName,
  initialPhotoUrl,
  colorIndex = 0,
}: StudentPhotoUploadProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type & size (max 5 MB)
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5 MB.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${studentId}.${ext}`;

      // Upload (upsert) to the student-photos bucket
      const { error: uploadError } = await supabase.storage
        .from("student-photos")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from("student-photos")
        .getPublicUrl(path);

      const publicUrl = urlData.publicUrl;

      // Persist on the students row
      const { error: dbError } = await supabase
        .from("students")
        .update({ photo_url: publicUrl })
        .eq("id", studentId);

      if (dbError) throw dbError;

      // Add cache-busting so the browser re-fetches the new image
      setPhotoUrl(`${publicUrl}?t=${Date.now()}`);
    } catch (err: any) {
      setError(err.message ?? "Gagal mengunggah foto.");
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="relative flex-shrink-0">
      {/* Avatar — xl size to match the existing header layout */}
      <StudentAvatar
        name={studentName}
        photoUrl={photoUrl}
        size="xl"
        colorIndex={colorIndex}
        style={{ boxShadow: "0 5px 0 0 #15803d" }}
      />

      {/* Camera button overlay */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="absolute -bottom-1 -right-1 w-8 h-8 bg-white border-2 border-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:border-emerald-300 active:translate-y-px transition-all disabled:opacity-60"
        style={{ boxShadow: "0 2px 0 0 #e2e8f0" }}
        title="Ganti foto santri"
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
        ) : (
          <Camera className="w-4 h-4" />
        )}
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Error toast */}
      {error && (
        <div className="absolute top-full left-0 mt-2 z-10 bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-black px-3 py-2 rounded-xl whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
}
