import { Icon } from './Icon';
import { highlightNodes } from '../lib/highlight';

interface CodeBlockProps {
  lang: string;
  code: string;
}

export function CodeBlock({ lang, code }: CodeBlockProps) {
  return (
    <div className="code-block">
      <div className="code-head">
        <span>{lang}</span>
        <Icon name="copy" style={{ width: 13, height: 13, opacity: 0.6 }} />
      </div>
      <div className="code-body">{highlightNodes(code)}</div>
    </div>
  );
}
