interface DiffViewProps {
  text: string;
}

type LineKind = 'add' | 'del' | 'ctx';

export function DiffView({ text }: DiffViewProps) {
  const lines = text.replace(/\n$/, '').split('\n');
  return (
    <div className="diff">
      {lines.map((ln, i) => {
        const c = ln[0];
        const kind: LineKind = c === '+' ? 'add' : c === '-' ? 'del' : 'ctx';
        const body = c === '+' || c === '-' || c === ' ' ? ln.slice(1) : ln;
        return (
          <div key={i} className={`diff-line ${kind}`}>
            <span className="diff-gutter">{kind === 'add' ? '+' : kind === 'del' ? '−' : ''}</span>
            <span className="diff-text">{body || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}
