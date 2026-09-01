/**
 * The signed-in chrome: dark rail, nav, account menu.
 *
 * Applied per section rather than in the root layout, because sign-in, sign-up
 * and onboarding must NOT have it — a nav pointing at pages you can't reach yet
 * is worse than no nav.
 */
import AppShell from "@/components/AppShell";

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
