import Icon from "@/components/Icon";
import { cn } from "@/utils/style";

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
};

/** 검색창. 높이 40, 모서리 8 */
export default function SearchField({ value, onChange, placeholder, className, label = "검색" }: SearchFieldProps) {
  return (
    <label className={cn("flex h-10 items-center gap-2 rounded-lg bg-white/4 px-3 text-dt-text-3 shadow-[inset_0_0_0_1px_#ffffff14]", className)}>
      <Icon icon="Search" className="size-4 shrink-0" />
      <input
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[12px] text-dt-text outline-none placeholder:text-dt-text-3"
      />
    </label>
  );
}
