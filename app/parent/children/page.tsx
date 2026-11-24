/** Parent dashboard — linked children and a form to add another with a pairing code. */
import { StudentAvatar } from "@/components/StudentAvatar";
import { AddChildForm } from "@/components/parent/ParentClient";
import { Card, ParentShell } from "@/components/parent/ParentShell";
import { loadParentPage } from "@/lib/parent-page";

export default async function ParentChildren({ searchParams }: { searchParams?: Promise<{ child?: string }> }) {
  const { session, selected } = await loadParentPage("children", searchParams);

  const body = (
    <>
      {session.children.map((c) => (
        <Card key={c.id} className="flex items-center gap-3">
          <StudentAvatar name={c.name} photoUrl={c.photoUrl} size="md" colorIndex={0} />
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate">{c.name}</p>
            <p className="text-xs text-slate-500 truncate">{c.organizationName}</p>
          </div>
        </Card>
      ))}
      <Card>
        <h2 className="font-bold text-slate-900">Tambah anak</h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">
          Masukkan kode santri dari sekolah. Satu akun dapat menampung beberapa anak.
        </p>
        <AddChildForm />
      </Card>
    </>
  );

  return <ParentShell parentId={session.userId} parentName={session.name} children={session.children} selected={selected} tab="children" body={body} />;
}
