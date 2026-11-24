// Port of queless-v1.0.1/lib/utils/settlement_calculator.dart.
// Mirrors create_order_geo_guard/initialize-paystack-split server maths:
//   platform_margin   = customer_subtotal - base_subtotal
//   platform_gross    = margin + delivery_fee + service_fee
//   platform_absorbed = min(discount, platform_gross)
//   vendor_absorbed   = max(discount - platform_gross, 0)
//   store_share       = clamp(base_subtotal - vendor_absorbed, 0, total)
//   queless_share     = total - store_share

export interface SettlementBreakdown {
  total: number;
  baseSubtotal: number;
  customerSubtotal: number;
  deliveryFee: number;
  discount: number;
  platformMargin: number;
  platformDiscountAbsorbed: number;
  vendorDiscountAbsorbed: number;
  serviceFee: number;
  storeShare: number;
  quelessShare: number;
}

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const settlementCalculator = {
  calculate(params: {
    total: number;
    baseSubtotal: number;
    customerSubtotal: number;
    deliveryFee: number;
    discount: number;
    serviceFee: number;
  }): SettlementBreakdown {
    const total = roundMoney(params.total);
    const baseSubtotal = roundMoney(params.baseSubtotal);
    const customerSubtotal = roundMoney(params.customerSubtotal);
    const deliveryFee = roundMoney(params.deliveryFee);
    const discount = roundMoney(params.discount);
    const serviceFee = roundMoney(params.serviceFee);

    const platformMargin = roundMoney(customerSubtotal - baseSubtotal);
    const platformGrossShare = roundMoney(platformMargin + deliveryFee + serviceFee);
    const platformDiscountAbsorbed = roundMoney(
      discount > platformGrossShare ? platformGrossShare : discount
    );
    const vendorDiscountAbsorbed = roundMoney(
      discount > platformGrossShare ? discount - platformGrossShare : 0
    );

    const storeShare = roundMoney(
      Math.min(Math.max(baseSubtotal - vendorDiscountAbsorbed, 0), total)
    );
    const quelessShare = roundMoney(total - storeShare);

    return {
      total,
      baseSubtotal,
      customerSubtotal,
      deliveryFee,
      discount,
      platformMargin,
      platformDiscountAbsorbed,
      vendorDiscountAbsorbed,
      serviceFee,
      storeShare,
      quelessShare,
    };
  },

  toCents(amount: number): number {
    return Math.round(amount * 100);
  },
};
