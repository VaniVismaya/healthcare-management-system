import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

export default function MultiSelectDropdown({
  label,
  required = false,
  options = [],
  value = [],
  onChange,
  placeholder = 'Select options',
  helper,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selectedOptions = useMemo(
    () => options.filter((option) => value.some((item) => String(item) === String(option.id))),
    [options, value]
  );

  useEffect(() => {
    const handleOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const toggleOption = (optionId) => {
    if (disabled) return;
    const exists = value.some((item) => String(item) === String(optionId));
    const next = exists
      ? value.filter((item) => String(item) !== String(optionId))
      : [...value, optionId];
    onChange(next);
  };

  const removeOption = (optionId, event) => {
    event.stopPropagation();
    onChange(value.filter((item) => String(item) !== String(optionId)));
  };

  return (
    <div className="form-group" ref={rootRef}>
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      <div className={`multi-select ${open ? 'open' : ''} ${disabled ? 'disabled' : ''}`}>
        <button
          type="button"
          className="multi-select-trigger"
          onClick={() => !disabled && setOpen((prev) => !prev)}
          disabled={disabled}
        >
          <div className="multi-select-value">
            {selectedOptions.length === 0 ? (
              <span className="multi-select-placeholder">{placeholder}</span>
            ) : (
              selectedOptions.map((option) => (
                <span key={option.id} className="multi-select-chip">
                  {option.name}
                  <span className="multi-select-chip-remove" onClick={(event) => removeOption(option.id, event)}>
                    <X size={12} />
                  </span>
                </span>
              ))
            )}
          </div>
          <ChevronDown size={16} className="multi-select-caret" />
        </button>
        {open && !disabled && (
          <div className="multi-select-menu">
            {options.map((option) => {
              const selected = value.some((item) => String(item) === String(option.id));
              return (
                <button
                  type="button"
                  key={option.id}
                  className={`multi-select-option ${selected ? 'selected' : ''}`}
                  onClick={() => toggleOption(option.id)}
                >
                  <span>{option.name}</span>
                  {selected && <Check size={15} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {helper && <div className="form-hint">{helper}</div>}
    </div>
  );
}
