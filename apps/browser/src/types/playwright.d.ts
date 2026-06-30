// Ambient declaration for the optional 'playwright' dependency.
// This allows typecheck to pass when playwright is not installed; the actual
// import is dynamic and only resolved at runtime when the user selects the
// playwright-stealth captcha provider.
declare module 'playwright' {
  export interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }
  export interface Page {
    addInitScript(script: () => void): Promise<void>;
    goto(
      url: string,
      opts?: { waitUntil?: string; timeout?: number },
    ): Promise<unknown>;
    evaluate<T>(fn: () => T): Promise<T>;
    evaluate<T, A>(fn: (arg: A) => T, arg: A): Promise<T>;
  }
  export const chromium: {
    launch(options?: Record<string, unknown>): Promise<Browser>;
  };
}
