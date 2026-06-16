import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Accessibility caller contract (E7-S2 / REQ-056): a `Textarea` has no built-in
 * label. The caller MUST associate an accessible name — either a `<label htmlFor>`
 * matching the textarea `id`, or an `aria-label` (next-intl key, never a hardcoded
 * string). When the textarea can show a validation error, pass `aria-invalid` and
 * `aria-describedby` pointing at the error element. See docs/16 + docs/13 Accessibility.
 */
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
