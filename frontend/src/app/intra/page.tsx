import { LoginForm } from '@/components/account/LoginForm';
import { LangSwitch } from '@/components/ui/LangSwitch';

export const dynamic = 'force-dynamic';

/** "Am deja cont": open a saved account on this device. */
export default function Intra() {
  return (
    <main className="shell shell-bare">
      <header className="topbar">
        <span className="wordmark">
          rost<span>.</span>
        </span>
        <LangSwitch />
      </header>
      <LoginForm />
    </main>
  );
}
