import { prisma } from '../../config/db';
import { HttpError } from '../../middleware/errorHandler';
import { PortfolioItemDto, toPortfolioItemDto } from './portfolio.mapper';
import { AddPortfolioItemInput } from './portfolio.schemas';

const MAX_ITEMS = 20;

async function requireSpecialist(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'SPECIALIST') {
    throw new HttpError(404, 'Specialist profile not found');
  }
}

// GET /api/specialist/portfolio  (власні, будь-який порядок редагування)
export async function listMyPortfolio(userId: number): Promise<PortfolioItemDto[]> {
  await requireSpecialist(userId);
  const rows = await prisma.portfolioItem.findMany({
    where: { specialistUserId: userId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toPortfolioItemDto);
}

// POST /api/specialist/portfolio
export async function addPortfolioItem(
  userId: number,
  input: AddPortfolioItemInput,
): Promise<PortfolioItemDto> {
  await requireSpecialist(userId);
  const count = await prisma.portfolioItem.count({ where: { specialistUserId: userId } });
  if (count >= MAX_ITEMS) {
    throw new HttpError(400, `You can have at most ${MAX_ITEMS} portfolio items`);
  }
  const created = await prisma.portfolioItem.create({
    data: {
      specialistUserId: userId,
      imageUrl: `data:image/png;base64,${input.imageBase64}`,
      caption: input.caption ?? '',
    },
  });
  return toPortfolioItemDto(created);
}

// DELETE /api/specialist/portfolio/:id
export async function deletePortfolioItem(userId: number, itemId: number): Promise<void> {
  const item = await prisma.portfolioItem.findUnique({ where: { id: itemId } });
  if (!item || item.specialistUserId !== userId) {
    throw new HttpError(404, 'Portfolio item not found');
  }
  await prisma.portfolioItem.delete({ where: { id: itemId } });
}

// GET /api/specialists/:id/portfolio — публічно
export async function getPublicPortfolio(specialistUserId: number): Promise<PortfolioItemDto[]> {
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
  const rows = await prisma.portfolioItem.findMany({
    where: { specialistUserId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toPortfolioItemDto);
}
