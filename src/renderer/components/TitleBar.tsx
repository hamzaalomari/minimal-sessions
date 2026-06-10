import { Icon } from './Icon';

interface TitleBarProps {
  title: string;
  isMac: boolean;
}

export function TitleBar({ title, isMac }: TitleBarProps) {
  // On macOS the native traffic lights are shown by titleBarStyle: 'hiddenInset',
  // so we just leave space for them via .titlebar.mac. No fake dots needed.
  return (
    <div className={'titlebar' + (isMac ? ' mac' : '')}>
      <div className="title-name">
        <Icon name="spark" className="title-spark" />
        {title}
      </div>
    </div>
  );
}
