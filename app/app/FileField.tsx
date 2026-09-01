/** Labeled file input — server component, used inside every upload form. */
export function FileField({
  id,
  name,
  label,
  required,
  accept = "image/*,.pdf",
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  accept?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input className="input" id={id} name={name} type="file" accept={accept} required={required} />
    </div>
  );
}
