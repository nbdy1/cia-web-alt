/** Consent to use of the child's data. Asked again whenever PARENT_CONSENT_VERSION changes. */
import { redirect } from "next/navigation";
import { ConsentForm } from "@/components/parent/ParentClient";
import { Card } from "@/components/parent/ParentShell";
import { getParentSession, hasParentConsent } from "@/lib/parent-server";

export default async function ConsentPage() {
  const session = await getParentSession();
  if (!session) redirect("/");
  if (await hasParentConsent(session.userId)) redirect("/parent");
  return (
    <div className="min-h-screen bg-paper p-5 pt-12 font-sans space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Persetujuan penggunaan data anak</h1>
      <Card className="space-y-3 text-sm text-slate-700 leading-relaxed">
        <p>Untuk menampilkan perkembangan anak Anda, sekolah memakai data pengamatan karakter yang dicatat musyrif.</p>
        <ul className="space-y-2 list-disc pl-5">
          <li>Anda hanya melihat <b>anak Anda sendiri</b>, berupa ringkasan yang sudah ditinjau dan disetujui musyrif, bukan catatan mentah.</li>
          <li>Ringkasan ditulis dengan bantuan AI sebagai draf, lalu dibaca dan disetujui musyrif sebelum sampai kepada Anda.</li>
          <li>Hal yang sensitif disampaikan musyrif langsung kepada Anda, tidak lewat aplikasi.</li>
          <li>Setiap akses ke data anak Anda dicatat. Informasi yang Anda isi di &quot;Profil dari rumah&quot; dapat dibaca musyrif.</li>
          <li>Anda dapat meminta sekolah menghapus akun atau menghentikan akses kapan saja.</li>
        </ul>
      </Card>
      <ConsentForm />
    </div>
  );
}
