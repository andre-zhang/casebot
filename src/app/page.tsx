import { CaseCoachChat } from "@/components/CaseCoachChat";
import { pageShellClass } from "@/lib/ui-classes";

export default function Home() {
  return (
    <main className={pageShellClass}>
      <CaseCoachChat />
    </main>
  );
}
