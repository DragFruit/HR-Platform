export type UserNotificationKind =
  | 'vacation_submitted'
  | 'vacation_updated'
  | 'vacation_deleted'
  | 'vacation_approved'
  | 'vacation_rejected'
  | 'vacation_next_stage'
  | 'vacation_reservation_updated'
  | 'vacation_reservation_expiring'
  | 'vacation_reservation_expiring_manager'
  | 'idea_status_changed'
  | 'post_vacation_memo'
  | 'knowledge_article_submitted'
  | 'knowledge_article_accepted'
  | 'knowledge_article_revision'
  | 'knowledge_article_rejected';

export type UserNotification = {
  id: string;
  kind: UserNotificationKind;
  recipient_user_id: number;
  /** Для уведомлений по отпускам; для идей может отсутствовать */
  vacation_request_id?: number;
  employee_name: string;
  start?: string;
  end?: string;
  /** Подпись этапа (отпуска / статус идеи) */
  stage_label?: string;
  idea_id?: string;
  idea_title?: string;
  status_comment?: string;
  created_at: string;
  seen: boolean;
  /** Скрыто из выпадающего колокольчика; остаётся на /notifications */
  hidden_from_bell?: boolean;
};

export type CreateUserNotificationInput = Omit<UserNotification, 'id' | 'created_at' | 'seen' | 'hidden_from_bell'>;

export type RecipientIds = number | number[];

/** Максимум уведомлений на одного получателя; при превышении удаляются самые старые. */
export const USER_NOTIFICATIONS_MAX_PER_RECIPIENT = 100;

/** Общий интерфейс хранилища: JSON-файл (прод сегодня) или Postgres (DB_NOTIFICATIONS=1). */
export interface UserNotificationsRepo {
  readonly backend: 'json' | 'postgres';
  list(recipients: RecipientIds, filters?: { unseen?: boolean; forBell?: boolean }): Promise<UserNotification[]>;
  countUnseen(recipients: RecipientIds): Promise<number>;
  markSeen(recipients: RecipientIds, id: string): Promise<UserNotification | null>;
  markAllSeen(recipients: RecipientIds): Promise<number>;
  hideFromBell(recipients: RecipientIds, id: string): Promise<UserNotification | null>;
  dismiss(recipients: RecipientIds, id: string): Promise<boolean>;
  create(input: CreateUserNotificationInput): Promise<UserNotification>;
  deleteForRecipients(recipientUserIds: number[]): Promise<number>;
}

export const recipientList = (recipients: RecipientIds): number[] =>
  [...new Set(Array.isArray(recipients) ? recipients : [recipients])].filter((id) => Number.isFinite(id));
