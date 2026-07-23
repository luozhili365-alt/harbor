import { ipcMain } from 'electron'
import { registerCaseHandlers } from './cases'
import { registerClientHandlers } from './clients'
import { registerAuthHandlers } from './auth'
import { registerDashboardHandlers } from './dashboard'
import { registerTaskHandlers } from './tasks'
import { registerActivityHandlers } from './activity'
import { registerCommunicationHandlers } from './communications'
import { registerMailboxHandlers } from '../connectors/mailbox-manager'
import { registerDocumentHandlers } from './documents'
import { registerCalendarHandlers } from './calendar'
import { registerReminderHandlers } from './reminders'
import { registerAICenterHandlers } from './ai-center'

export function registerIpcHandlers(): void {
  registerAuthHandlers()
  registerCaseHandlers()
  registerClientHandlers()
  registerDashboardHandlers()
  registerTaskHandlers()
  registerActivityHandlers()
  registerCommunicationHandlers()
  registerMailboxHandlers()
  registerDocumentHandlers()
  registerCalendarHandlers()
  registerReminderHandlers()
  registerAICenterHandlers()

  ipcMain.handle('app:getVersion', () => {
    return { version: '0.1.0', name: 'Harbor' }
  })
}
