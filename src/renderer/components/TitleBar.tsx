import { Icon } from './Icon';

interface TitleBarProps {
  title: string;
  isMac: boolean;
}

export function TitleBar({ title, isMac }: TitleBarProps) {
  return (
    <div className="titlebar">
      {isMac && (
        <div className="traffic">
          <span className="tdot r" />
          <span className="tdot y" />
          <span className="tdot g" />
        </div>
      )}
      <div className="title-name">
        <Icon name="spark" className="title-spark" />
        {title}
      </div>
    </div>
  );
}
