interface ToggleProps {
  on: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}

export default function Toggle({ on, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        width: '64px',
        height: '32px',
        borderRadius: '999px',
        backgroundColor: on ? '#E8820C' : '#E5E7EB',
        padding: '3px',
        border: '2px solid rgba(255,255,255,0.45)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 0.2s',
        flexShrink: 0,
        boxSizing: 'border-box',
        justifyContent: on ? 'flex-end' : 'flex-start',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          display: 'block',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          flexShrink: 0,
        }}
      />
    </button>
  )
}
