import { memo, useMemo } from 'react';
import { Icon } from './Icon';
import { highlightNodes } from '../lib/highlight';

interface CodeBlockProps {
  lang: string;
  code: string;
}

// Memoized so identical (lang, code) doesn't re-run hljs on every parent
// re-render (e.g. when the user types into the composer and SessionPane
// re-renders the transcript subtree).
export const CodeBlock = memo(function CodeBlock({ lang, code }: CodeBlockProps) {
  const nodes = useMemo(() => highlightNodes(code, lang), [code, lang]);
  return (
    <div className="code-block">
      <div className="code-head">
        <span>{lang}</span>
        <Icon name="copy" style={{ width: 13, height: 13, opacity: 0.6 }} />
      </div>
      <div className="code-body">{nodes}</div>
    </div>
  );
});
