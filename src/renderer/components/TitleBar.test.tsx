import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TitleBar } from './TitleBar';

describe('<TitleBar />', () => {
  it('shows the passed-in title', () => {
    render(<TitleBar title="My session" isMac />);
    expect(screen.getByText('My session')).toBeInTheDocument();
  });

  it('adds the mac modifier class on macOS so native traffic lights get clearance', () => {
    const { container } = render(<TitleBar title="x" isMac />);
    expect(container.querySelector('.titlebar')).toHaveClass('mac');
  });

  it('omits the mac modifier on non-mac platforms', () => {
    const { container } = render(<TitleBar title="x" isMac={false} />);
    expect(container.querySelector('.titlebar')).not.toHaveClass('mac');
  });
});
