'use client';

import React from 'react';

const DONE = '#2D8A39';

type StepId = 'wallet' | 'sync' | 'prove' | 'done';

type UiStep = {
  id: StepId;
  label: string;
};

const STEPS: UiStep[] = [
  { id: 'wallet', label: '连接钱包' },
  { id: 'sync', label: '同步资格' },
  { id: 'prove', label: '生成证明' },
  { id: 'done', label: '提交结果' },
];

type Props = {
  isConnected: boolean;
  merkleSynced: boolean;
  advancedOpen: boolean;
  formStep: 'config' | 'generating' | 'success' | 'error';
};

function currentStepIndex(p: Props): number {
  const { isConnected, merkleSynced, advancedOpen, formStep } = p;
  if (formStep === 'success') return 3;
  if (formStep === 'generating') return 2;
  if (formStep === 'error') return 2;
  if (!isConnected) return 0;
  if (!merkleSynced && !advancedOpen) return 1;
  if (advancedOpen && !merkleSynced) return 1;
  return 2;
}

export function ClaimStepIndicator(props: Props) {
  const active = currentStepIndex(props);

  return (
    <div className="w-full">
      <div className="text-xs font-medium mb-2 text-slate-500">
        领取步骤
      </div>
      <ol className="flex flex-wrap gap-2 sm:gap-0 sm:justify-between">
        {STEPS.map((s, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li
              key={s.id}
              className="flex items-center gap-2 text-xs sm:flex-1 sm:min-w-0"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  done ? 'bg-success text-white' : current ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={`font-medium truncate max-w-[7rem] sm:max-w-none ${
                  current ? 'text-primary' : 'text-slate-500'
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <span className="hidden sm:inline flex-1 border-t border-dashed mx-1 min-w-[8px] border-slate-300" />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
