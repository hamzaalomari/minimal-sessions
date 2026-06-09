import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TitleBar } from './TitleBar';

describe('<TitleBar />', () => {
  it('shows the passed-in title', () => {
    render(<TitleBar title="My session" isMac />);
    expect(screen.getByText('My session')).toBeInTheDocument();
  });

  it('renders traffic light dots when isMac is true', () => {
    const { container } = render(<TitleBar title="x" isMac />);
    expect(container.querySelector('.traffic')).toBeInTheDocument();
    expect(container.querySelectorAll('.tdot')).toHaveLength(3);
  });

  it('omits traffic lights when isMac is false', () => {
    const { container } = render(<TitleBar title="x" isMac={false} />);
    expect(container.querySelector('.traffic')).not.toBeInTheDocument();
  });
});
