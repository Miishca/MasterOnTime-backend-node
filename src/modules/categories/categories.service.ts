import { prisma } from '../../config/db';
import { HttpError } from '../../middleware/errorHandler';
import {
  CategoryDto,
  CategoryItemDto,
  categoryInclude,
  toCategoryDto,
  toCategoryItemDto,
} from './categories.mapper';
import { CategoryItemInput } from './categories.schemas';

// Категорія належить спеціалісту (User) через Category.specialistId.
// Java не перевіряв власника при update/delete/addItem — тут перевіряємо завжди
// (та сама вада власності, що й у reviews/booking- port).
async function ownedCategory(userId: number, categoryId: number) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: categoryInclude,
  });
  if (!category || category.specialistId !== userId) {
    throw new HttpError(404, 'Category not found');
  }
  return category;
}

async function ownedItem(userId: number, itemId: number) {
  const item = await prisma.categoryItem.findUnique({
    where: { id: itemId },
    include: { category: true },
  });
  if (!item || item.category.specialistId !== userId) {
    throw new HttpError(404, 'Service not found');
  }
  return item;
}

// Перед видаленням послуги від'єднуємо її від наявних бронювань (FK Restrict),
// зберігаючи саме бронювання (час, priceAtBooking).
async function detachItemFromBookings(itemId: number) {
  await prisma.booking.updateMany({
    where: { serviceItemId: itemId },
    data: { serviceItemId: null },
  });
}

export async function listCategories(userId: number): Promise<CategoryDto[]> {
  const rows = await prisma.category.findMany({
    where: { specialistId: userId },
    orderBy: { id: 'asc' },
    include: categoryInclude,
  });
  return rows.map(toCategoryDto);
}

export async function createCategory(userId: number, name: string): Promise<CategoryDto> {
  const created = await prisma.category.create({
    data: { name, specialistId: userId },
    include: categoryInclude,
  });
  return toCategoryDto(created);
}

export async function updateCategory(
  userId: number,
  categoryId: number,
  name: string,
): Promise<CategoryDto> {
  await ownedCategory(userId, categoryId);
  const updated = await prisma.category.update({
    where: { id: categoryId },
    data: { name },
    include: categoryInclude,
  });
  return toCategoryDto(updated);
}

export async function deleteCategory(userId: number, categoryId: number): Promise<void> {
  const category = await ownedCategory(userId, categoryId);
  await prisma.$transaction([
    ...category.items.map((i) =>
      prisma.booking.updateMany({
        where: { serviceItemId: i.id },
        data: { serviceItemId: null },
      }),
    ),
    prisma.categoryItem.deleteMany({ where: { categoryId } }),
    prisma.category.delete({ where: { id: categoryId } }),
  ]);
}

export async function addItem(
  userId: number,
  categoryId: number,
  input: CategoryItemInput,
): Promise<CategoryItemDto> {
  await ownedCategory(userId, categoryId);
  const created = await prisma.categoryItem.create({
    data: {
      name: input.name,
      durationMinutes: input.durationMinutes,
      price: input.price,
      categoryId,
    },
  });
  return toCategoryItemDto(created);
}

export async function updateItem(
  userId: number,
  itemId: number,
  input: CategoryItemInput,
): Promise<CategoryItemDto> {
  await ownedItem(userId, itemId);
  const updated = await prisma.categoryItem.update({
    where: { id: itemId },
    data: {
      name: input.name,
      durationMinutes: input.durationMinutes,
      price: input.price,
    },
  });
  return toCategoryItemDto(updated);
}

export async function deleteItem(userId: number, itemId: number): Promise<void> {
  await ownedItem(userId, itemId);
  await detachItemFromBookings(itemId);
  await prisma.categoryItem.delete({ where: { id: itemId } });
}

// GET /api/specialists/:id/services — публічний перелік послуг спеціаліста
// (для екрана бронювання). id — це User id.
export async function getPublicServices(specialistUserId: number): Promise<CategoryDto[]> {
  const user = await prisma.user.findFirst({
    where: {
      id: specialistUserId,
      role: 'SPECIALIST',
      visible: true,
      isDeleted: false,
    },
    select: { id: true },
  });
  if (!user) throw new HttpError(404, 'Specialist not found');

  const rows = await prisma.category.findMany({
    where: { specialistId: specialistUserId },
    orderBy: { id: 'asc' },
    include: categoryInclude,
  });
  return rows.map(toCategoryDto);
}
