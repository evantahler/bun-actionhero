import type { SpanKind } from "@opentelemetry/api";
import {
  type Context,
  context,
  type Span,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import { api } from "../api";

/**
 * Finalize a span: record an error (if present), set status, and end it.
 *
 * @param span - The OTel span to finalize.
 * @param error - Optional error to record. When provided the span status is set
 *   to `ERROR`; otherwise `OK`.
 */
export function finalizeSpan(span: Span, error?: Error): void {
  if (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }
  span.end();
}

/**
 * Attach span finalization to a promise. Ends the span on resolution; records
 * the exception and sets ERROR status on rejection.
 *
 * @param span - The OTel span to finalize.
 * @param promise - The promise whose settlement drives span lifecycle.
 */
export function finalizeSpanOnPromise(
  span: Span,
  promise: Promise<unknown>,
): void {
  promise.then(
    () => span.end(),
    (e: Error) => finalizeSpan(span, e),
  );
}

/**
 * Run an async function inside an OTel span context. The span is passed to `fn`
 * so callers can add attributes or events; it is **not** automatically ended —
 * use {@link finalizeSpan} inside or after `fn`.
 *
 * @param spanName - Name for the new span.
 * @param spanKind - OTel SpanKind (SERVER, CLIENT, INTERNAL, etc.).
 * @param attributes - Initial span attributes.
 * @param parentContext - Explicit parent context. Falls back to the ambient context.
 * @param fn - Async function to execute within the span's context.
 * @returns The value returned by `fn`.
 */
export async function runWithSpan<T>(
  spanName: string,
  spanKind: SpanKind,
  attributes: Record<string, string>,
  parentContext: Context | undefined,
  fn: (span: Span, spanContext: Context) => Promise<T>,
): Promise<T> {
  const ctx = parentContext ?? context.active();
  const span = api.observability.tracing.tracer.startSpan(
    spanName,
    { kind: spanKind, attributes },
    ctx,
  );
  const spanCtx = trace.setSpan(ctx, span);
  return context.with(spanCtx, () => fn(span, spanCtx));
}

/**
 * Inject the current OTel trace context into task params for cross-process propagation.
 * Adds `_traceParent` and `_traceState` fields when tracing is enabled.
 *
 * @param inputs - The task input object to enrich (mutated in place).
 */
export function injectTraceToParams(inputs: Record<string, unknown>): void {
  if (!api.observability.tracing.enabled) return;
  const carrier: Record<string, string> = {};
  api.observability.tracing.injectContext(carrier);
  if (carrier.traceparent) inputs._traceParent = carrier.traceparent;
  if (carrier.tracestate) inputs._traceState = carrier.tracestate;
}

/**
 * Extract OTel trace context from task params previously injected by
 * {@link injectTraceToParams}. Returns `undefined` when no context is present.
 *
 * @param params - The task params containing `_traceParent` / `_traceState`.
 * @returns An OTel `Context` or `undefined`.
 */
export function extractTraceFromParams(
  params: Record<string, unknown>,
): Context | undefined {
  const traceParent = params._traceParent as string | undefined;
  const traceState = params._traceState as string | undefined;
  if (!traceParent) return undefined;
  const headers = new Headers();
  headers.set("traceparent", traceParent);
  if (traceState) headers.set("tracestate", traceState);
  return api.observability.tracing.extractContext(headers);
}
