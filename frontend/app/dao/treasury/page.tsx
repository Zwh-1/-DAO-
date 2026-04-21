'use client';

import { RoleGuard } from '@/features/governance';
import { TreasuryView } from '@/features/workbench/dao';

export default function DAOTreasuryPage() {
  return (
    <RoleGuard required="dao">
      <div className="mx-auto max-w-5xl p-4">
        <TreasuryView />
      </div>
    </RoleGuard>
  );
}
