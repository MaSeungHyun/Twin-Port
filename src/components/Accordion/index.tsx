/* eslint-disable react-refresh/only-export-components -- 네임스페이스 compound 컴포넌트 */
import Icon from "@/components/Icon";
import { cn } from "@/utils/style";
import { Accordion as AccordionPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

function Root({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Root>) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  );
}

function Item({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b border-white/10 last:border-b-0", className)}
      {...props}
    />
  );
}

function Header({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Header>) {
  return (
    <AccordionPrimitive.Header
      data-slot="accordion-header"
      className={cn("flex", className)}
      {...props}
    />
  );
}

function Trigger({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group flex flex-1 cursor-pointer items-center justify-between gap-2 py-3 text-left text-sm font-medium text-white outline-none transition-colors",
          "hover:text-white/90 focus-visible:ring-2 focus-visible:ring-primary/40",
          "disabled:cursor-not-allowed disabled:opacity-40",
          className,
        )}
        {...props}
      >
        {children}
        <Icon
          icon="ChevronDown"
          className="size-4 shrink-0 stroke-white/60 transition-transform duration-200 group-data-[state=open]:rotate-180"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function Content({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className={cn(
        "overflow-hidden text-sm text-white/80",
        "data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
        className,
      )}
      {...props}
    >
      <div className="pb-3 pt-0">{children}</div>
    </AccordionPrimitive.Content>
  );
}

/** `Accordion.Item` / `Accordion.Trigger` 처럼 점(.)으로 하위 컴포넌트에 접근 */
export const Accordion = Object.assign(Root, {
  Root,
  Item,
  Header,
  Trigger,
  Content,
});
