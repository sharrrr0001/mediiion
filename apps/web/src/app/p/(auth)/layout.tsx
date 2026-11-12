import type { ReactNode } from 'react';
import { AuthSplit } from '@/components/shell/auth-split';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthSplit>{children}</AuthSplit>;
}
