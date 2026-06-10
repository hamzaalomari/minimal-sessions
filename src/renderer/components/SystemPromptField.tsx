interface SystemPromptFieldProps {
  value: string;
  onChange(value: string): void;
  placeholder?: string;
}

export function SystemPromptField({
  value,
  onChange,
  placeholder = 'Optional. Instructions Claude should follow for this session…',
}: SystemPromptFieldProps) {
  return (
    <div className="ns-field">
      <label className="ns-label" htmlFor="ns-system-prompt">
        System prompt
      </label>
      <textarea
        id="ns-system-prompt"
        className="ns-input ns-textarea"
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="ns-hint">
        {value.length === 0 ? 'Optional' : `${value.length} characters`}
      </div>
    </div>
  );
}
