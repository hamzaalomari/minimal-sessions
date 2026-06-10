import { useState } from 'react';
import type { Session } from '@shared/types';
import { Modal } from './Modal';

interface EditInstructionsModalProps {
  session: Session;
  onClose(): void;
  onSave(prompt: string): void;
}

export function EditInstructionsModal({
  session,
  onClose,
  onSave,
}: EditInstructionsModalProps) {
  const [prompt, setPrompt] = useState(session.systemPrompt);

  const save = () => {
    onSave(prompt.trim());
  };

  return (
    <Modal
      title="Edit instructions"
      description={`System prompt for ${session.name}. Sent on every turn.`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            data-testid="edit-instructions-save"
          >
            Save
          </button>
        </>
      }
    >
      <label className="ns-label" htmlFor="edit-instructions">
        System prompt
      </label>
      <textarea
        id="edit-instructions"
        className="ns-input edit-instructions-ta"
        autoFocus
        rows={10}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="You are a careful coding assistant…"
      />
    </Modal>
  );
}
