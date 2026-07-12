/**
 * components/StudentPhotoUpload.tsx
 *
 * Avatar with a camera-button overlay for uploading / changing a student's photo.
 * Used in the admin dashboard (Kelola Santri list and Add-modal).
 *
 * Uploads to the Supabase Storage bucket "student-photos" and writes the public
 * URL back to students.photo_url.
 *
 * Prerequisites (run once in Supabase — see scripts/add_photo_url.sql):
 *   1. Create a public Storage bucket named  student-photos
 *   2. ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url text;
 */
"use client";

import React, { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { StudentAvatar } from "@/components/StudentAvatar";
import { useTerminology } from "@/lib/hooks/use-terminology";

type AvatarSize = "sm" | "md" | "lg" | "xl";

// Camera button dimensions keyed by avatar size
const CAM_BTN: Record<AvatarSize, { wh: string; icon: number; offset: string }> = {
  sm: { wh: "w-5 h-5", icon: 10, offset: "-bottom-0.5 -right-0.5" },
  md: { wh: "w-6 h-6", icon: 11, offset: "-bottom-1 -right-1" },
  lg: { wh: "w-7 h-7", icon: 12, offset: "-bottom-1 -right-1" },
  xl: { wh: "w-8 h-8", icon: 14, offset: "-bottom-1 -right-1" },
};

interface StudentPhotoUploadProps {
  studentId: string;
  studentName: string;
  initialPhotoUrl?: string | null;
  colorIndex?: number;
  size?: AvatarSize;
  avatarStyle?: React.CSSProperties;
  /** Called after a successful upload so the parent can refresh its state */
  onUploaded?: (newUrl: string) => void;
}

export function StudentPhotoUpload({
  studentId,
  studentName,
  initialPhotoUrl,
  colorIndex = 0,
  size = "xl",
  avatarStyle,
  onUploaded,
}: StudentPhotoUploadProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const btn = CAM_BTN[size];
  const t = useTerminology();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) { setError("File harus berupa gambar."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Ukuran file maksimal 5 MB."); return; }

    setUploading(true);
    setError(null);

    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${studentId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("student-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("student-photos").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { error: dbError } = await supabase
        .from("students")
        .update({ photo_url: publicUrl })
        .eq("id", studentId);
      if (dbError) throw dbError;

      const busted = `${publicUrl}?t=${Date.now()}`;
      setPhotoUrl(busted);
      onUploaded?.(busted);
    } catch (err: any) {
      setError(err.message ?? "Gagal mengunggah foto.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="relative flex-shrink-0">
      <StudentAvatar
        name={studentName}
        photoUrl={photoUrl}
        size={size}
        colorIndex={colorIndex}
        style={avatarStyle}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className={`absolute ${btn.offset} ${btn.wh} bg-white border-2 border-slate-200 rounded-lg flex items-center justify-center text-slate-500 hover:text-brand-600 hover:border-brand-300 active:translate-y-px transition-all disabled:opacity-60`}
        style={{ boxShadow: "0 2px 0 0 #e2e8f0" }}
        title={`Ganti foto ${t.santriLower}`}
      >
        {uploading
          ? <Loader2 className="animate-spin text-brand-500" style={{ width: btn.icon, height: btn.icon }} />
          : <Camera style={{ width: btn.icon, height: btn.icon }} />}
      </button>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {error && (
        <div className="absolute top-full left-0 mt-2 z-20 bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-black px-3 py-2 rounded-xl whitespace-nowrap shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
