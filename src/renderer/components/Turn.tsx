import type { Turn as TurnT } from '@shared/types';
import { Block } from './Block';
import { Icon } from './Icon';

interface TurnProps {
  turn: TurnT;
}

export function Turn({ turn }: TurnProps) {
  const isUser = turn.role === 'user';
  return (
    <div className={'turn ' + (isUser ? 'user' : 'assistant')} data-testid={`turn-${turn.id}`}>
      <div className="turn-role">
        <span className={'role-badge ' + (isUser ? 'user' : 'asst')}>
          {isUser ? <Icon name="user" /> : <Icon name="spark" />}
        </span>
        <span className="role-name">
          {isUser ? 'You' : 'Claude'}
          {turn.modelShort && <span className="role-sub">{turn.modelShort}</span>}
        </span>
      </div>
      <div className="turn-body">
        {turn.blocks.map((b, i) => (
          <Block key={i} block={b} />
        ))}
      </div>
    </div>
  );
}
