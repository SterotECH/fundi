import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CircleDollarSign,
  FolderKanban,
  ReceiptText,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import { cn } from "@/app/cn";
import { queryAssistant, type AssistantQueryContext } from "@/api/assistant";
import type { AssistantDraft, AssistantItem, AssistantQueryResponse } from "@/api/types";

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "thinking" | "streaming" | "done" | "error";
  items?: AssistantItem[];
  draft?: AssistantDraft;
  matchedRule?: string;
};

type AssistantOpenDetail = {
  prompt: string;
  context?: AssistantQueryContext;
  autoSubmit?: boolean;
};

const QUICK_PROMPTS = [
  "How much revenue did I collect this month?",
  "Who should I follow up today?",
  "Let's draft an email to stale projects",
  "Summarize my overdue balances.",
];

function sleep(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function makeMessageId() {
  return `msg-${globalThis.crypto.randomUUID()}`;
}

function resolveItemHref(item: AssistantItem) {
  if (!item.entity_type || !item.entity_id) {
    return "/dashboard";
  }

  if (item.entity_type === "Invoice") {
    return `/invoices/${item.entity_id}`;
  }

  if (item.entity_type === "Proposal") {
    return "/proposals";
  }

  if (item.entity_type === "Project") {
    return `/projects/${item.entity_id}`;
  }

  return "/dashboard";
}

function getItemMeta(item: AssistantItem) {
  if (item.type === "invoice_follow_up") {
    return {
      chipClassName: "bg-error-light text-error-hover",
      iconClassName: "text-error",
      label: "Invoice",
    };
  }

  if (item.type === "proposal_follow_up") {
    return {
      chipClassName: "bg-warning-light text-warning-hover",
      iconClassName: "text-warning",
      label: "Proposal",
    };
  }

  if (item.type === "stale_project_follow_up") {
    return {
      chipClassName: "bg-info-light text-info-hover",
      iconClassName: "text-info",
      label: "Stale project",
    };
  }

  return {
    chipClassName: "bg-info-light text-info-hover",
    iconClassName: "text-info",
    label: "Project",
  };
}

function getRouteAssistantContext(pathname: string): AssistantQueryContext | undefined {
  const invoiceMatch = pathname.match(/^\/invoices\/([^/]+)$/);
  if (invoiceMatch) {
    return { invoice_id: invoiceMatch[1] };
  }

  const projectMatch = pathname.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    return { project_id: projectMatch[1] };
  }

  const proposalMatch = pathname.match(/^\/proposals\/([^/]+)$/);
  if (proposalMatch) {
    return { proposal_id: proposalMatch[1] };
  }

  const clientMatch = pathname.match(/^\/clients\/([^/]+)$/);
  if (clientMatch) {
    return { client_id: clientMatch[1] };
  }

  return undefined;
}

export function AssistantPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const activeRunRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: makeMessageId(),
      role: "assistant",
      content:
        "I can answer revenue, overdue balance, proposal, client health, project risk, and follow-up questions using live CRM data.",
      status: "done",
      matchedRule: "system_greeting",
    },
  ]);

  const assistantMutation = useMutation({
    mutationFn: ({ message, context }: { message: string; context?: AssistantQueryContext }) =>
      queryAssistant(message, context),
  });
  const hasUserMessage = messages.some((message) => message.role === "user");
  const routeContext = getRouteAssistantContext(location.pathname);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages, isOpen]);

  useEffect(() => {
    return () => {
      activeRunRef.current += 1;
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!isOpen) {
        return;
      }

      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || launcherRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function autoResizeTextarea() {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    const minHeight = 56;
    const maxHeight = 168;
    const nextHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = "hidden";
  }

  const streamAssistantResponse = useCallback(async (payload: AssistantQueryResponse) => {
    const runId = activeRunRef.current + 1;
    activeRunRef.current = runId;
    const assistantMessageId = makeMessageId();

    setMessages((current) => [
      ...current,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        status: "thinking",
      },
    ]);

    await sleep(420);
    if (activeRunRef.current !== runId) {
      return;
    }

    setMessages((current) =>
      current.map((message) =>
        message.id === assistantMessageId
          ? { ...message, status: "streaming" }
          : message,
      ),
    );

    const fullReply = payload.reply || "No reply returned.";
    for (let index = 0; index < fullReply.length; index += 4) {
      if (activeRunRef.current !== runId) {
        return;
      }

      const nextVisibleReply = fullReply.slice(0, index + 4);
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? { ...message, content: nextVisibleReply, status: "streaming" }
            : message,
        ),
      );
      await sleep(18);
    }

    if (activeRunRef.current !== runId) {
      return;
    }

    setMessages((current) =>
      current.map((message) =>
        message.id === assistantMessageId
          ? {
              ...message,
              content: fullReply,
              status: "done",
              items: payload.items,
              draft: payload.draft,
              matchedRule: payload.matched_rule,
            }
          : message,
      ),
    );
  }, []);

  const submitPrompt = useCallback(async (prompt: string, overrideContext?: AssistantQueryContext) => {
    const message = prompt.trim();

    if (!message || assistantMutation.isPending) {
      return;
    }

    setIsOpen(true);
    setInput("");
    autoResizeTextarea();
    setMessages((current) => [
      ...current,
      { id: makeMessageId(), role: "user", content: message, status: "done" },
    ]);

    try {
      const payload = await assistantMutation.mutateAsync({
        message,
        context: overrideContext ?? routeContext,
      });
      await streamAssistantResponse(payload);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: makeMessageId(),
          role: "assistant",
          content:
            "The assistant could not respond right now. Try again in a moment.",
          status: "error",
          matchedRule: "request_failed",
        },
      ]);
    }
  }, [
    assistantMutation,
    routeContext,
    streamAssistantResponse,
  ]);

  useEffect(() => {
    function handleAssistantOpen(event: Event) {
      const customEvent = event as CustomEvent<AssistantOpenDetail>;
      const prompt = customEvent.detail?.prompt?.trim();
      if (!prompt) {
        return;
      }

      setIsOpen(true);
      setInput(prompt);
      autoResizeTextarea();

      if (customEvent.detail?.autoSubmit) {
        void submitPrompt(prompt, customEvent.detail.context);
      }
    }

    window.addEventListener("fundi:assistant-open", handleAssistantOpen as EventListener);
    return () => {
      window.removeEventListener("fundi:assistant-open", handleAssistantOpen as EventListener);
    };
  }, [submitPrompt]);

  return (
    <>
      <button
        aria-label="Open business assistant"
        className="fixed right-4 bottom-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-primary/40 bg-primary text-primary-foreground shadow-[0_16px_50px_color-mix(in_srgb,var(--primary)_35%,transparent)] transition-all hover:scale-[1.02] hover:bg-primary-hover focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 active:outline-none sm:right-6 sm:bottom-6"
        onClick={() => setIsOpen((current) => !current)}
        ref={launcherRef}
        type="button"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      {isOpen ? (
        <section
          className="fixed right-4 bottom-20 z-40 w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-card-border bg-card shadow-2xl sm:right-6 sm:bottom-24 [&_button]:outline-none [&_button]:ring-0 [&_button]:focus:outline-none [&_button]:focus-visible:outline-none [&_button]:focus:ring-0 [&_button]:focus-visible:ring-0 [&_button]:active:outline-none [&_textarea]:outline-none [&_textarea]:ring-0 [&_textarea]:focus:outline-none [&_textarea]:focus-visible:outline-none [&_textarea]:focus:ring-0 [&_textarea]:focus-visible:ring-0"
          ref={popoverRef}
        >
          <div className="flex items-center justify-between border-b border-divider px-4 py-3">
            <h2 className="text-sm font-semibold text-text-primary">Business assistant</h2>
            <button
              aria-label="Close assistant"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background-secondary text-text-secondary transition-colors hover:border-border-hover hover:bg-card-hover hover:text-text-primary"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex h-[min(70vh,38rem)] flex-col px-4 py-3">
          {!hasUserMessage ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  className="rounded-full border border-border bg-background-secondary px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:border-border-hover hover:bg-card-hover hover:text-text-primary"
                  key={prompt}
                  onClick={() => void submitPrompt(prompt)}
                  type="button"
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          <div
            className="flex-1 space-y-3 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            ref={scrollContainerRef}
          >
            {messages.map((message) => (
              <div
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
                key={message.id}
              >
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-4 py-3",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-text-primary",
                  )}
                >
                  {message.status === "thinking" ? (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <span className="inline-flex gap-1">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                        <span className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:140ms]" />
                        <span className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:280ms]" />
                      </span>
                      Reading your CRM and composing a reply…
                    </div>
                  ) : (
                    <p className="whitespace-pre-line text-sm leading-6">
                      {message.content}
                    </p>
                  )}

                  {message.matchedRule && message.matchedRule !== "system_greeting" ? (
                    <div className="mt-2 text-[0.68rem] font-medium uppercase tracking-[0.06em] text-text-tertiary">
                      {message.matchedRule.replaceAll("_", " ")}
                    </div>
                  ) : null}

                  {message.draft ? (
                    <div className="mt-3 rounded-xl border border-border bg-background-secondary p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                        <ReceiptText className="h-3.5 w-3.5" />
                        Email draft
                      </div>
                      <p className="text-xs font-semibold text-text-secondary">
                        Subject
                      </p>
                      <p className="mt-1 text-sm font-medium text-text-primary">
                        {message.draft.subject}
                      </p>
                      <p className="mt-3 text-xs font-semibold text-text-secondary">
                        Body
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-text-primary">
                        {message.draft.body}
                      </p>
                    </div>
                  ) : null}

                  {message.items?.length ? (
                    <div className="mt-3 grid gap-2">
                      {message.items.slice(0, 4).map((item) => {
                        const meta = getItemMeta(item);

                        return (
                          <button
                            className="rounded-xl border border-border bg-background-secondary px-3 py-2 text-left transition-colors hover:border-border-hover hover:bg-card-hover"
                            key={`${item.type}-${item.entity_id ?? item.label}`}
                            onClick={() => {
                              setIsOpen(false);
                              navigate(resolveItemHref(item));
                            }}
                            type="button"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  {item.type === "invoice_follow_up" ? (
                                    <CircleDollarSign className={cn("h-3.5 w-3.5", meta.iconClassName)} />
                                  ) : item.type === "proposal_follow_up" ? (
                                    <ReceiptText className={cn("h-3.5 w-3.5", meta.iconClassName)} />
                                  ) : (
                                    <FolderKanban className={cn("h-3.5 w-3.5", meta.iconClassName)} />
                                  )}
                                  <p className="truncate text-sm font-semibold text-text-primary">
                                    {item.label}
                                  </p>
                                </div>
                                <p className="mt-1 text-xs leading-5 text-text-secondary">
                                  {item.reason}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
                                    meta.chipClassName,
                                  )}
                                >
                                  {meta.label}
                                </span>
                                <ArrowUpRight className="h-3.5 w-3.5 text-text-tertiary" />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-divider pt-3">
            <label className="sr-only" htmlFor="assistant-input">
              Ask the business assistant
            </label>
            <div className="flex items-end gap-2 px-1 py-1">
              <textarea
                className="min-h-14 flex-1 resize-none bg-transparent text-sm leading-6 text-text-primary outline-none placeholder:text-text-tertiary [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                id="assistant-input"
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setInput(nextValue);
                  autoResizeTextarea();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submitPrompt(input);
                  }
                }}
                placeholder="Ask a question..."
                ref={textareaRef}
                rows={1}
                value={input}
              />
              <button
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!input.trim() || assistantMutation.isPending}
                onClick={() => void submitPrompt(input)}
                type="button"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </div>
          </div>
        </div>
        </section>
      ) : null}
    </>
  );
}
