'use client';

import { useFormStatus } from 'react-dom';

// A submit button that shows it is working while its form is sent.
export default function Submit({ className, pending, children, name, value, formAction }: { className?: string; pending?: React.ReactNode; children: React.ReactNode; name?: string; value?: string; formAction?: (f: FormData) => void }) {
  const status = useFormStatus();
  return (
    <button type="submit" className={className} disabled={status.pending} name={name} value={value} formAction={formAction}>
      {status.pending && pending ? pending : children}
    </button>
  );
}
