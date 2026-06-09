import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';

describe('Icon', () => {
  it('renders an svg with a single path for a known single-stroke icon', () => {
    const { container } = render(<Icon name="spark" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg?.getAttribute('stroke-width')).toBe('1.8');
    expect(container.querySelectorAll('path')).toHaveLength(1);
  });

  it('renders multiple paths for icons defined with the "|" group separator', () => {
    const { container } = render(<Icon name="sun" />);
    // sun is "<circle>|<rays>" — two groups
    expect(container.querySelectorAll('path').length).toBeGreaterThan(1);
  });

  it('returns null for unknown icon names', () => {
    const { container } = render(<Icon name="nope-not-real" />);
    expect(container.firstChild).toBeNull();
  });

  it('forwards size and className', () => {
    const { container } = render(<Icon name="spark" size={32} className="my-icon" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
    expect(svg).toHaveClass('my-icon');
  });
});
