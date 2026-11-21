import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { Header } from '../../components/Header';
import {
  BudgetMealPlan,
  budgetMealService,
  canOpenBudgetBasket,
} from '../../services/budgetMealService';
import { appConfig } from '../../config/appConfig';
import { Skeleton } from '../../components/Skeleton';

/**
 * Q AI budget meals: plans come from qai_plan_budget_meals, and a plan's basket
 * from qai_build_budget_basket. This is the UI the ported budgetMealService was
 * missing, so the RPCs are reachable from the app again.
 */
export const BudgetMealsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors, typography } = useTheme();

  const [budget, setBudget] = useState('150');
  const [servings, setServings] = useState('2');
  const [plans, setPlans] = useState<BudgetMealPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const parsedBudget = Number(budget);
      const parsedServings = Number(servings);
      const results = await budgetMealService.planMeals({
        budget: Number.isFinite(parsedBudget) ? parsedBudget : undefined,
        servings: Number.isFinite(parsedServings) ? parsedServings : undefined,
      });
      setPlans(results);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const choosePlan = async (plan: BudgetMealPlan) => {
    if (loading) return;
    setLoading(true);
    try {
      const built = await budgetMealService.buildBasket({
        recipeId: plan.isRecipeBased ? plan.recipes[0]?.recipeId : undefined,
        products: plan.isRecipeBased
          ? undefined
          : plan.products.map((product) => ({
              product_id: product.productId,
              name: product.name,
              price: product.price,
            })),
        budget: Number(budget) || undefined,
        servings: Number(servings) || undefined,
      });

      if (!canOpenBudgetBasket(built)) {
        Alert.alert(
          'No basket available',
          'No approved store could match enough items for this plan. Try another plan or a higher budget.'
        );
        return;
      }

      // Leave the plan list so the successful RPC has a visible destination
      // instead of silently appending a card further down the same screen.
      navigation.navigate('BudgetBasket', {
        basket: built,
        budget: Number(budget) || undefined,
        servings: Number(servings) || undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Header title="Budget Meals" showBack onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[typography.bodyMedium, { color: colors.subtext }]}>
          Tell Q your budget and how many people you are feeding. Q builds a
          basket from a single store so delivery stays cheap.
        </Text>

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={[typography.labelMedium, { color: colors.onSurface, marginBottom: 4 }]}>
              Budget (R)
            </Text>
            <TextInput
              style={[styles.input, { color: colors.onSurface, borderColor: colors.divider, backgroundColor: colors.cardBackground }]}
              keyboardType="numeric"
              value={budget}
              onChangeText={setBudget}
              placeholder="150"
              placeholderTextColor={colors.subtext}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.labelMedium, { color: colors.onSurface, marginBottom: 4 }]}>
              Servings
            </Text>
            <TextInput
              style={[styles.input, { color: colors.onSurface, borderColor: colors.divider, backgroundColor: colors.cardBackground }]}
              keyboardType="numeric"
              value={servings}
              onChangeText={setServings}
              placeholder="2"
              placeholderTextColor={colors.subtext}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: colors.secondary }]}
          onPress={() => void search()}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[typography.titleMedium, { color: '#FFFFFF', fontWeight: '800' }]}>
              Plan my meals
            </Text>
          )}
        </TouchableOpacity>

        {loading && searched && (
          <View style={{ marginTop: 12 }}>
            {[1, 2].map((i) => (
              <View
                key={i}
                style={[styles.planCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
              >
                <Skeleton width="70%" height={18} borderRadius={6} style={{ marginBottom: 8 }} />
                <Skeleton width="90%" height={14} borderRadius={6} style={{ marginBottom: 6 }} />
                <Skeleton width="50%" height={14} borderRadius={6} />
              </View>
            ))}
          </View>
        )}

        {searched && plans.length === 0 && !loading && (
          <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 20, textAlign: 'center' }]}>
            No plans matched that budget. Try a higher amount or fewer servings.
          </Text>
        )}

        {!loading && plans.map((plan) => (
          <TouchableOpacity
            key={`${plan.planId}-${plan.title}`}
            style={[styles.planCard, { backgroundColor: colors.cardBackground, borderColor: colors.divider }]}
            onPress={() => void choosePlan(plan)}
            disabled={loading}
            activeOpacity={0.85}
          >
            <View style={styles.planHeader}>
              <Text style={[typography.titleMedium, { color: colors.onSurface, flex: 1 }]}>
                {plan.title}
              </Text>
              <Text style={[typography.titleSmall, { color: colors.secondary, fontWeight: '800' }]}>
                {appConfig.formatCurrency(plan.totalCost)}
              </Text>
            </View>
            {!!plan.description && (
              <Text style={[typography.bodySmall, { color: colors.subtext, marginTop: 4 }]}>
                {plan.description}
              </Text>
            )}
            <Text style={[typography.labelSmall, { color: colors.subtext, marginTop: 6 }]}>
              {appConfig.formatCurrency(plan.perPersonCost)} per person • {plan.servings} servings
            </Text>
            {plan.recipes.length > 0 && (
              <View style={styles.recipeRow}>
                <Ionicons name="restaurant-outline" size={14} color={colors.secondary} />
                <Text style={[typography.labelSmall, { color: colors.secondary, marginLeft: 4 }]}>
                  {plan.recipes.map((recipe) => recipe.title).join(' + ')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', marginTop: 16 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 15 },
  searchBtn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  planCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12 },
  planHeader: { flexDirection: 'row', alignItems: 'center' },
  recipeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
});
