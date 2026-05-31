import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import './ui.css';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string | null;
  hint?: ReactNode;
  /** Visual state for the hint line (e.g. username availability). */
  hintState?: 'neutral' | 'ok' | 'bad';
  /** Render a password reveal toggle. */
  password?: boolean;
  /** Show a "current/maxLength" character counter (requires maxLength). */
  showCount?: boolean;
}

export default function TextField({
  label,
  error,
  hint,
  hintState = 'neutral',
  password = false,
  showCount = false,
  id,
  className = '',
  type = 'text',
  ...rest
}: TextFieldProps) {
  const [reveal, setReveal] = useState(false);
  const inputType = password ? (reveal ? 'text' : 'password') : type;

  const max = typeof rest.maxLength === 'number' ? rest.maxLength : undefined;
  const count = String(rest.value ?? '').length;
  const showCounter = showCount && max !== undefined;

  return (
    <div className={`sx-field ${className}`.trim()}>
      {(label || showCounter) && (
        <div className="sx-field__labelrow">
          {label ? (
            <label className="sx-field__label" htmlFor={id}>
              {label}
            </label>
          ) : (
            <span />
          )}
          {showCounter && (
            <span className={`sx-field__count ${count >= (max as number) ? 'is-max' : ''}`.trim()}>
              {count}/{max}
            </span>
          )}
        </div>
      )}
      <div className={`sx-field__control ${error ? 'is-invalid' : ''}`.trim()}>
        <input id={id} className="sx-field__input" type={inputType} {...rest} />
        {password && (
          <button
            type="button"
            className="sx-field__adornment"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
          >
            <i className={reveal ? 'pi pi-eye-slash' : 'pi pi-eye'} />
          </button>
        )}
      </div>
      {error ? (
        <small className="sx-field__error">{error}</small>
      ) : (
        hint && (
          <small
            className={`sx-field__hint ${
              hintState === 'ok' ? 'is-ok' : hintState === 'bad' ? 'is-bad' : ''
            }`.trim()}
          >
            {hint}
          </small>
        )
      )}
    </div>
  );
}
