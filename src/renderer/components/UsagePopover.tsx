import { useRef } from 'react';
import type { Session } from '@shared/types';
import {
  costFor,
  formatTokens,
  formatUSD,
  pricingFor,
  totalTokens,
} from '@shared/pricing';
import { usePopoverClose } from '../lib/usePopoverClose';
import { anchorStyle, type Anchor } from './ContextMenu';

interface UsagePopoverProps {
  anchor: Anchor;
  session: Session;
  onClose(): void;
  triggerEl?: HTMLElement | null;
}

interface Row {
  label: string;
  tokens: number;
  cost: number;
  /** Visual hint shown next to the label (e.g. "cached"). */
  note?: string;
}

export function UsagePopover({ anchor, session, onClose, triggerEl }: UsagePopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  usePopoverClose(ref, onClose, { triggerEl });

  const pricing = pricingFor(session.model);
  const cost = costFor(session.usage, session.model);
  const total = totalTokens(session.usage);

  const rows: Row[] = [
    { label: 'Input', tokens: session.usage.input, cost: cost.input },
    { label: 'Output', tokens: session.usage.output, cost: cost.output },
    {
      label: 'Cache write',
      tokens: session.usage.cacheCreation,
      cost: cost.cacheCreation,
      note: '1.25× input',
    },
    {
      label: 'Cache read',
      tokens: session.usage.cacheRead,
      cost: cost.cacheRead,
      note: '0.1× input',
    },
  ];

  return (
    <div
      ref={ref}
      className="usage-pop"
      role="dialog"
      aria-label="Token usage"
      style={anchorStyle(anchor)}
      data-testid="usage-popover"
    >
      <div className="usage-hd">
        <div className="usage-title">Token usage</div>
        <div className="usage-sub">
          {pricing.label} · ${pricing.inputPerMTok}/${pricing.outputPerMTok} per 1M
        </div>
      </div>
      <table className="usage-tbl">
        <thead>
          <tr>
            <th>Category</th>
            <th className="num">Tokens</th>
            <th className="num">Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>
                <span>{r.label}</span>
                {r.note && <span className="usage-note">{r.note}</span>}
              </td>
              <td className="num">{formatTokens(r.tokens)}</td>
              <td className="num">{formatUSD(r.cost)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="num">{formatTokens(total)}</td>
            <td className="num">{formatUSD(cost.total)}</td>
          </tr>
        </tfoot>
      </table>
      <div className="usage-foot">
        Estimate — rates may change. Cache pricing is approximate.
      </div>
    </div>
  );
}
