import { Category, CategoryItem } from '@prisma/client';

// Відповідає Java CategoryItemResponseDto / CategoryResponseDto.
export interface CategoryItemDto {
  id: number;
  name: string;
  durationMinutes: number;
  price: number;
}

export interface CategoryDto {
  id: number;
  name: string;
  items: CategoryItemDto[];
}

type CategoryWithItems = Category & { items: CategoryItem[] };

export function toCategoryItemDto(i: CategoryItem): CategoryItemDto {
  return {
    id: i.id,
    name: i.name,
    durationMinutes: i.durationMinutes,
    price: i.price,
  };
}

export function toCategoryDto(c: CategoryWithItems): CategoryDto {
  return {
    id: c.id,
    name: c.name,
    items: [...c.items].sort((a, b) => a.id - b.id).map(toCategoryItemDto),
  };
}

export const categoryInclude = { items: true } as const;
