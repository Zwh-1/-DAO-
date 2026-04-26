'use client';

import { RoleGuard } from '@/components/auth';
import { TreasuryView } from '@/features/workbench/dao';

export default function GovernanceTreasuryPage() {
  return (
    <RoleGuard required="dao">
      <div className="mx-auto max-w-5xl p-4">
        <TreasuryView />
      </div>
    </RoleGuard>
  );
}
