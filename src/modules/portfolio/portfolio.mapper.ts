import { PortfolioItem } from '@prisma/client';

export interface PortfolioItemDto {
  id: number;
  imageUrl: string;
  caption: string;
  createdAt: Date;
}

export function toPortfolioItemDto(i: PortfolioItem): PortfolioItemDto {
  return { id: i.id, imageUrl: i.imageUrl, caption: i.caption, createdAt: i.createdAt };
}
