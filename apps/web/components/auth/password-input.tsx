"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Password field with a show/hide toggle. Wraps shadcn's Input so the
 * ring / border styling stays consistent with other form fields.
 * State is internal — no controlled `show` prop needed at the call site.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(
  function PasswordInput({ className, ...props }, ref) {
    const [show, setShow] = useState(false);

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={show ? "text" : "password"}
          className={
            "h-12 rounded-xl border-gray-300 pr-12 focus-visible:ring-brand-400 " +
            (className ?? "")
          }
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
