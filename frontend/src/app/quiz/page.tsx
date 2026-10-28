import { QuizFlow } from '@/components/quiz/QuizFlow';

import { copy } from '@/i18n/lang';
import { getLang } from '@/i18n/server';

const TITLE = copy('Hai să ne cunoaștem · Rost', "Let's get to know you · Rost");

export async function generateMetadata() {
  return { title: TITLE[await getLang()] };
}

export default function QuizPage() {
  return <QuizFlow />;
}
