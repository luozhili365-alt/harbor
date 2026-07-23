import { IConnector, EmailMessage, MailboxConfig } from './types'
import { ImapFlow } from 'imapflow'
// @ts-ignore - mailparser types
import { simpleParser } from 'mailparser'

export class ImapConnector implements IConnector {
  readonly type = 'IMAP'
  private client: ImapFlow | null = null
  private config: MailboxConfig
  private connected = false

  constructor(config: MailboxConfig) {
    this.config = config
  }

  async connect(): Promise<boolean> {
    try {
      this.client = new ImapFlow({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.tls,
        auth: {
          user: this.config.username,
          pass: this.config.password,
        },
        logger: false,
      })

      await this.client.connect()
      this.connected = true
      return true
    } catch (err) {
      console.error('[IMAP] Connection failed:', err)
      this.connected = false
      return false
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try { await this.client.logout() } catch {}
      this.client = null
    }
    this.connected = false
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const ok = await this.connect()
      if (ok) {
        await this.disconnect()
        return { success: true }
      }
      return { success: false, error: '连接失败' }
    } catch (err: any) {
      return { success: false, error: err.message || '连接测试失败' }
    }
  }

  async listFolders(): Promise<string[]> {
    if (!this.client || !this.connected) {
      await this.connect()
    }
    if (!this.client) return []

    const folders: string[] = []
    const list = await this.client.list()
    for (const f of list) {
      if (f.name) folders.push(f.name)
    }
    return folders
  }

  async sync(sinceDate?: string): Promise<EmailMessage[]> {
    if (!this.client || !this.connected) {
      const ok = await this.connect()
      if (!ok) return []
    }
    if (!this.client) return []

    const messages: EmailMessage[] = []
    const folders = this.config.folders.length > 0 ? this.config.folders : ['INBOX']

    for (const folder of folders) {
      try {
        const lock = await this.client.getMailboxLock(folder)
        try {
          // Search for messages since last sync
          const searchCriteria: any = {}
          if (sinceDate) {
            searchCriteria.since = new Date(sinceDate)
          } else {
            // Default: last 30 days for first sync
            const d = new Date()
            d.setDate(d.getDate() - 30)
            searchCriteria.since = d
          }

          const list = await this.client.fetch(searchCriteria, {
            source: true,
            uid: true,
            flags: true,
            envelope: true,
            bodyStructure: true,
          }, { uid: true })

          for await (const msg of list) {
            try {
              const parsed = await simpleParser(msg.source)

              const fromAddr = (parsed.from as any)?.value?.[0]?.address || 'unknown@unknown.com'
              const fromName = (parsed.from as any)?.text?.split('<')[0]?.trim() || (parsed.from as any)?.value?.[0]?.name || '未知'
              const toAddrs = ((parsed.to as any)?.value || []).map((t: any) => t.address || '')
              const ccAddrs = ((parsed.cc as any)?.value || []).map((t: any) => t.address || '')

              messages.push({
                messageId: parsed.messageId || msg.uid.toString(),
                threadId: (parsed.inReplyTo as string) || undefined,
                fromName,
                fromAddr,
                toAddrs,
                ccAddrs,
                subject: parsed.subject || '(无主题)',
                bodyText: parsed.text || '',
                bodyHtml: (parsed as any).html || (parsed.textAsHtml as string) || '',
                snippet: (parsed.text || '').slice(0, 200),
                hasAttachments: parsed.attachments.length > 0,
                attachmentNames: parsed.attachments.map((a: any) => a.filename || '未命名附件'),
                receivedAt: parsed.date?.toISOString() || new Date().toISOString(),
                folder,
              })
            } catch (parseErr) {
              console.error('[IMAP] Parse error:', parseErr)
            }
          }
        } finally {
          lock.release()
        }
      } catch (folderErr) {
        console.error(`[IMAP] Folder error (${folder}):`, folderErr)
      }
    }

    return messages
  }

  isConnected(): boolean {
    return this.connected
  }
}
