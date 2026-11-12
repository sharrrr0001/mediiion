import type { ReactNode } from 'react';
import { IntlProvider } from '@/components/intl-provider';
import { AuthSplit } from '@/components/shell/auth-split';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <IntlProvider namespaces={["common","nav","auth","login","consent","profile","extra"]}><AuthSplit>{children}</AuthSplit></IntlProvider>;
}
