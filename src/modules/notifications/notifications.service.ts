import { prisma } from '../../config/db';
import { HttpError } from '../../middleware/errorHandler';
import { NotificationDto, toNotificationDto } from './notifications.mapper';

// GET /api/notifications — найновіші перші, обмежено 50 (це дзвіночок, не архів).
export async function listMyNotifications(userId: number): Promise<NotificationDto[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return rows.map(toNotificationDto);
}

export async function unreadCount(userId: number): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function markRead(userId: number, id: number): Promise<void> {
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== userId) throw new HttpError(404, 'Notification not found');
  if (!n.read) await prisma.notification.update({ where: { id }, data: { read: true } });
}

export async function markAllRead(userId: number): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}
