import { Button } from 'primereact/button';
import type { ButtonProps } from 'primereact/button';

interface PrimaryButtonProps extends ButtonProps {
  label: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export default function PrimaryButton({
  label,
  onClick,
  loading = false,
  disabled = false,
  ...props
}: PrimaryButtonProps) {
  return (
    <Button
      label={label}
      onClick={onClick}
      loading={loading}
      disabled={disabled}
      className="p-button-lg"
      {...props}
    />
  );
}
