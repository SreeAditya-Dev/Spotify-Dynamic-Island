"use client";

import { useState } from 'react';
import { Toggle, GooeyFilter } from '@/components/ui/liquid-toggle';

function ToggleWithState({ variant }: { variant: 'default' | 'success' | 'warning' | 'danger' }) {
  const [checked, setChecked] = useState(false);
  return (
    <Toggle 
      variant={variant}
      checked={checked}
      onCheckedChange={setChecked}
    />
  );
}

export function DefaultToggleDemo() {
  return (
    <div className="relative">
      <GooeyFilter />
      <ToggleWithState variant="default" />
    </div>
  );
}

export function SuccessToggleDemo() {
  return (
    <div className="relative">
      <GooeyFilter />
      <ToggleWithState variant="success" />
    </div>
  );
}

export function WarningToggleDemo() {
  return (
    <div className="relative">
      <GooeyFilter />
      <ToggleWithState variant="warning" />
    </div>
  );
}

export function DangerToggleDemo() {
  return (
    <div className="relative">
      <GooeyFilter />
      <ToggleWithState variant="danger" />
    </div>
  );
}
