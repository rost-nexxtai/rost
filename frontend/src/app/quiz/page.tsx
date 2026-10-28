import { QuizFlow } from '@/components/quiz/QuizFlow';

import { copy } from '@/i18n/lang';
import { getLang } from '@/i18n/server';

const TITLE = copy('Hai să ne cunoaștem · Rost', "Let's get to know you · Rost");

export async function generateMetadata() {
  return { title: TITLE[await getLang()] };
}

/** `/quiz?retake=1` comes from Profil and keeps your progress; plain `/quiz` is a new user. */
export default async function QuizPage({ searchParams }: { searchParams: Promise<{ retake?: string }> }) {
  return <QuizFlow retake={(await searchParams).retake === '1'} />;
}
