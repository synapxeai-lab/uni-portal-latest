import * as React from "react";
import { Calendar, Clock } from "lucide-react";

import { cn } from "@/lib/utils";

import { Input } from "./input";

type PickerInputProps = Omit<React.ComponentProps<"input">, "type">;

/**
 * A native date/time input with our own themed picker button drawn on top.
 * The native picker-indicator glyph Chromium/Edge draws is styled purely by
 * OS/browser chrome and renders nearly invisible on the dark theme, so it is
 * hidden and replaced by a real button that opens the native picker through
 * showPicker(). (Overlaying a click-through icon doesn't work: the input's
 * right padding pushes the native hit target away from the icon.)
 */
function createPickerInput(
  type: "date" | "time" | "datetime-local",
  Icon: typeof Calendar,
  label: string,
) {
  const PickerInput = React.forwardRef<HTMLInputElement, PickerInputProps>(function PickerInput(
    { className, disabled, ...props },
    forwardedRef,
  ) {
    const innerRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement);

    function openPicker() {
      const input = innerRef.current;
      if (!input) {
        return;
      }
      input.focus();
      try {
        input.showPicker();
      } catch {
        // Older browsers lack showPicker - focusing still lets the user type
        // or use the keyboard shortcut (Alt+Down) to open the picker.
      }
    }

    return (
      <div className="relative">
        <Input
          type={type}
          className={cn("pr-10 [&::-webkit-calendar-picker-indicator]:hidden", className)}
          ref={innerRef}
          disabled={disabled}
          {...props}
        />
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          tabIndex={-1}
          aria-label={label}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none"
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  });
  return PickerInput;
}

const DateTimeInput = createPickerInput("datetime-local", Calendar, "Open date and time picker");
DateTimeInput.displayName = "DateTimeInput";

const DateInput = createPickerInput("date", Calendar, "Open date picker");
DateInput.displayName = "DateInput";

const TimeInput = createPickerInput("time", Clock, "Open time picker");
TimeInput.displayName = "TimeInput";

export { DateInput, DateTimeInput, TimeInput };
