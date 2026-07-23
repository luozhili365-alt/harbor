/* ── Connector Interface ─────────────────────── */

export interface MailboxConfig {
  id: string
  name: string
  provider: string           // 'IMAP' | 'GMAIL' | 'OUTLOOK' | 'QQ' | '163' | 'CUSTOM'
  host: string
  port: number
  tls: boolean
  username: string
  password: string           // Decrypted at runtime for connection
  folders: string[]           // ['INBOX'] or ['INBOX', 'Sent', ...]
  syncFrequency: number       // minutes between auto-syncs
}

export interface SyncResult {
  newItems: number
  updatedItems: number
  errors: string[]
  lastSyncTimestamp: string
}

export interface EmailMessage {
  messageId: string
  threadId?: string
  fromName: string
  fromAddr: string
  toAddrs: string[]
  ccAddrs: string[]
  subject: string
  bodyText: string
  bodyHtml: string
  snippet: string
  hasAttachments: boolean
  attachmentNames: string[]
  receivedAt: string
  folder: string
}

export interface IConnector {
  readonly type: string
  connect(): Promise<boolean>
  disconnect(): Promise<void>
  testConnection(): Promise<{ success: boolean; error?: string }>
  listFolders(): Promise<string[]>
  sync(sinceDate?: string): Promise<EmailMessage[]>
  isConnected(): boolean
}
