import { Notification } from '@prisma/client';

export interface NotificationDto {
  id: number;
  type: string;
  title: string;
  body: string;
  read: boolean;
  bookingId: number | null;
  createdAt: Date;
}

export function toNotificationDto(n: Notification): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    read: n.read,
    bookingId: n.bookingId,
    createdAt: n.createdAt,
  };
}
