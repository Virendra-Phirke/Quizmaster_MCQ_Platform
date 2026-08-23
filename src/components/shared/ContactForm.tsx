import { useForm, ValidationError } from "@formspree/react";
import { Mail, User, MessageSquare, Send, CheckCircle2 } from "lucide-react";

export function ContactForm() {
  const [state, handleSubmit] = useForm("mnjpzakj");

  if (state.succeeded) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 py-5 sm:py-6 text-center px-2">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-green-400" />
        </div>
        <h5 className="text-white font-semibold text-base sm:text-lg">Message Sent!</h5>
        <p className="text-gray-400 text-xs sm:text-sm leading-relaxed max-w-xs">
          Thanks for reaching out. We'll get back to you as soon as possible.
        </p>
      </div>
    );
  }

  /* shared input / textarea classes */
  const fieldBase =
    "w-full bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 " +
    "focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 " +
    "transition-[color,background-color,border-color,box-shadow] " +
    /* larger tap target & text on mobile to prevent iOS/Android zoom */
    "text-base sm:text-sm py-3 sm:py-2.5";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 sm:space-y-3 w-full"
      noValidate
    >
      {/* Name */}
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-4 sm:h-4 text-gray-500 pointer-events-none" />
        <input
          id="name"
          type="text"
          name="name"
          placeholder="Your name"
          required
          autoComplete="name"
          className={`${fieldBase} pl-10 pr-4`}
        />
        <ValidationError
          prefix="Name"
          field="name"
          errors={state.errors}
          className="text-red-400 text-xs mt-1 ml-1"
        />
      </div>

      {/* Email */}
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          id="email"
          type="email"
          name="email"
          placeholder="your@email.com"
          required
          autoComplete="email"
          inputMode="email"
          className={`${fieldBase} pl-10 pr-4`}
        />
        <ValidationError
          prefix="Email"
          field="email"
          errors={state.errors}
          className="text-red-400 text-xs mt-1 ml-1"
        />
      </div>

      {/* Message */}
      <div className="relative">
        <MessageSquare className="absolute left-3 top-4 sm:top-3 w-4 h-4 text-gray-500 pointer-events-none" />
        <textarea
          id="message"
          name="message"
          rows={4}
          placeholder="How can we help you?"
          required
          className={`${fieldBase} pl-10 pr-4 resize-none`}
        />
        <ValidationError
          prefix="Message"
          field="message"
          errors={state.errors}
          className="text-red-400 text-xs mt-1 ml-1"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={state.submitting}
        className={
          "w-full flex items-center justify-center gap-2 " +
          /* bigger tap area on mobile */
          "px-6 py-3 sm:py-2.5 rounded-xl " +
          "bg-gradient-to-r from-slate-500 to-slate-500 text-white " +
          "text-base sm:text-sm font-semibold " +
          "active:scale-95 touch-manipulation " +
          "hover:from-teal-600 hover:to-slate-600 " +
          "transition-[transform,box-shadow] duration-200 " +
          "hover:shadow-lg hover:shadow-sky-500/50 " +
          "disabled:opacity-60 disabled:cursor-not-allowed"
        }
      >
        {state.submitting ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Send Message
          </>
        )}
      </button>
    </form>
  );
}
