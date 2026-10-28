import { MomentPlayer } from '@/components/moments/MomentPlayer';

export default async function MomentPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return (
    <main className="shell">
      <MomentPlayer runId={runId} />
    </main>
  );
}
