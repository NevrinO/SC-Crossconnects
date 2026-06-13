interface CalculateButtonProps {
  disabled: boolean;
  onClick: () => void;
}

export default function CalculateButton({ disabled, onClick }: CalculateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors ${
        disabled
          ? 'cursor-not-allowed bg-gray-400'
          : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
      }`}
    >
      Get Length
    </button>
  );
}
