/** Minimal types for the Plaid Link browser SDK (injected via <script>). */
export {};

declare global {
  interface Window {
    Plaid?: {
      create(config: {
        token: string;
        onSuccess: (
          public_token: string,
          metadata: { institution?: { name?: string; institution_id?: string } },
        ) => void;
        onExit?: () => void;
      }): { open(): void };
    };
  }
}
