export default function Button({ 
  children, 
  onClick, 
  type = "button", 
  className = "", 
  disabled = false,
  variant = "primary" // primary, secondary, or icon
}) {
  const baseStyles = "font-semibold px-4 py-2 rounded-lg shadow-sm transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantStyles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300",
    icon: "!p-2 hover:bg-gray-100 rounded-full text-gray-600"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}