// Thi thử một passage Reading (route /reading/:id): khung máy thi, vào thẳng, đồng hồ theo bài (mặc định 20 phút).
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDb } from '../db';
import { setLastOpen } from '../store';
import { parseId, saveMode } from '../lib/tests';
import { ExamRunner } from './MockTest';

export default function ReadingTest() {
  const { id } = useParams();
  const db = useDb();
  const m = db.materials[id!];
  useEffect(() => { if (m) { saveMode('reading', 'test'); setLastOpen(m.id, `/reading/${m.id}`, 'test'); } }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m || m.skill !== 'reading') return <div className="page"><p className="empty">Không tìm thấy bài.</p></div>;
  const t = parseId(m.id);
  return <ExamRunner key={m.id} skill="reading" ids={[m.id]} name={m.title} back={t ? `/test/reading/${t.key}` : '/reading'} />;
}
