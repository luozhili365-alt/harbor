export interface HarborAPI {
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>
  on(channel: string, callback: (...args: unknown[]) => void): void
  off(channel: string, callback: (...args: unknown[]) => void): void
}

declare global {
  interface Window {
    harbor: HarborAPI
  }
}
