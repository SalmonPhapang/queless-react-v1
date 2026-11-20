import { supabase } from '../config/supabaseClient';
import { Product } from '../models/product';
import { storeService } from './storeService';
import { cartService } from './cartService';

/**
 * Port of lib/services/budget_meal_service.dart (Q AI Phase 15).
 *
 * The planner and basket builder are server-side RPCs; this client only parses
 * their jsonb output and adds the resulting basket to the (single) cart.
 */

export interface BudgetPlanRecipe {
  recipeId: string;
  title: string;
  servings?: number;
  estimatedCost?: number;
  matchCount?: number;
}

export interface BudgetPlanProduct {
  productId: string;
  name: string;
  price: number;
  /** 'main' | 'side' | 'drink' */
  role?: string;
}

export interface BudgetMealPlan {
  planId: number;
  /** 'recipe_combo' or 'standalone_products' */
  planKind: string;
  title: string;
  description?: string;
  totalCost: number;
  perPersonCost: number;
  servings: number;
  withinBudget: boolean;
  /** Budget headroom in Rands; negative means over budget. */
  headroom?: number | null;
  recipes: BudgetPlanRecipe[];
  products: BudgetPlanProduct[];
  isRecipeBased: boolean;
}

export interface BudgetBasketMissing {
  name?: string;
  quantity?: string;
  reason?: string;
}

export interface BudgetBasket {
  storeId?: string;
  storeName?: string;
  itemCount: number;
  totalCost: number;
  perPersonCost: number;
  servings: number;
  withinBudget: boolean;
  budgetHeadroom?: number | null;
  missing: BudgetBasketMissing[];
  products: Product[];
  warning?: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && !isNaN(value) ? value : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

export const parseBudgetPlanRecipe = (raw: unknown): BudgetPlanRecipe | null => {
  const row = asRecord(raw);
  if (!row) return null;
  const recipeId = asString(row.recipe_id ?? row.recipeId);
  if (!recipeId) return null;

  return {
    recipeId,
    title: asString(row.title) ?? 'Recipe',
    servings: asNumber(row.servings),
    estimatedCost: asNumber(row.estimated_cost ?? row.estimatedCost),
    matchCount: asNumber(row.match_count ?? row.matchCount),
  };
};

export const parseBudgetPlanProduct = (raw: unknown): BudgetPlanProduct | null => {
  const row = asRecord(raw);
  if (!row) return null;
  const productId = asString(row.product_id ?? row.productId);
  if (!productId) return null;

  return {
    productId,
    name: asString(row.name) ?? 'Item',
    price: asNumber(row.price) ?? 0,
    role: asString(row.role),
  };
};

export const parseBudgetMealPlan = (raw: unknown): BudgetMealPlan | null => {
  const row = asRecord(raw);
  if (!row) return null;

  const planId = asNumber(row.plan_id ?? row.planId);
  const title = asString(row.title) ?? '';
  if (planId === undefined || !title) return null;

  const planKind = asString(row.plan_kind ?? row.planKind) ?? 'recipe_combo';
  const recipes = ((row.recipes as unknown[]) ?? [])
    .map(parseBudgetPlanRecipe)
    .filter((plan): plan is BudgetPlanRecipe => plan !== null);
  const products = ((row.products as unknown[]) ?? [])
    .map(parseBudgetPlanProduct)
    .filter((product): product is BudgetPlanProduct => product !== null);

  return {
    planId,
    planKind,
    title,
    description: asString(row.description),
    totalCost: asNumber(row.total_cost ?? row.totalCost) ?? 0,
    perPersonCost: asNumber(row.per_person_cost ?? row.perPersonCost) ?? 0,
    servings: asNumber(row.servings) ?? 1,
    withinBudget: (row.within_budget ?? row.withinBudget) !== false,
    headroom: asNumber(row.headroom),
    recipes,
    products,
    isRecipeBased: planKind === 'recipe_combo',
  };
};

export const parseBudgetBasket = (raw: unknown): BudgetBasket | null => {
  const row = asRecord(raw);
  if (!row) return null;

  const storeId = asString(row.store_id ?? row.storeId);
  const storeName = asString(row.store_name ?? row.storeName);
  const rawProducts = (row.products as unknown[]) ?? [];

  // An empty basket is not rendered at all rather than as a dead card.
  if (!storeId && rawProducts.length === 0) return null;

  const products: Product[] = [];
  for (const item of rawProducts) {
    const record = asRecord(item);
    if (!record) continue;
    try {
      const now = new Date().toISOString();
      products.push(
        storeService.mapProductRecord({
          ...record,
          created_at: record.created_at ?? now,
          updated_at: record.updated_at ?? now,
        })
      );
    } catch (e) {
      console.warn('Skipping malformed budget basket product', e);
    }
  }

  const missing = ((row.missing as unknown[]) ?? [])
    .map((item) => {
      const entry = asRecord(item);
      if (!entry) return null;
      return {
        name: asString(entry.name),
        quantity: asString(entry.quantity),
        reason: asString(entry.reason),
      } as BudgetBasketMissing;
    })
    .filter((entry): entry is BudgetBasketMissing => entry !== null);

  return {
    storeId,
    storeName,
    itemCount: asNumber(row.item_count ?? row.itemCount) ?? products.length,
    totalCost: asNumber(row.total_cost ?? row.totalCost) ?? 0,
    perPersonCost: asNumber(row.per_person_cost ?? row.perPersonCost) ?? 0,
    servings: asNumber(row.servings) ?? 1,
    withinBudget: (row.within_budget ?? row.withinBudget) !== false,
    budgetHeadroom: asNumber(row.budget_headroom ?? row.budgetHeadroom),
    missing,
    products,
    warning: asString(row.warning),
  };
};

export const budgetBasketHasWarning = (basket: BudgetBasket): boolean =>
  !!basket.warning && basket.warning.trim().length > 0;

export const budgetBasketHasMissing = (basket: BudgetBasket): boolean =>
  basket.missing.length > 0;

export const budgetBasketCanCheckout = (basket: BudgetBasket): boolean =>
  !!basket.storeId && basket.products.length > 0;

const isSignedIn = async (): Promise<boolean> => {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
};

export interface PlanMealsOptions {
  budget?: number;
  servings?: number;
  cuisine?: string;
  dietary?: string;
  mealType?: string;
  limit?: number;
}

export const budgetMealService = {
  /** Top-ranked budget meal plans. */
  async planMeals(options: PlanMealsOptions = {}): Promise<BudgetMealPlan[]> {
    if (!(await isSignedIn())) return [];

    const { budget, servings, cuisine, dietary, mealType, limit = 4 } = options;
    const { data, error } = await supabase.rpc('qai_plan_budget_meals', {
      p_budget: budget !== undefined && budget > 0 ? budget : null,
      p_servings: servings !== undefined && servings > 0 ? servings : null,
      p_cuisine: cuisine && cuisine.trim() ? cuisine.trim() : null,
      p_dietary: dietary && dietary.trim() ? dietary.trim() : null,
      p_meal_type: mealType && mealType.trim() ? mealType.trim() : null,
      p_limit: limit,
    });

    if (error) {
      console.warn('Budget meal planning failed:', error.message);
      return [];
    }

    return ((data as unknown[]) ?? [])
      .map(parseBudgetMealPlan)
      .filter((plan): plan is BudgetMealPlan => plan !== null);
  },

  /** Build the store-specific basket for a recipe plan (or standalone products). */
  async buildBasket(options: {
    recipeId?: string;
    products?: Record<string, unknown>[];
    budget?: number;
    servings?: number;
  }): Promise<BudgetBasket | null> {
    if (!(await isSignedIn())) return null;

    const { recipeId, products, budget, servings } = options;
    const { data, error } = await supabase.rpc('qai_build_budget_basket', {
      p_recipe_id: recipeId ?? null,
      p_products: products && products.length > 0 ? products : null,
      p_budget: budget !== undefined && budget > 0 ? budget : null,
      p_servings: servings !== undefined && servings > 0 ? servings : null,
    });

    if (error) {
      console.warn('Budget basket build failed:', error.message);
      return null;
    }

    const rows = (data as unknown[]) ?? [];
    if (rows.length === 0) return null;
    return parseBudgetBasket(rows[0]);
  },

  /** Add every product in the basket to the single cart. Returns the count added. */
  async addAllToCart(basket: BudgetBasket): Promise<number> {
    if (!budgetBasketCanCheckout(basket) || !basket.storeId) return 0;

    // A budget basket can start a cart, so register which kind of store it is
    // (food vs liquor) before adding; otherwise the cart would apply the
    // liquor minimum. The basket only carries products, so read the store.
    try {
      const store = await storeService.getStoreById(basket.storeId);
      if (store) {
        cartService.registerStore(store);
      } else {
        cartService.updateStoreContext(basket.storeId, {
          isFood: basket.products.every((product) => product.productType === 'food'),
        });
      }
    } catch (e) {
      console.warn('Could not resolve store context for budget basket', e);
    }

    let added = 0;
    for (const product of basket.products) {
      try {
        await cartService.addItem(product, 1, [], basket.storeId, basket.storeName);
        added += 1;
      } catch (e) {
        console.warn('Could not add budget basket item to cart', e);
      }
    }
    return added;
  },
};
