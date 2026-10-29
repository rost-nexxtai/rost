import { QuizFlow } from '@/components/quiz/QuizFlow';

import { getProfile } from '@/data';
import { copy } from '@/i18n/lang';
import { getLang } from '@/i18n/server';

const TITLE = copy('Hai să ne cunoaștem · Rost', "Let's get to know you · Rost");

export async function generateMetadata() {
  return { title: TITLE[await getLang()] };
}

/**
 * `/quiz?retake=1` comes from Profil and keeps your progress; plain `/quiz` is a new user, unless this
 * browser's account has no profile yet. With the backend down we can't tell, so it counts as someone's.
 */
export default async function QuizPage({ searchParams }: { searchParams: Promise<{ retake?: string }> }) {
  const hasProfile = await getProfile().then(Boolean, () => true);
  return <QuizFlow retake={(await searchParams).retake === '1'} hasProfile={hasProfile} />;
}
