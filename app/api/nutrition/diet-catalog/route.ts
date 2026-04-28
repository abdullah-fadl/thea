import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import prisma from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// ─── GET /api/nutrition/diet-catalog ─────────────────────────────────────────
// List catalog items with optional filters.
// Query params: category, dietType, excludeAllergens (comma-sep), texture,
//               isAvailable, search, seed (if "true" bulk-insert seed data)
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const category = url.searchParams.get('category');
      const dietType = url.searchParams.get('dietType');
      const excludeAllergens = url.searchParams.get('excludeAllergens');
      const texture = url.searchParams.get('texture');
      const isAvailable = url.searchParams.get('isAvailable');
      const search = url.searchParams.get('search');

      const where: any = { tenantId };

      if (category) {
        where.category = category;
      }
      if (texture) {
        where.texture = texture;
      }
      if (isAvailable === 'true') {
        where.isAvailable = true;
      } else if (isAvailable === 'false') {
        where.isAvailable = false;
      }

      if (search && search.trim()) {
        const term = search.trim();
        where.OR = [
          { name: { contains: term, mode: 'insensitive' } },
          { nameAr: { contains: term, mode: 'insensitive' } },
        ];
      }

      // dietType filter — item must include this dietType in its array
      if (dietType) {
        where.dietTypes = { has: dietType };
      }

      const items = await prisma.dietCatalogItem.findMany({
        where,
        orderBy: { name: 'asc' },
        take: 200,
      });

      // Post-filter: exclude items containing certain allergens
      let filtered = items;
      if (excludeAllergens) {
        const exclusions = excludeAllergens.split(',').map((a: string) => a.trim().toUpperCase());
        filtered = items.filter((item) => {
          const itemAllergens: string[] = item.allergens ?? [];
          return !exclusions.some((ex: string) => itemAllergens.includes(ex));
        });
      }

      // KPIs
      const allItems = await prisma.dietCatalogItem.findMany({
        where: { tenantId },
        select: { category: true, isAvailable: true, allergens: true },
        take: 500,
      });
      const totalItems = allItems.length;
      const availableItems = allItems.filter((i) => i.isAvailable).length;
      const categoriesCovered = new Set(allItems.map((i) => i.category)).size;
      const withAllergens = allItems.filter((i) => (i.allergens ?? []).length > 0).length;

      return NextResponse.json({
        items: filtered,
        kpis: {
          totalItems,
          availableItems,
          categoriesCovered,
          withAllergens,
        },
      });
    } catch (e) {
      logger.error('[DIET-CATALOG GET] Failed', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to fetch diet catalog items' }, { status: 500 });
    }
  },
  { permissionKey: 'nutrition.view' }
);

// ─── POST /api/nutrition/diet-catalog ────────────────────────────────────────
// Create a new catalog item OR bulk-import seed catalog.
export const POST = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const body = await req.json();

      // Bulk seed import
      if (body.bulkSeed && Array.isArray(body.items)) {
        const created = await prisma.dietCatalogItem.createMany({
          data: body.items.map((item: any) => ({
            tenantId,
            name: item.name,
            nameAr: item.nameAr ?? null,
            category: item.category,
            dietTypes: item.dietTypes ?? [],
            calories: item.calories != null ? Number(item.calories) : null,
            protein: item.protein != null ? Number(item.protein) : null,
            carbohydrates: item.carbohydrates != null ? Number(item.carbohydrates) : null,
            fat: item.fat != null ? Number(item.fat) : null,
            fiber: item.fiber != null ? Number(item.fiber) : null,
            sodium: item.sodium != null ? Number(item.sodium) : null,
            potassium: item.potassium != null ? Number(item.potassium) : null,
            sugar: item.sugar != null ? Number(item.sugar) : null,
            servingSize: item.servingSize ?? null,
            allergens: item.allergens ?? [],
            texture: item.texture ?? null,
            isVegetarian: item.isVegetarian ?? false,
            isVegan: item.isVegan ?? false,
            isHalal: item.isHalal ?? true,
            isAvailable: true,
            notes: item.notes ?? null,
          })),
          skipDuplicates: true,
        });
        return NextResponse.json({ imported: created.count ?? body.items.length });
      }

      // Single item creation
      const { name, category } = body;
      if (!name || !category) {
        return NextResponse.json({ error: 'name and category are required' }, { status: 400 });
      }

      const item = await prisma.dietCatalogItem.create({
        data: {
          tenantId,
          name,
          nameAr: body.nameAr ?? null,
          category,
          dietTypes: body.dietTypes ?? [],
          calories: body.calories != null ? Number(body.calories) : null,
          protein: body.protein != null ? Number(body.protein) : null,
          carbohydrates: body.carbohydrates != null ? Number(body.carbohydrates) : null,
          fat: body.fat != null ? Number(body.fat) : null,
          fiber: body.fiber != null ? Number(body.fiber) : null,
          sodium: body.sodium != null ? Number(body.sodium) : null,
          potassium: body.potassium != null ? Number(body.potassium) : null,
          sugar: body.sugar != null ? Number(body.sugar) : null,
          servingSize: body.servingSize ?? null,
          allergens: body.allergens ?? [],
          texture: body.texture ?? null,
          isVegetarian: body.isVegetarian ?? false,
          isVegan: body.isVegan ?? false,
          isHalal: body.isHalal ?? true,
          isAvailable: body.isAvailable ?? true,
          imageUrl: body.imageUrl ?? null,
          notes: body.notes ?? null,
        },
      });

      return NextResponse.json({ item }, { status: 201 });
    } catch (e) {
      logger.error('[DIET-CATALOG POST] Failed', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to create diet catalog item' }, { status: 500 });
    }
  },
  { permissionKey: 'nutrition.manage' }
);

// ─── PUT /api/nutrition/diet-catalog ─────────────────────────────────────────
// Update an existing catalog item (by id).
export const PUT = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const body = await req.json();
      const { id } = body;

      if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
      }

      // Build update data from body, excluding id and tenantId
      const data: any = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.nameAr !== undefined) data.nameAr = body.nameAr;
      if (body.category !== undefined) data.category = body.category;
      if (body.dietTypes !== undefined) data.dietTypes = body.dietTypes;
      if (body.calories !== undefined) data.calories = body.calories != null ? Number(body.calories) : null;
      if (body.protein !== undefined) data.protein = body.protein != null ? Number(body.protein) : null;
      if (body.carbohydrates !== undefined) data.carbohydrates = body.carbohydrates != null ? Number(body.carbohydrates) : null;
      if (body.fat !== undefined) data.fat = body.fat != null ? Number(body.fat) : null;
      if (body.fiber !== undefined) data.fiber = body.fiber != null ? Number(body.fiber) : null;
      if (body.sodium !== undefined) data.sodium = body.sodium != null ? Number(body.sodium) : null;
      if (body.potassium !== undefined) data.potassium = body.potassium != null ? Number(body.potassium) : null;
      if (body.sugar !== undefined) data.sugar = body.sugar != null ? Number(body.sugar) : null;
      if (body.servingSize !== undefined) data.servingSize = body.servingSize;
      if (body.allergens !== undefined) data.allergens = body.allergens;
      if (body.texture !== undefined) data.texture = body.texture;
      if (body.isVegetarian !== undefined) data.isVegetarian = body.isVegetarian;
      if (body.isVegan !== undefined) data.isVegan = body.isVegan;
      if (body.isHalal !== undefined) data.isHalal = body.isHalal;
      if (body.isAvailable !== undefined) data.isAvailable = body.isAvailable;
      if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
      if (body.notes !== undefined) data.notes = body.notes;

      const updated = await prisma.dietCatalogItem.updateMany({
        where: { id, tenantId },
        data,
      });

      if (updated.count === 0) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }

      const item = await prisma.dietCatalogItem.findFirst({
        where: { id, tenantId },
      });

      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[DIET-CATALOG PUT] Failed', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to update diet catalog item' }, { status: 500 });
    }
  },
  { permissionKey: 'nutrition.manage' }
);
