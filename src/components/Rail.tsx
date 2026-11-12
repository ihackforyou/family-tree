import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Tooltip } from '@base-ui/react/tooltip';

type Side = 'left' | 'right' | 'top';

/**
 * Base UI tooltips share one <TooltipProvider> (App): after the first tooltip opens,
 * neighbouring ones open instantly with no animation (`data-instant`), so the rails feel fast.
 */
export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <Tooltip.Provider delay={350} closeDelay={0}>{children}</Tooltip.Provider>
);

/** One-click tool button for the left / right rails and bottom bar, with a quick tooltip. */
export function RailButton({
  label, shortcut, side = 'right', active, danger, className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string; shortcut?: string; side?: Side; active?: boolean; danger?: boolean; children: ReactNode;
}) {
  const cls = ['rail-btn', active && 'on', danger && 'danger', className].filter(Boolean).join(' ');
  return (
    <Tooltip.Root>
      <Tooltip.Trigger type="button" aria-label={label} aria-pressed={active} {...rest} className={cls}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={8} className="tip-pos">
          <Tooltip.Popup className="tip">
            {label}
            {shortcut && <span className="tip-k">{shortcut}</span>}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export const RailDivider = ({ vertical }: { vertical?: boolean }) => <span className={vertical ? 'rail-div-v' : 'rail-div'} />;
